-- AlterTable
ALTER TABLE "tenant_fee_settings" ADD COLUMN IF NOT EXISTS "allow_duplicate_invoice" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenant_fee_settings" ADD COLUMN IF NOT EXISTS "allow_custom_fee_receipt" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenant_fee_settings" ADD COLUMN IF NOT EXISTS "due_date_wise_fee_ordering" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenant_fee_settings" ADD COLUMN IF NOT EXISTS "fees_due_days" INTEGER NOT NULL DEFAULT 30;
