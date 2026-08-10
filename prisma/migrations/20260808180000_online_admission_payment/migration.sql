-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "online_admission_require_payment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "online_admission_fee_type_id" TEXT;
