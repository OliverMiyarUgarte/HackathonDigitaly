from __future__ import annotations

from app.providers.copilot import RuleCopilot


async def test_rule_copilot_flags_red_flags() -> None:
    copilot = RuleCopilot()
    items = await copilot.feedback(
        "Paciente com dor no peito e falta de ar, usa medicação contínua e tem alergia a dipirona."
    )
    tags = {tag for item in items for tag in item.tags}
    assert {"red_flag", "chest_pain", "dyspnea", "medication", "allergy"} <= tags
    assert any(item.severity == "critical" for item in items)


async def test_rule_copilot_info_fallback() -> None:
    items = await RuleCopilot().feedback("Paciente relata cansaço leve.")
    assert len(items) == 1
    assert items[0].severity == "info"
    assert items[0].tags == ("next_question",)


async def test_rule_copilot_handles_accented_terms() -> None:
    items = await RuleCopilot().feedback("Relata dispneia e ideacao suicida.")
    tags = {tag for item in items for tag in item.tags}
    assert "dyspnea" in tags
    assert "self_harm" in tags


async def test_reports_do_not_echo_transcript() -> None:
    copilot = RuleCopilot()
    transcript = "conteudo sensivel do paciente"
    assert transcript not in await copilot.doctor_report(transcript)
    assert transcript not in await copilot.patient_report(transcript)
