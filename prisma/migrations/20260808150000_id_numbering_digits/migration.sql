-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "admission_number_digits" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "staff_number_digits" INTEGER NOT NULL DEFAULT 4;
