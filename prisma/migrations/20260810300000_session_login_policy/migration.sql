-- CreateEnum
CREATE TYPE "LoginActivityStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "tenant_session_login_policies" (
    "tenant_id" TEXT NOT NULL,
    "session_timeout_minutes" INTEGER NOT NULL DEFAULT 30,
    "warning_before_logout_minutes" INTEGER NOT NULL DEFAULT 5,
    "force_logout_other_devices" BOOLEAN NOT NULL DEFAULT true,
    "remember_me_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_logout_on_browser_close" BOOLEAN NOT NULL DEFAULT false,
    "max_login_attempts" INTEGER NOT NULL DEFAULT 5,
    "lockout_duration_minutes" INTEGER NOT NULL DEFAULT 15,
    "lock_account_after_max_attempts" BOOLEAN NOT NULL DEFAULT true,
    "notify_admin_on_lock" BOOLEAN NOT NULL DEFAULT true,
    "captcha_on_login" BOOLEAN NOT NULL DEFAULT false,
    "min_password_length" INTEGER NOT NULL DEFAULT 8,
    "require_uppercase" BOOLEAN NOT NULL DEFAULT true,
    "require_lowercase" BOOLEAN NOT NULL DEFAULT true,
    "require_numbers" BOOLEAN NOT NULL DEFAULT true,
    "require_special_chars" BOOLEAN NOT NULL DEFAULT true,
    "password_expiry_days" INTEGER NOT NULL DEFAULT 90,
    "prevent_password_reuse_last" INTEGER NOT NULL DEFAULT 5,
    "allowed_ip_addresses" TEXT,
    "blocked_ip_addresses" TEXT,
    "restrict_to_allowed_ips" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_session_login_policies_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "user_login_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_name" TEXT NOT NULL,
    "user_email" TEXT,
    "role_label" TEXT NOT NULL,
    "device_label" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "last_active_at" TIMESTAMP(3) NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_login_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_activity_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_name" TEXT NOT NULL,
    "status" "LoginActivityStatus" NOT NULL DEFAULT 'SUCCESS',
    "ip_address" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "device_label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_login_sessions_tenant_id_last_active_at_idx" ON "user_login_sessions"("tenant_id", "last_active_at");

-- CreateIndex
CREATE INDEX "login_activity_logs_tenant_id_created_at_idx" ON "login_activity_logs"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "tenant_session_login_policies" ADD CONSTRAINT "tenant_session_login_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_login_sessions" ADD CONSTRAINT "user_login_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_activity_logs" ADD CONSTRAINT "login_activity_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
