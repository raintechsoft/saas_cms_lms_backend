-- AlterTable
ALTER TABLE "tenant_fee_settings" ADD COLUMN IF NOT EXISTS "reminder_email_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenant_fee_settings" ADD COLUMN IF NOT EXISTS "reminder_sms_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenant_fee_settings" ADD COLUMN IF NOT EXISTS "reminder_execution_time" TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE "tenant_fee_settings" ADD COLUMN IF NOT EXISTS "reminder_skip_weekends" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenant_fee_settings" ADD COLUMN IF NOT EXISTS "reminder_min_balance" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenant_fee_settings" ADD COLUMN IF NOT EXISTS "reminder_steps" JSONB;
ALTER TABLE "tenant_fee_settings" ADD COLUMN IF NOT EXISTS "last_reminder_run_at" TIMESTAMP(3);
