-- CreateEnum
CREATE TYPE "EmailEncryption" AS ENUM ('NONE', 'STARTTLS', 'SSL');

-- CreateEnum
CREATE TYPE "EmailTemplateType" AS ENUM ('TRANSACTIONAL', 'PROMOTIONAL', 'SYSTEM', 'GENERAL');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "email_gateways" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 587,
    "encryption" "EmailEncryption" NOT NULL DEFAULT 'STARTTLS',
    "username" TEXT NOT NULL,
    "encrypted_secrets" TEXT,
    "from_email" TEXT NOT NULL,
    "from_name" TEXT,
    "reply_to_email" TEXT,
    "cc_email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "balance_credits" INTEGER NOT NULL DEFAULT 0,
    "last_test_status" TEXT,
    "last_tested_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_gateways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EmailTemplateType" NOT NULL DEFAULT 'GENERAL',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_delivery_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "to_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_preview" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'SUCCESS',
    "gateway_name" TEXT,
    "category" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_gateways_tenant_id_is_active_is_default_idx" ON "email_gateways"("tenant_id", "is_active", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "email_gateways_tenant_id_name_key" ON "email_gateways"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "email_templates_tenant_id_is_active_sort_order_idx" ON "email_templates"("tenant_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_tenant_id_name_key" ON "email_templates"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "email_delivery_logs_tenant_id_created_at_idx" ON "email_delivery_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "email_delivery_logs_tenant_id_status_created_at_idx" ON "email_delivery_logs"("tenant_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "email_gateways" ADD CONSTRAINT "email_gateways_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_delivery_logs" ADD CONSTRAINT "email_delivery_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
