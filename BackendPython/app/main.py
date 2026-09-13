from __future__ import annotations

import asyncio
import logging
import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from typing import Annotated, cast

from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket, status

from app import __version__
from app.config import Settings
from app.models import AiHealthDto, AiSessionCreatedDto, CreateAiSessionRequestDto
from app.pipeline import run_audio_session
from app.providers.factory import Providers, build_providers
from app.session import SessionStore, create_session, iso_timestamp

logger = logging.getLogger("digitaly.ai")

IDLE_SWEEP_SECONDS = 1.0
WS_UNAUTHORIZED = 4401
WS_SESSION_NOT_FOUND = 4404
WS_SESSION_EXPIRED = 4408
WS_NORMAL_CLOSURE = 1000


def _token_valid(expected: str, provided: str | None) -> bool:
    if not expected or not provided:
        return False
    return secrets.compare_digest(expected, provided)


async def _idle_sweeper(app: FastAPI) -> None:
    store = cast(SessionStore, app.state.sessions)
    while True:
        await asyncio.sleep(IDLE_SWEEP_SECONDS)
        for session in store.all():
            if not session.is_idle():
                continue
            logger.info("Closing idle AI session")
            await session.close_websocket(WS_SESSION_EXPIRED, "idle timeout")
            store.remove(session.session_id)
            session.buffer.clear()


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or Settings.from_env()
    logging.basicConfig(
        level=resolved.log_level.upper(),
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    providers = build_providers(resolved)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        sweeper = asyncio.create_task(_idle_sweeper(app))
        logger.info("AI copilot started provider=%s", app.state.providers.name)
        try:
            yield
        finally:
            sweeper.cancel()
            with suppress(asyncio.CancelledError):
                await sweeper
            store = cast(SessionStore, app.state.sessions)
            for session in store.all():
                session.buffer.clear()
                store.remove(session.session_id)

    app = FastAPI(title="Digitaly AI Copilot", version=__version__, lifespan=lifespan)
    app.state.settings = resolved
    app.state.providers = providers
    app.state.sessions = SessionStore()

    def get_settings_dep(request: Request) -> Settings:
        return cast(Settings, request.app.state.settings)

    def require_token(
        x_internal_token: Annotated[str | None, Header(alias="X-Internal-Token")] = None,
        settings: Settings = Depends(get_settings_dep),
    ) -> None:
        if not _token_valid(settings.ai_internal_token, x_internal_token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid internal token",
            )

    @app.get("/health", response_model=AiHealthDto)
    async def health(request: Request) -> AiHealthDto:
        current: Providers = request.app.state.providers
        return AiHealthDto(status="ok", provider=current.name, timestamp=iso_timestamp())

    @app.post(
        "/sessions",
        response_model=AiSessionCreatedDto,
        status_code=status.HTTP_201_CREATED,
        dependencies=[Depends(require_token)],
    )
    async def open_session(
        payload: CreateAiSessionRequestDto,
        request: Request,
    ) -> AiSessionCreatedDto:
        store = cast(SessionStore, request.app.state.sessions)
        settings_now = cast(Settings, request.app.state.settings)
        session = create_session(
            payload.consultationId,
            payload.appointmentId,
            payload.language,
            settings_now,
        )
        store.add(session)
        return AiSessionCreatedDto(
            sessionId=session.session_id,
            expiresAt=session.expires_at_iso(),
        )

    @app.websocket("/sessions/{session_id}/audio")
    async def audio_socket(websocket: WebSocket, session_id: str) -> None:
        settings_now = cast(Settings, websocket.app.state.settings)
        provided = websocket.headers.get("x-internal-token")
        if not _token_valid(settings_now.ai_internal_token, provided):
            await websocket.accept()
            await websocket.close(code=WS_UNAUTHORIZED, reason="invalid internal token")
            return

        store = cast(SessionStore, websocket.app.state.sessions)
        session = store.get(session_id)
        if session is None:
            await websocket.accept()
            await websocket.close(code=WS_SESSION_NOT_FOUND, reason="session not found")
            return
        if session.closed or session.is_idle():
            store.remove(session_id)
            session.buffer.clear()
            await websocket.accept()
            await websocket.close(code=WS_SESSION_EXPIRED, reason="session expired")
            return

        await websocket.accept()
        current: Providers = websocket.app.state.providers
        try:
            await run_audio_session(
                session,
                websocket,
                settings_now,
                current.transcriber,
                current.copilot,
            )
        finally:
            store.remove(session_id)
            session.buffer.clear()
            try:
                await websocket.close(code=WS_NORMAL_CLOSURE)
            except RuntimeError:
                pass

    return app


app = create_app()
