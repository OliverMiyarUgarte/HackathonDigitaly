from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import WebSocket
from pydantic import BaseModel

from app.audio import PcmBuffer
from app.config import Settings


def utc_now() -> datetime:
    return datetime.now(UTC)


def iso_timestamp(moment: datetime | None = None) -> str:
    value = moment or utc_now()
    return value.isoformat().replace("+00:00", "Z")


@dataclass
class Session:
    session_id: str
    consultation_id: str
    appointment_id: str
    language: str
    ttl_seconds: int
    buffer: PcmBuffer
    created_at: datetime = field(default_factory=utc_now)
    last_activity: float = field(default_factory=time.monotonic)
    last_seq: int = -1
    bytes_since_partial: int = 0
    closed: bool = False
    partial_busy: bool = False
    partial_task: asyncio.Task[None] | None = None
    websocket: WebSocket | None = None
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    @property
    def expires_at(self) -> datetime:
        return self.created_at + timedelta(seconds=self.ttl_seconds)

    def expires_at_iso(self) -> str:
        return iso_timestamp(self.expires_at)

    def touch(self) -> None:
        self.last_activity = time.monotonic()

    def is_idle(self, now: float | None = None) -> bool:
        current = time.monotonic() if now is None else now
        return current - self.last_activity >= self.ttl_seconds

    async def send(self, frame: BaseModel) -> None:
        websocket = self.websocket
        if websocket is None:
            return
        async with self.send_lock:
            if self.websocket is None:
                return
            try:
                await websocket.send_text(frame.model_dump_json())
            except RuntimeError:
                self.websocket = None

    async def close_websocket(self, code: int, reason: str) -> None:
        websocket = self.websocket
        if websocket is None:
            return
        try:
            await websocket.close(code=code, reason=reason)
        except RuntimeError:
            return


def create_session(
    payload_consultation_id: str, payload_appointment_id: str, language: str, settings: Settings
) -> Session:
    return Session(
        session_id=uuid4().hex,
        consultation_id=payload_consultation_id,
        appointment_id=payload_appointment_id,
        language=language,
        ttl_seconds=settings.session_ttl_seconds,
        buffer=PcmBuffer(max_bytes=settings.max_buffer_bytes),
    )


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}

    def add(self, session: Session) -> None:
        self._sessions[session.session_id] = session

    def get(self, session_id: str) -> Session | None:
        return self._sessions.get(session_id)

    def remove(self, session_id: str) -> Session | None:
        return self._sessions.pop(session_id, None)

    def all(self) -> list[Session]:
        return list(self._sessions.values())

    def __len__(self) -> int:
        return len(self._sessions)
