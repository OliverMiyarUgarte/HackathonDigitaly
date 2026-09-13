from __future__ import annotations

import json
import unicodedata
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.models import FeedbackSeverity

DOCTOR_SYSTEM_PROMPT = (
    "Você é um assistente de inteligência artificial médica da Digitaly, especializado em "
    "apoiar médicos com relatórios concisos.\n"
    "Sua tarefa é ler a transcrição de uma consulta clínica e gerar um relatório técnico "
    "estruturado em português para o médico.\n"
    "Mantenha um tom profissional, sóbrio e direto, condizente com a "
    "'Engenharia de IA para Transformação de Negócios'.\n"
    "Estruture o relatório com as seguintes seções:\n"
    "- **Sintomas relatados**: Queixas, dores ou hábitos descritos pelo paciente.\n"
    "- **Hipótese diagnóstica**: Possíveis condições médicas associadas com base no relato.\n"
    "- **Conduta e exames solicitados**: Próximos passos clínicos descritos pelo médico.\n"
    "- **Observações adicionais**: Qualquer detalhe relevante sobre estilo de vida.\n\n"
    "Regras de Tom de Voz da Digitaly:\n"
    "1. Use frases curtas, voz ativa e verbos concretos.\n"
    "2. Use sentence case em títulos.\n"
    "3. Se houver números, apresente a condição ou unidade correspondente.\n"
    "4. Escreva 'Digitaly' e 'Aline' com inicial maiúscula se mencionadas."
)

PATIENT_SYSTEM_PROMPT = (
    "Você é o assistente virtual da Digitaly e da Aline, focado no cuidado ao paciente.\n"
    "Sua tarefa é gerar um resumo simples, amigável e acessível em português para o paciente "
    "com base na transcrição de sua consulta clínica.\n"
    "Explique as recomendações médicas de maneira clara, sem jargões complexos.\n"
    "Estruture o resumo com as seguintes seções:\n"
    "- **Resumo da consulta**: O que foi conversado, de forma acolhedora.\n"
    "- **Recomendações do médico**: O que ajustar no dia a dia.\n"
    "- **Seus próximos passos**: O que fazer agora.\n\n"
    "Regras de Tom de Voz da Digitaly:\n"
    "1. Use frases curtas, voz ativa e verbos concretos.\n"
    "2. Use sentence case em títulos.\n"
    "3. Se houver números, apresente a condição ou unidade correspondente.\n"
    "4. Escreva 'Digitaly' e 'Aline' com inicial maiúscula se mencionadas."
)

FEEDBACK_SYSTEM_PROMPT = (
    "Você apoia um médico durante uma teleconsulta ao vivo.\n"
    "Leia a transcrição e retorne um objeto JSON com a chave 'items'.\n"
    "Cada item deve ter: 'severity' (info, warning ou critical), 'message' "
    "(frase curta em português, voz ativa) e 'tags' (lista de strings curtas).\n"
    "Sinalize sinais de alarme, medicações, alergias e a próxima pergunta útil.\n"
    "Não invente diagnósticos. Não use caixa alta. Retorne apenas o JSON."
)

_INFORMATION_FEEDBACK = "Pergunte sobre início, duração e fatores de melhora ou piora dos sintomas."

_RULES: tuple[tuple[tuple[str, ...], FeedbackSeverity, str, tuple[str, ...]], ...] = (
    (
        ("dor no peito", "chest pain", "dor toracica", "angina"),
        "critical",
        "Dor no peito relatada. Priorize avaliação cardíaca e sinais de alarme.",
        ("red_flag", "chest_pain"),
    ),
    (
        ("falta de ar", "shortness of breath", "dispneia", "dificuldade para respirar"),
        "critical",
        "Falta de ar relatada. Avalie saturação e gravidade do quadro.",
        ("red_flag", "dyspnea"),
    ),
    (
        ("sangramento", "hemorragia", "bleeding", "sangue nas fezes"),
        "critical",
        "Sangramento relatado. Investigue origem e volume.",
        ("red_flag", "bleeding"),
    ),
    (
        ("desmaio", "desmaiou", "sincope", "fainting", "perda de consciencia"),
        "critical",
        "Desmaio relatado. Avalie causas cardiovasculares e neurológicas.",
        ("red_flag", "syncope"),
    ),
    (
        (
            "ideacao suicida",
            "suicidio",
            "suicidal",
            "me matar",
            "autoagressao",
        ),
        "critical",
        "Risco de autoagressão mencionado. Acione o protocolo de segurança.",
        ("red_flag", "self_harm"),
    ),
    (
        ("medicacao", "medicamento", "remedio", "medication", "uso continuo"),
        "warning",
        "Menção a medicação. Confirme nome, dose e adesão.",
        ("medication",),
    ),
    (
        ("alergia", "alergias", "allergy"),
        "warning",
        "Alergia mencionada. Confirme substância e reação prévia.",
        ("allergy",),
    ),
)


@dataclass(frozen=True)
class Feedback:
    severity: FeedbackSeverity
    message: str
    tags: tuple[str, ...]


class Copilot(Protocol):
    name: str

    async def feedback(self, transcript: str) -> list[Feedback]: ...

    async def doctor_report(self, transcript: str) -> str: ...

    async def patient_report(self, transcript: str) -> str: ...


class CopilotError(RuntimeError):
    pass


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(char for char in decomposed if not unicodedata.combining(char)).lower()


def _findings(transcript: str) -> list[Feedback]:
    normalized = _normalize(transcript).strip()
    if not normalized:
        return []
    found: list[Feedback] = []
    for terms, severity, message, tags in _RULES:
        if any(term in normalized for term in terms):
            found.append(Feedback(severity=severity, message=message, tags=tags))
    return found


class RuleCopilot:
    name = "rule"

    def __init__(self, max_items: int = 5) -> None:
        self._max_items = max(1, max_items)

    async def feedback(self, transcript: str) -> list[Feedback]:
        if not _normalize(transcript).strip():
            return []
        found = _findings(transcript)
        if not found:
            return [
                Feedback(severity="info", message=_INFORMATION_FEEDBACK, tags=("next_question",))
            ]
        return found[: self._max_items]

    async def doctor_report(self, transcript: str) -> str:
        return _fallback_doctor_report(_findings(transcript))

    async def patient_report(self, transcript: str) -> str:
        return _fallback_patient_report(_findings(transcript))


class LlmCopilot:
    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str,
        timeout_seconds: float,
        fallback: Copilot | None = None,
    ) -> None:
        self.name = f"openai:{model}"
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._timeout = timeout_seconds
        self._fallback = fallback or RuleCopilot()

    async def feedback(self, transcript: str) -> list[Feedback]:
        deterministic = await self._fallback.feedback(transcript)
        try:
            generated = await self._request_feedback(transcript)
        except CopilotError:
            return deterministic
        return _merge_feedback(deterministic, generated)

    async def doctor_report(self, transcript: str) -> str:
        try:
            return await self._complete(DOCTOR_SYSTEM_PROMPT, transcript, temperature=0.2)
        except CopilotError:
            return await self._fallback.doctor_report(transcript)

    async def patient_report(self, transcript: str) -> str:
        try:
            return await self._complete(PATIENT_SYSTEM_PROMPT, transcript, temperature=0.3)
        except CopilotError:
            return await self._fallback.patient_report(transcript)

    async def _request_feedback(self, transcript: str) -> list[Feedback]:
        content = await self._complete(
            FEEDBACK_SYSTEM_PROMPT,
            transcript,
            temperature=0.1,
            json_object=True,
        )
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            raise CopilotError("copilot response was not valid JSON") from exc
        return _parse_feedback_items(parsed)

    async def _complete(
        self,
        system_prompt: str,
        transcript: str,
        temperature: float,
        json_object: bool = False,
    ) -> str:
        payload: dict[str, object] = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Transcrição da consulta médica:\n{transcript}"},
            ],
            "temperature": temperature,
        }
        if json_object:
            payload["response_format"] = {"type": "json_object"}
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(
                    f"{self._base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
                body: object = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise CopilotError("language model provider failed") from exc
        return _extract_message_content(body)


def _extract_message_content(body: object) -> str:
    if not isinstance(body, dict):
        raise CopilotError("language model response malformed")
    choices = body.get("choices")
    if not isinstance(choices, list) or not choices:
        raise CopilotError("language model response malformed")
    first = choices[0]
    if not isinstance(first, dict):
        raise CopilotError("language model response malformed")
    message = first.get("message")
    if not isinstance(message, dict):
        raise CopilotError("language model response malformed")
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise CopilotError("language model response malformed")
    return content.strip()


def _parse_feedback_items(body: object) -> list[Feedback]:
    if not isinstance(body, dict):
        raise CopilotError("copilot response malformed")
    items = body.get("items")
    if not isinstance(items, list):
        raise CopilotError("copilot response malformed")
    parsed: list[Feedback] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        severity = item.get("severity")
        message = item.get("message")
        tags = item.get("tags")
        if severity not in ("info", "warning", "critical"):
            continue
        if not isinstance(message, str) or not message.strip():
            continue
        if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
            continue
        parsed.append(
            Feedback(
                severity=severity,
                message=message.strip(),
                tags=tuple(tags),
            )
        )
    return parsed


def _merge_feedback(deterministic: list[Feedback], generated: list[Feedback]) -> list[Feedback]:
    merged = list(deterministic)
    seen = {_normalize(item.message) for item in deterministic}
    for item in generated:
        key = _normalize(item.message)
        if key in seen:
            continue
        seen.add(key)
        merged.append(item)
    return merged


def _fallback_doctor_report(findings: list[Feedback]) -> str:
    red_flags = [item.message for item in findings if "red_flag" in item.tags]
    medications = [item.message for item in findings if "medication" in item.tags]
    allergies = [item.message for item in findings if "allergy" in item.tags]
    if red_flags:
        symptoms = "\n".join(f"- {message}" for message in red_flags)
    else:
        symptoms = "- Sem sinais de alarme identificados automaticamente no relato."
    observations = [f"- {message}" for message in medications]
    observations += [f"- {message}" for message in allergies]
    observations.append("- Resumo gerado localmente, sem envio de dados a provedores externos.")
    return (
        "### Sintomas relatados\n"
        f"{symptoms}\n\n"
        "### Hipótese diagnóstica\n"
        "- A definir pelo médico responsável com base no exame clínico.\n\n"
        "### Conduta e exames solicitados\n"
        "- Confirmar conduta e solicitar exames conforme avaliação clínica.\n"
        "- Orientar retorno e sinais de alarme para reavaliação.\n\n"
        "### Observações adicionais\n" + "\n".join(observations)
    )


def _fallback_patient_report(findings: list[Feedback]) -> str:
    has_red_flag = any("red_flag" in item.tags for item in findings)
    has_medication = any("medication" in item.tags for item in findings)
    has_allergy = any("allergy" in item.tags for item in findings)
    overview = (
        "O médico avaliou os pontos que precisam de atenção."
        if has_red_flag
        else "O médico avaliou como você está se sentindo e o que precisa de atenção."
    )
    recommendations = ["Siga as orientações combinadas durante a consulta."]
    if has_medication:
        recommendations.append("Use as medicações exatamente como o médico orientou.")
    if has_allergy:
        recommendations.append("Informe suas alergias antes de iniciar qualquer remédio novo.")
    recommendation_lines = "\n".join(f"- {message}" for message in recommendations)
    return (
        "### Resumo da consulta\n"
        f"{overview}\n\n"
        "### Recomendações do médico\n"
        f"{recommendation_lines}\n\n"
        "### Seus próximos passos\n"
        "1. Anote suas dúvidas para a próxima conversa.\n"
        "2. Procure o serviço de saúde se os sintomas piorarem.\n\n"
        "Conte com a Digitaly e a Aline."
    )
