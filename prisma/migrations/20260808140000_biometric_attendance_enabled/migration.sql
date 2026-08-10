-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "biometric_attendance_enabled" BOOLEAN NOT NULL DEFAULT false;

-- Migrate legacy BIOMETRIC attendance type into day-wise + biometric flag
UPDATE "tenant_settings"
SET
  "attendance_type" = 'DAY_WISE',
  "biometric_attendance_enabled" = true
WHERE "attendance_type" = 'BIOMETRIC';
