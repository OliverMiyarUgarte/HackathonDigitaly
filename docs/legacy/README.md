# Legacy SQL dumps (not the schema of record)

These files are historical artifacts from an earlier prototype. They are kept only
for archaeology and must **never** be used to create or migrate the application
database.

The schema of record is `Backend/prisma/schema.prisma`, versioned through the
migrations in `Backend/prisma/migrations/`. To provision a database, run
`npx prisma migrate deploy` from `Backend/`.

`docs/schema.reference.sql` is a generated, read-only snapshot of the schema for
review and VPS provisioning checks. Regenerate it from a freshly migrated database
with `pg_dump --schema-only`; do not edit it by hand.

Known defects in the legacy dumps:

- Columns typed `"char"[]` instead of `text`/`varchar`.
- `password` stored as `integer` (not a password hash).
- No auth, refresh-token, validation-code, consultation, medical-record,
  pre-consult or audit tables.
- Foreign keys declared `NOT VALID`.
- Plain `timestamp` without time zone.
