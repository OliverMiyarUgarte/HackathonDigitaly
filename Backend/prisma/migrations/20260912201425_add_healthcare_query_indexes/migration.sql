-- DropIndex
DROP INDEX "validation_codes_appointment_id_expires_at_idx";

-- CreateIndex
CREATE INDEX "consultations_started_at_idx" ON "consultations"("started_at" DESC);

-- CreateIndex
CREATE INDEX "users_role_deleted_at_idx" ON "users"("role", "deleted_at");

-- CreateIndex
CREATE INDEX "validation_codes_appointment_id_idx" ON "validation_codes"("appointment_id");

-- CreateIndex
CREATE INDEX "validation_codes_appointment_id_created_at_idx" ON "validation_codes"("appointment_id", "created_at" DESC) WHERE ("consumed_at" IS NULL);
