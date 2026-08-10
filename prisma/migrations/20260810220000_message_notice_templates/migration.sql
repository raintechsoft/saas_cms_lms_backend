-- CreateEnum
CREATE TYPE "MessageNoticeTemplateType" AS ENUM ('MESSAGE', 'NOTICE', 'EMAIL');

-- CreateTable
CREATE TABLE "message_notice_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "MessageNoticeTemplateType" NOT NULL DEFAULT 'MESSAGE',
    "category" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "channel_whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "channel_sms" BOOLEAN NOT NULL DEFAULT false,
    "channel_push" BOOLEAN NOT NULL DEFAULT false,
    "channel_email" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "used_in_triggers" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_notice_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_notice_templates_tenant_id_type_is_active_idx" ON "message_notice_templates"("tenant_id", "type", "is_active");

-- CreateIndex
CREATE INDEX "message_notice_templates_tenant_id_sort_order_idx" ON "message_notice_templates"("tenant_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "message_notice_templates_tenant_id_key_key" ON "message_notice_templates"("tenant_id", "key");

-- AddForeignKey
ALTER TABLE "message_notice_templates" ADD CONSTRAINT "message_notice_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
