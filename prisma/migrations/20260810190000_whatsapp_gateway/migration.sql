-- AlterEnum
ALTER TYPE "ErpSettingCategory" ADD VALUE 'WHATSAPP';

-- CreateEnum
CREATE TYPE "WhatsAppTemplateStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WhatsAppDeliveryStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "whatsapp_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "category" TEXT NOT NULL DEFAULT 'UTILITY',
    "body" TEXT NOT NULL,
    "status" "WhatsAppTemplateStatus" NOT NULL DEFAULT 'PENDING',
    "provider_code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_delivery_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "to_number" TEXT NOT NULL,
    "body_preview" TEXT NOT NULL,
    "status" "WhatsAppDeliveryStatus" NOT NULL DEFAULT 'SENT',
    "category" TEXT,
    "error_message" TEXT,
    "charge_paise" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_templates_tenant_id_status_sort_order_idx" ON "whatsapp_templates"("tenant_id", "status", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_templates_tenant_id_name_language_key" ON "whatsapp_templates"("tenant_id", "name", "language");

-- CreateIndex
CREATE INDEX "whatsapp_delivery_logs_tenant_id_created_at_idx" ON "whatsapp_delivery_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_delivery_logs_tenant_id_status_created_at_idx" ON "whatsapp_delivery_logs"("tenant_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_delivery_logs" ADD CONSTRAINT "whatsapp_delivery_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
