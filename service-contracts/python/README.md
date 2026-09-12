# Python contracts

`contracts.py` mirrors the TypeScript types in this package with Pydantic v2 models.
It is **hand-synced**, not generated.

The AI service imports these models to validate the Nest <-> Python frames
(`CreateAiSessionRequestDto`, `AiClientFrame`, `AiServerFrame`, `AiHealthDto`) and the
shared enums. Field names must stay camelCase so they match the TypeScript and
OpenAPI contracts exactly.

## Rules

- Use `Literal` for every enum, never `str`.
- Keep model and field names identical to the TypeScript interfaces.
- Use `Optional[...]` for fields that are nullable or optional in TypeScript.
- Update this file in the same change as the TypeScript types and `http/openapi.yaml`.

## Verification

The AI service owns a contract test that imports `contracts.py` and asserts the model
set and enum values against the TypeScript contract package. That test is added with
the AI service, not here.

## Install

```bash
pip install -r requirements.txt
```
