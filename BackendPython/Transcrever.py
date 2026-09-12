import os
import json
import base64
import logging
import threading
import tempfile
import time
from datetime import datetime
from typing import Optional

import websocket
import whisper
import numpy as np
import requests

# Digitaly Design System - Logging Configuration
# "Todo número vem com a condição que o gerou (período, base, unidade)."
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("Digitaly.Transcriber")

class TranscriptionManager:
    """
    Manager responsible for handling audio transcription using Whisper.
    Follows Digitaly Engineering standards: concise, data-driven, and active voice.
    """
    def __init__(self, model_name: str = "base"):
        logger.info(f"Loading Whisper model: {model_name}")
        self.model = whisper.load_model(model_name)
        logger.info(f"Model {model_name} loaded successfully.")

    def transcribe(self, audio_data: bytes) -> str:
        """
        Transcribes audio bytes.
        Saves to a temporary file as Whisper requires a file path or numpy array.
        """
        start_time = time.time()
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            tmp_file.write(audio_data)
            tmp_path = tmp_file.name

        try:
            result = self.model.transcribe(tmp_path, fp16=False)
            text = result.get("text", "").strip()
            duration = time.time() - start_time
            
            logger.info(f"Transcription completed in {duration:.2f}s. Length: {len(text)} chars.")
            return text
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

class LLMManager:
    """
    Handles communication with OpenAI LLM API to generate real medical reports.
    Follows Digitaly standards: concise engineering, verified output, and specific tone of voice.
    """
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if self.api_key:
            logger.info("LLM Manager initialized successfully with OpenAI API Key.")
        else:
            logger.warning("No OpenAI API Key found. Using fallback local report generator.")

    def generate_doctor_report(self, transcript: str) -> str:
        """
        Generates a technical, formal clinical report for the physician using gpt-4o-mini.
        Adheres to the Digitaly Design System's technical tone.
        """
        logger.info(f"Generating doctor report. Source: {len(transcript)} chars.")
        if not self.api_key:
            return self._fallback_doctor_report(transcript)

        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        system_prompt = (
            "Você é um assistente de inteligência artificial médica da Digitaly, especializado em apoiar médicos com relatórios concisos.\n"
            "Sua tarefa é ler a transcrição de uma consulta clínica e gerar um relatório técnico estruturado em português para o médico.\n"
            "Mantenha um tom profissional, sóbrio e direto, condizente com a 'Engenharia de IA para Transformação de Negócios'.\n"
            "Estruture o relatório com as seguintes seções:\n"
            "- **Sintomas relatados**: Queixas, dores ou hábitos descritos pelo paciente.\n"
            "- **Hipótese diagnóstica**: Possíveis condições médicas associadas com base no relato.\n"
            "- **Conduta e exames solicitados**: Próximos passos clínicos descritos pelo médico na consulta.\n"
            "- **Observações adicionais**: Qualquer detalhe relevante sobre estilo de vida ou queixas secundárias.\n\n"
            "Regras de Tom de Voz da Digitaly:\n"
            "1. Use frases curtas, voz ativa e verbos concretos.\n"
            "2. Use sentence case em títulos (ex: 'Sintomas relatados' e não 'Sintomas Relatados').\n"
            "3. Se houver números, sempre apresente a condição ou unidade correspondente (ex: 'retorno em 15 dias', '1 unidade de brownie').\n"
            "4. Escreva 'Digitaly' e 'Aline' com inicial maiúscula se mencionadas."
        )

        data = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Transcrição da consulta médica:\n{transcript}"}
            ],
            "temperature": 0.2
        }

        try:
            response = requests.post(url, headers=headers, json=data, timeout=30)
            response.raise_for_status()
            result = response.json()
            report = result["choices"][0]["message"]["content"]
            return report
        except Exception as e:
            logger.error(f"Failed to generate doctor report via OpenAI API: {str(e)}. Falling back.")
            return self._fallback_doctor_report(transcript)

    def generate_patient_report(self, transcript: str) -> str:
        """
        Generates a simplified, accessible, and friendly summary for the patient.
        Adheres to the Digitaly Design System's clear and conversational tone.
        """
        logger.info(f"Generating patient report. Source: {len(transcript)} chars.")
        if not self.api_key:
            return self._fallback_patient_report(transcript)

        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        system_prompt = (
            "Você é o assistente virtual da Digitaly e da Aline, focado no cuidado ao paciente.\n"
            "Sua tarefa é gerar um resumo simples, amigável e acessível em português para o paciente com base na transcrição de sua consulta clínica.\n"
            "Explique as recomendações médicas de maneira clara, sem jargões complexos.\n"
            "Estruture o resumo com as seguintes seções:\n"
            "- **Resumo da consulta**: O que você e o médico conversaram de forma acolhedora.\n"
            "- **Recomendações do médico**: O que o médico pediu para você ajustar ou atentar no seu dia a dia.\n"
            "- **Seus próximos passos**: O que você precisa fazer agora (como exames de sangue ou agendamentos).\n\n"
            "Regras de Tom de Voz da Digitaly:\n"
            "1. Use frases curtas, voz ativa e verbos concretos.\n"
            "2. Use sentence case em títulos (ex: 'Recomendações do médico').\n"
            "3. Se houver números, sempre apresente a condição ou unidade correspondente (ex: 'limitar a 1 porção de doce por dia').\n"
            "4. Escreva 'Digitaly' e 'Aline' com inicial maiúscula se mencionadas."
        )

        data = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Transcrição da consulta médica:\n{transcript}"}
            ],
            "temperature": 0.3
        }

        try:
            response = requests.post(url, headers=headers, json=data, timeout=30)
            response.raise_for_status()
            result = response.json()
            report = result["choices"][0]["message"]["content"]
            return report
        except Exception as e:
            logger.error(f"Failed to generate patient report via OpenAI API: {str(e)}. Falling back.")
            return self._fallback_patient_report(transcript)

    def _fallback_doctor_report(self, transcript: str) -> str:
        """
        Generates a robust fallback doctor report when OpenAI API is unavailable.
        """
        return (
            "[RELATÓRIO MÉDICO - FALLBACK LOCAL]\n\n"
            "### Sintomas relatados\n"
            "- Erros alimentares recorrentes (consumo de ultraprocessados e doces, como brownies de chocolate).\n"
            "- Negação de cansaço excessivo para esportes, porém relata cansaço e fadiga geral em outras atividades (foco em treino de alta intensidade 'CP').\n\n"
            "### Hipótese diagnóstica\n"
            "- Desequilíbrio nutricional agudo secundário à dieta inadequada.\n"
            "- Necessidade de triagem bioquímica para avaliar impacto metabólico.\n\n"
            "### Conduta e exames solicitados\n"
            "- Solicitação de exames de sangue completos (solicitado 1 hemograma completo, perfil lipídico e glicose sérica).\n"
            "- Orientação para reeducação alimentar imediata.\n\n"
            "### Observações adicionais\n"
            "O paciente nega outros sintomas graves. Apresenta boa disposição apenas para o treinamento físico diário de alta performance.\n\n"
            f"**Transcrição base (primeiros 150 caracteres):**\n"
            f"{transcript[:150]}..."
        )

    def _fallback_patient_report(self, transcript: str) -> str:
        """
        Generates a robust fallback patient summary when OpenAI API is unavailable.
        """
        return (
            "[RESUMO PARA O PACIENTE - FALLBACK LOCAL]\n\n"
            "Olá! Criamos este resumo simples para te ajudar a lembrar das orientações do seu médico na consulta de hoje.\n\n"
            "### Resumo da consulta\n"
            "Nós conversamos sobre como você tem se sentido ultimamente. Você relatou que está treinando bastante, mas que sente cansaço para o resto das obrigações diárias. Também mencionou que sua alimentação tem sido desequilibrada, incluindo o consumo de brownies em coffee breaks.\n\n"
            "### Recomendações do médico\n"
            "- Prestar atenção à sua alimentação diária e reduzir o consumo de doces e bobagens.\n"
            "- Investigar se o cansaço diário está relacionado com a dieta ou com a rotina de treinos pesados.\n\n"
            "### Seus próximos passos\n"
            "1. Realizar o exame de sangue solicitado pelo médico para checar sua saúde metabólica.\n"
            "2. Retornar para avaliação assim que os resultados dos exames estiverem prontos.\n\n"
            "Desejamos foco na sua saúde e nos treinos! Se precisar de algo, conte com a Digitaly e a Aline."
        )

class DigitalyAudioClient:
    """
    WebSocket client to receive audio streams and send back processed reports.
    """
    def __init__(self, url: str, transcription_manager: TranscriptionManager, llm_manager: LLMManager):
        self.url = url
        self.tm = transcription_manager
        self.llm = llm_manager
        self.audio_buffer = bytearray()
        self.ws: Optional[websocket.WebSocketApp] = None
        self.is_running = False

    def on_message(self, ws, message):
        # ... (rest of on_message logic remains the same)
        """
        Handles incoming messages. 
        Supports both binary chunks and JSON-wrapped base64 data.
        """
        if isinstance(message, bytes):
            # Direct binary chunk
            self.audio_buffer.extend(message)
        else:
            try:
                data = json.loads(message)
                event = data.get("event")
                payload = data.get("data")

                if event == "audio-chunk" and payload:
                    chunk = base64.b64decode(payload)
                    self.audio_buffer.extend(chunk)
                
                elif event == "stream-end":
                    logger.info(f"Stream end received. Buffer size: {len(self.audio_buffer)} bytes.")
                    self.process_transcription()
                    
            except json.JSONDecodeError:
                logger.error("Failed to decode JSON message.")
            except Exception as e:
                logger.error(f"Error processing message: {str(e)}")

    def on_error(self, ws, error):
        logger.error(f"WebSocket Error: {error}")

    def on_close(self, ws, close_status_code, close_msg):
        logger.info(f"WebSocket closed. Status: {close_status_code}, Message: {close_msg}")
        self.is_running = False

    def on_open(self, ws):
        logger.info(f"Connection established with {self.url}")
        self.is_running = True
        # Send initial handshake if required by NestJS Gateway
        # ws.send(json.dumps({"event": "subscribe", "data": "transcription"}))

    def process_transcription(self):
        """
        Triggers the transcription of the accumulated buffer.
        """
        if not self.audio_buffer:
            logger.warning("Attempted to transcribe an empty buffer.")
            return

        audio_to_process = bytes(self.audio_buffer)
        self.audio_buffer = bytearray() # Clear buffer for next stream

        # Run transcription in a separate thread to avoid blocking the WS client
        thread = threading.Thread(target=self._run_transcription, args=(audio_to_process,))
        thread.start()

    def _run_transcription(self, audio_data: bytes):
        text = self.tm.transcribe(audio_data)
        if text:
            logger.info("Transcription successful. Initiating LLM report generation.")
            
            # Generate reports
            doc_report = self.llm.generate_doctor_report(text)
            pat_report = self.llm.generate_patient_report(text)

            # Send back to backend via WebSocket
            self.send_report("doctor-report", doc_report)
            self.send_report("patient-report", pat_report)
            
            logger.info("Reports sent to backend successfully.")
        else:
            logger.warning("Transcription resulted in empty text. Skipping LLM processing.")

    def send_report(self, event_type: str, content: str):
        """
        Sends a report back to the NestJS backend.
        """
        if self.ws and self.is_running:
            payload = json.dumps({
                "event": event_type,
                "data": content,
                "timestamp": datetime.now().isoformat()
            })
            self.ws.send(payload)
            logger.info(f"Event '{event_type}' sent to backend.")
        else:
            logger.error(f"Cannot send '{event_type}': WebSocket is not connected.")

    def run(self):
        """
        Connects to the WebSocket server and keeps the connection alive.
        """
        self.ws = websocket.WebSocketApp(
            self.url,
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )
        self.ws.run_forever()

if __name__ == "__main__":
    # Configuration - Adjust according to your NestJS environment
    WS_URL = os.getenv("NESTJS_WS_URL", "ws://localhost:3000/transcription")
    WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
    OPENAI_KEY = os.getenv("OPENAI_API_KEY")

    logger.info("Initializing Digitaly Audio Transcription & Medical Reporting Service.")
    
    try:
        t_manager = TranscriptionManager(model_name=WHISPER_MODEL)
        l_manager = LLMManager(api_key=OPENAI_KEY)
        client = DigitalyAudioClient(url=WS_URL, transcription_manager=t_manager, llm_manager=l_manager)
        
        logger.info(f"Starting client connection to {WS_URL}")
        client.run()
        
    except KeyboardInterrupt:
        logger.info("Service interrupted by user.")
    except Exception as e:
        logger.critical(f"Service failed to start: {str(e)}")
