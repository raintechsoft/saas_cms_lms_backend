-- CreateEnum
CREATE TYPE "NotificationTriggerModule" AS ENUM ('ADMISSION', 'FEES', 'ACADEMICS', 'EXAMINATIONS', 'ATTENDANCE', 'HR', 'GENERAL');

-- CreateEnum
CREATE TYPE "NotificationTriggerPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "NotificationTriggerSendTiming" AS ENUM ('IMMEDIATELY', 'SCHEDULED', 'QUIET_HOURS');

-- CreateEnum
CREATE TYPE "NotificationTriggerLogStatus" AS ENUM ('SENT', 'DELIVERED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "notification_triggers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module" "NotificationTriggerModule" NOT NULL,
    "event_key" TEXT NOT NULL,
    "event_label" TEXT NOT NULL,
    "priority" "NotificationTriggerPriority" NOT NULL DEFAULT 'MEDIUM',
    "send_timing" "NotificationTriggerSendTiming" NOT NULL DEFAULT 'IMMEDIATELY',
    "channel_whatsapp" BOOLEAN NOT NULL DEFAULT true,
    "channel_email" BOOLEAN NOT NULL DEFAULT true,
    "channel_push" BOOLEAN NOT NULL DEFAULT true,
    "channel_sms" BOOLEAN NOT NULL DEFAULT false,
    "recipient_student" BOOLEAN NOT NULL DEFAULT true,
    "recipient_parent" BOOLEAN NOT NULL DEFAULT true,
    "recipient_staff" BOOLEAN NOT NULL DEFAULT false,
    "message_subject" TEXT,
    "message_body" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_scheduled_today" BOOLEAN NOT NULL DEFAULT false,
    "week_sent_count" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_trigger_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "trigger_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "status" "NotificationTriggerLogStatus" NOT NULL DEFAULT 'SENT',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_trigger_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_triggers_tenant_id_module_is_active_idx" ON "notification_triggers"("tenant_id", "module", "is_active");

-- CreateIndex
CREATE INDEX "notification_triggers_tenant_id_sort_order_idx" ON "notification_triggers"("tenant_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "notification_triggers_tenant_id_key_key" ON "notification_triggers"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "notification_trigger_logs_tenant_id_created_at_idx" ON "notification_trigger_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_trigger_logs_tenant_id_channel_created_at_idx" ON "notification_trigger_logs"("tenant_id", "channel", "created_at");

-- CreateIndex
CREATE INDEX "notification_trigger_logs_trigger_id_created_at_idx" ON "notification_trigger_logs"("trigger_id", "created_at");

-- AddForeignKey
ALTER TABLE "notification_triggers" ADD CONSTRAINT "notification_triggers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_trigger_logs" ADD CONSTRAINT "notification_trigger_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_trigger_logs" ADD CONSTRAINT "notification_trigger_logs_trigger_id_fkey" FOREIGN KEY ("trigger_id") REFERENCES "notification_triggers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
