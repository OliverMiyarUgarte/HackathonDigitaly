# @telemed/service-contracts

Single source of truth for every payload exchanged between the Digitaly
telemedicine services:

- `types/` — TypeScript DTOs and enums for REST bodies.
- `events/` — Socket.IO event maps and Nest <-> Python AI frames.
- `http/openapi.yaml` — OpenAPI 3.1 description of the HTTP API (global prefix `/api`).
- `python/contracts.py` — handwritten Pydantic v2 mirror of the TypeScript types.

The package compiles to CommonJS so the NestJS backend (CommonJS, `module: nodenext`)
can consume it directly.

## Build

```bash
npm install
npm run build      # emits dist/ with .js and .d.ts
npm run typecheck  # tsc --noEmit
```

`main` and `types` point at `dist/index.js` and `dist/index.d.ts`, so the package must
be built before consumers import it.

## How each service consumes it

- NestJS: add `"@telemed/service-contracts": "file:../service-contracts"`, run
  `npm install`, then import DTOs and event maps from `@telemed/service-contracts`.
  Runtime decorators (`class-validator`) stay in the backend DTO classes; these
  interfaces only pin the wire shape.
- Next.js: depend on the same package (or a path alias to `index.ts`) and import the
  types. Request bodies are validated with `zod` schemas that match these field names.
- Python AI service: import `python/contracts.py` Pydantic models. They are
  hand-synced; a contract test in the AI service is expected to assert parity with the
  TypeScript types.

## Versioning rule

The contract package owns its own semver in `package.json`.

- Patch: documentation or non-shape fixes.
- Minor: additive optional fields or new endpoints/events.
- Major: any rename, removal, type change, or semantic change of an existing field.

Never change the meaning of a field in place.

## Changing a payload

A payload change is only complete when all of the following are updated in the same
change:

1. This package (`types/`, `events/`, `http/openapi.yaml`, and `python/contracts.py`).
2. The producer that emits or accepts the payload.
3. The consumer that reads or sends it.
4. `CHANGELOG.md`, with a new version entry.

Run `npm run typecheck` and the affected service tests before merging.
