import asyncio
import websockets
import json
import base64
import logging

# Digitaly Design System - Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s'
)

logger = logging.getLogger("MockBackend")


async def handler(websocket):
    logger.info("Client connected to mock backend.")

    received_reports = {}

    try:
        # ============================================================
        # 1. Enviar áudio
        # ============================================================

        with open("teste.wav", "rb") as f:
            audio = f.read()

        logger.info("Sending audio chunk...")

        await websocket.send(json.dumps({
            "event": "audio-chunk",
            "data": base64.b64encode(audio).decode("utf-8")
        }))

        await asyncio.sleep(1)

        # ============================================================
        # 2. Informar que o áudio terminou
        # ============================================================

        logger.info("Sending stream-end signal...")

        await websocket.send(json.dumps({
            "event": "stream-end"
        }))

        # ============================================================
        # 3. Esperar os relatórios
        # ============================================================

        async for message in websocket:

            try:
                data = json.loads(message)

            except json.JSONDecodeError:
                logger.error(
                    f"Received invalid JSON: {message}"
                )
                continue

            event = data.get("event")
            report = data.get("data")

            logger.info(
                f"Received from client: Event='{event}'"
            )

            # --------------------------------------------------------
            # Relatório do médico
            # --------------------------------------------------------

            if event == "doctor-report":

                received_reports["doctor-report"] = report

                print("\n")
                print("=" * 80)
                print("RELATÓRIO PARA O MÉDICO")
                print("=" * 80)
                print(report)
                print("=" * 80)
                print("\n")

                logger.info("Doctor report received successfully.")

            # --------------------------------------------------------
            # Relatório do paciente
            # --------------------------------------------------------

            elif event == "patient-report":

                received_reports["patient-report"] = report

                print("\n")
                print("=" * 80)
                print("RELATÓRIO PARA O PACIENTE")
                print("=" * 80)
                print(report)
                print("=" * 80)
                print("\n")

                logger.info("Patient report received successfully.")

            # --------------------------------------------------------
            # Verificar se recebemos os dois
            # --------------------------------------------------------

            if (
                "doctor-report" in received_reports
                and "patient-report" in received_reports
            ):
                print("\n")
                print("#" * 80)
                print("TESTE CONCLUÍDO: OS DOIS RELATÓRIOS FORAM RECEBIDOS")
                print("#" * 80)
                print("\n")

                break

    except websockets.exceptions.ConnectionClosed:
        logger.info("Client disconnected.")


async def main():

    logger.info(
        "Starting Mock NestJS WebSocket Server "
        "on ws://localhost:3000/transcription"
    )

    async with websockets.serve(
        handler,
        "localhost",
        3000
    ):
        await asyncio.Future()


if __name__ == "__main__":

    try:
        asyncio.run(main())

    except KeyboardInterrupt:
        logger.info("Mock server stopped.")
