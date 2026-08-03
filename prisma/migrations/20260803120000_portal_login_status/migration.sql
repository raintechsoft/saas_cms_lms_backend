-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_login_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_channel" TEXT;

-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "portal_inactive_reminder_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "portal_inactive_reminder_sms" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "portal_inactive_reminder_email" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "portal_inactive_reminder_days" INTEGER NOT NULL DEFAULT 7;
