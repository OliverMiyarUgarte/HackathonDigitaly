-- AlterTable
ALTER TABLE "consultations" ADD COLUMN     "doctor_summary" TEXT,
ADD COLUMN     "patient_summary" TEXT,
ADD COLUMN     "summary_generated_at" TIMESTAMPTZ(6);
