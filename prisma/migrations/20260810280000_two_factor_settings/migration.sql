-- CreateTable
CREATE TABLE "tenant_two_factor_settings" (
    "tenant_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "method_totp" BOOLEAN NOT NULL DEFAULT true,
    "method_sms" BOOLEAN NOT NULL DEFAULT true,
    "method_email" BOOLEAN NOT NULL DEFAULT false,
    "method_backup_codes" BOOLEAN NOT NULL DEFAULT true,
    "enforced_role_codes" JSONB NOT NULL DEFAULT '["INSTITUTION_ADMIN","STAFF","TEACHER"]',
    "optional_role_codes" JSONB NOT NULL DEFAULT '["STUDENT","PARENT"]',
    "grace_period_days" INTEGER NOT NULL DEFAULT 7,
    "require_on_new_devices" BOOLEAN NOT NULL DEFAULT true,
    "remember_device_days" INTEGER NOT NULL DEFAULT 30,
    "max_attempts_without_2fa" INTEGER NOT NULL DEFAULT 3,
    "generate_backup_codes" BOOLEAN NOT NULL DEFAULT true,
    "backup_codes_count" INTEGER NOT NULL DEFAULT 10,
    "totp_issuer" TEXT NOT NULL DEFAULT 'Campus ERP',
    "sms_code_expiry_seconds" INTEGER NOT NULL DEFAULT 300,
    "email_code_expiry_seconds" INTEGER NOT NULL DEFAULT 600,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_two_factor_settings_pkey" PRIMARY KEY ("tenant_id")
);

-- AddForeignKey
ALTER TABLE "tenant_two_factor_settings" ADD CONSTRAINT "tenant_two_factor_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
