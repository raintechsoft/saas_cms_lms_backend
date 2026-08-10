-- CreateEnum
CREATE TYPE "SmsTemplateType" AS ENUM ('TRANSACTIONAL', 'PROMOTIONAL', 'OTP', 'ALERT', 'GENERAL');

-- CreateEnum
CREATE TYPE "SmsDeliveryStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "sms_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SmsTemplateType" NOT NULL DEFAULT 'GENERAL',
    "body" TEXT NOT NULL,
    "provider_code" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_delivery_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "to_number" TEXT NOT NULL,
    "body_preview" TEXT NOT NULL,
    "status" "SmsDeliveryStatus" NOT NULL DEFAULT 'SUCCESS',
    "provider" TEXT,
    "category" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sms_templates_tenant_id_is_active_sort_order_idx" ON "sms_templates"("tenant_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "sms_templates_tenant_id_name_key" ON "sms_templates"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "sms_delivery_logs_tenant_id_created_at_idx" ON "sms_delivery_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "sms_delivery_logs_tenant_id_status_created_at_idx" ON "sms_delivery_logs"("tenant_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_delivery_logs" ADD CONSTRAINT "sms_delivery_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
