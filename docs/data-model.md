# Data model

Source of truth: `Backend/prisma/schema.prisma`. All schema changes go through
`Backend/prisma/migrations/`. Databases are provisioned with
`npx prisma migrate deploy` from `Backend/`.

- Migration history: `20260912161334_init`, `20260912201425_add_healthcare_query_indexes`,
  `20260913174950_add_consultation_summaries`.
- Reference snapshot (read-only, generated from a freshly migrated database):
  `docs/schema.reference.sql`. Regenerate with
  `pg_dump --schema-only --no-owner --no-privileges <db>`; never edit by hand.
- Historical prototype dumps live in `docs/legacy/` and are not usable.
- DBMS: PostgreSQL 16, Prisma 7 (`@prisma/adapter-pg`), UUID v4 keys,
  `timestamptz(6)` everywhere.

## Entity-relationship overview

```
                         +--------------------------+
                         |          users           |
                         | role: doctor | patient   |
                         | email UNIQUE             |
                         +------------+-------------+
                              ^   ^   ^   ^   ^
      as patient / doctor     |   |   |   |   | as uploader / actor
                              |   |   |   |   |
        +---------------------+   |   |   |   +----------------------+
        |                         |   |   |                          |
        v                         |   |   |                          v
+----------------+  1..*  +-------+   |   +----------+     +----------------+
|  appointments  |------->| refresh_tokens | medical_records|    audit_logs  |
| 6 statuses     |        +-------+   |   | (patient +    |                |
+---+---+---+----+                    |   |  author FKs)  |                |
    |   |   |                         |   +-------+------+                |
    |   |   |                         |           ^ 1..1 (UNIQUE)          |
    |   |   |        +----------------+           |                        |
    |   |   +------->|  consultations |<----------+                        |
    |   |   0..1     | active | ended |                                     |
    |   |            +-------+--------+                                     |
    |   |                    | 0..*                                         |
    |   |                    v                                              |
    |   |            +----------------+                                     |
    |   |            |  attachments   |-------------------------------------+
    |   |            +-------+--------+        uploader -> users
    |   |
    |   +----> validation_codes        (0..*); code_hash only
    |
    +--------> pre_consult_answers     (0..*); UNIQUE (appointment_id, question_key)
```

Cardinalities: one appointment has at most one consultation and at most one
medical record per consultation; an appointment can have many validation codes
(one active at a time in practice), pre-consult answers and attachments.

## Tables

### users

- Purpose: doctors and patients, the only identity table.
- Key fields: `role` (`doctor` | `patient`), `name`, `email` (unique, stored
  lower-case by the service), `password_hash` (argon2id), `specialty`/`crm`
  (doctors), `created_at`, `updated_at`, `deleted_at` (soft delete).
- Indexes: PK `id`; UNIQUE `email`; `(role, deleted_at)` for the doctor directory.
- Delete rules: FKs from appointments and medical records are `RESTRICT`;
  erasure is a soft delete (`deleted_at`), history is preserved.

### refresh_tokens

- Purpose: revocable, rotatable refresh sessions (opaque tokens, only SHA-256
  hashes persisted).
- Key fields: `user_id`, `token_hash` (unique), `expires_at`, `revoked_at`,
  `created_at`.
- Indexes: PK `id`; UNIQUE `token_hash`; `(user_id)`; `(expires_at)` (purge).
- Delete rules: `ON DELETE CASCADE` from `users`.

### appointments

- Purpose: a booked 30-minute slot between a patient and a doctor.
- Key fields: `patient_id`, `doctor_id`, `scheduled_at` (timestamptz),
  `status`, `cancel_reason`, timestamps.
- Status machine (enforced in the service):
  `pending_code -> confirmed -> in_progress -> completed`, with
  `pending_code|confirmed -> cancelled`; `completed` and `cancelled` terminal.
- Indexes: PK `id`; `(doctor_id, scheduled_at)` for the agenda/slots;
  `(patient_id, scheduled_at DESC)` for the patient calendar; `status`.
- Delete rules: `patient_id`/`doctor_id` -> `users` `ON DELETE RESTRICT`.
- Double-booking: guarded in the service by
  `pg_advisory_xact_lock(hashtext(doctorId:scheduledAt))` plus an overlap
  check; there is deliberately no unique constraint (slots may overlap only
  when cancelled, and 30-minute windows make a naive unique key wrong).

### validation_codes

- Purpose: e-mail confirmation codes for an appointment. Only an HMAC-SHA256
  hash (`code_hash`, pepper from `OTP_PEPPER`) is stored.
- Key fields: `appointment_id`, `code_hash`, `expires_at`, `consumed_at`
  (null = active), `attempts`, `created_at`.
- Indexes: PK `id`; `(appointment_id)`; partial
  `(appointment_id, created_at DESC) WHERE consumed_at IS NULL` for the active
  code lookup; the partial index needs `previewFeatures = ["partialIndexes"]`.
- Delete rules: `ON DELETE CASCADE` from `appointments`.

### consultations

- Purpose: one live/ended teleconsultation per appointment (room lifecycle).
- Key fields: `appointment_id` (UNIQUE), `status` (`active` | `ended`),
  `started_at`, `ended_at`, `doctor_summary`, `patient_summary`,
  `summary_generated_at`, timestamps.
- `doctor_summary`/`patient_summary` persist the AI whole-call summary (clinical
  vs. patient-friendly wording) and `summary_generated_at` records when it was
  produced; all nullable until `summary.ready` is stored.
- Indexes: PK `id`; UNIQUE `(appointment_id)`; `status`;
  `(started_at DESC)` for history by date.
- Delete rules: `ON DELETE CASCADE` from `appointments`.

### medical_records

- Purpose: the clinical note produced from a consultation.
- Key fields: `patient_id`, `consultation_id` (UNIQUE, one record per
  consultation), `created_by` (authoring doctor), `notes`, `diagnosis`,
  `prescriptions` (`text[]`), timestamps.
- Indexes: PK `id`; UNIQUE `(consultation_id)`;
  `(patient_id, created_at DESC)` for the patient history.
- Delete rules: `patient_id`/`created_by` -> `users` `RESTRICT`;
  `consultation_id` -> `consultations` `ON DELETE CASCADE`.
- Invariant: `patient_id` must equal the patient of the consultation's
  appointment; validated in `RecordsService`.

### pre_consult_answers

- Purpose: structured intake answers keyed by
  `PRE_CONSULT_QUESTION_KEYS` in `service-contracts`.
- Key fields: `appointment_id`, `question_key`, `answer`, timestamps.
- Indexes: PK `id`; UNIQUE `(appointment_id, question_key)`.
- Delete rules: `ON DELETE CASCADE` from `appointments`.

### attachments

- Purpose: metadata for uploaded files (documents/images) linked to an
  appointment and optionally a consultation. Bytes live in object/file
  storage; the DB keeps only `storage_key`.
- Key fields: `appointment_id`, `consultation_id` (nullable), `uploader_id`,
  `file_name`, `content_type`, `size_bytes`, `kind`, `storage_key`,
  `created_at`.
- Indexes: PK `id`; `(appointment_id)`.
- Delete rules: `appointment_id` -> `appointments` `ON DELETE CASCADE`;
  `consultation_id` -> `consultations` `ON DELETE SET NULL`;
  `uploader_id` -> `users` `RESTRICT`.

### audit_logs

- Purpose: append-only access/changes trail for sensitive resources.
- Key fields: `actor_id` (nullable), `action`, `resource_type`, `resource_id`,
  `metadata` (JSONB, sanitized by `AuditService`), `created_at`.
- Indexes: PK `id`; `(resource_type, resource_id)`;
  `(actor_id, created_at)`.
- Delete rules: `actor_id` -> `users` `ON DELETE SET NULL` so the trail
  survives actor erasure.

## LGPD notes

| Column | PII / sensitive | Handling |
| --- | --- | --- |
| `users.name` | PII | minimum identity field; soft delete |
| `users.email` | PII + credential | unique, lower-cased, never logged |
| `users.password_hash` | secret | argon2id; never returned by the API |
| `users.specialty`, `users.crm` | professional data | doctors only |
| `validation_codes.code_hash` | secret | HMAC-SHA256; plaintext code never stored |
| `appointments.scheduled_at` | health-adjacent | access restricted by patient/doctor |
| `consultations.started_at/ended_at` | health metadata | participant-only access |
| `consultations.doctor_summary/patient_summary` | sensitive health data (AI-generated) | participant-only; `summary_generated_at` keeps provenance |
| `medical_records.notes/diagnosis/prescriptions` | sensitive health data | participant-only; reads audited |
| `pre_consult_answers.answer` | sensitive health data | participant-only |
| `attachments.file_name/content_type/storage_key` | possibly health data | access via appointment ACL; reads audited |
| `refresh_tokens.token_hash` | secret | SHA-256; rotation and reuse detection |
| `audit_logs.metadata` | sanitized | PII-like keys and e-mails stripped before write |

Retention and erasure:

- No real patient data is committed: seeds and tests are fictional.
- Users are erased by `deleted_at` (soft delete); clinical history is retained
  as required for health records. Hard-delete of a user is blocked
  (`RESTRICT`) while appointments/records exist.
- Medical records follow the professional retention window; they are removed
  only by cascade when their appointment/consultation is removed, which the
  service does not do for completed care.
- `audit_logs` is retained; the actor link is nulled on erasure.
- `refresh_tokens` and expired/consumed `validation_codes` are purgeable via
  `expires_at` / `consumed_at`; access is auditable through `audit_logs`.

## Seed / demo state

`Backend/prisma/seed.ts` is idempotent (fixed UUIDs, upserts) and fictional.
Local-development password for every demo account: `Demo@1234`; set
`SEED_DEMO_PASSWORD` to override it (required by the production seed profile).

- Doctors: `medico@digitaly.health` (Cardiologia, CRM-SP 123456),
  `medico2@digitaly.health` (Dermatologia, CRM-RJ 654321).
- Patients: `paciente@digitaly.health`, `paciente2@digitaly.health`.
- Appointments (relative to seed time):
  - `a0...0001` `pending_code` (next day).
  - `a0...0002` `confirmed` + consumed validation code (2 h ahead).
  - `a0...0003` `completed` (last week) with an ended consultation, a medical
    record and all 5 pre-consult answers.
  - `a0...0004` `confirmed` + consumed validation code (3 h ahead).
- Availability for booking is generated from business rules (weekdays,
  09:00-17:00, 30-minute slots) by `SlotsService`; no availability table.

Verify the demo flow state:

```sql
SELECT a.id, a.status,
       c.status AS consultation,
       (c.ended_at IS NOT NULL) AS consultation_ended,
       (r.id IS NOT NULL) AS has_record,
       (SELECT count(*) FROM pre_consult_answers p WHERE p.appointment_id = a.id) AS answers
FROM appointments a
LEFT JOIN consultations c ON c.appointment_id = a.id
LEFT JOIN medical_records r ON r.consultation_id = c.id
ORDER BY a.id;

SELECT a.id, a.status,
       (v.id IS NOT NULL) AS has_consumed_code
FROM appointments a
LEFT JOIN validation_codes v
  ON v.appointment_id = a.id AND v.consumed_at IS NOT NULL
ORDER BY a.id;
```

## Migration reversibility

Prisma migrations are forward-only. `20260912201425_add_healthcare_query_indexes`
is index-only and reversible by running the inverse and re-running
`prisma migrate deploy` basis:

```sql
DROP INDEX "validation_codes_appointment_id_created_at_idx";
DROP INDEX "validation_codes_appointment_id_idx";
CREATE INDEX "validation_codes_appointment_id_expires_at_idx"
  ON "validation_codes"("appointment_id", "expires_at");
DROP INDEX "users_role_deleted_at_idx";
DROP INDEX "consultations_started_at_idx";
```

`20260913174950_add_consultation_summaries` is additive and reversible by
dropping the three columns:

```sql
ALTER TABLE "consultations"
  DROP COLUMN "doctor_summary",
  DROP COLUMN "patient_summary",
  DROP COLUMN "summary_generated_at";
```

## Deliberately unchanged

- No DB-level status-transition constraints; transitions are service-enforced
  to keep the rules testable and reversible.
- No unique double-booking constraint (advisory lock instead; see
  `appointments`).
- `users.email` uniqueness is case-sensitive at the DB; the service normalizes
  to lower-case.
- `medical_records.patient_id` stays denormalized (fast patient history) and is
  validated in the service.
- `schema.sql`/`backup.sql` were broken prototype dumps and moved to
  `docs/legacy/`.
