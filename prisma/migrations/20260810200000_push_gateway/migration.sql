-- CreateEnum
CREATE TYPE "PushDeliveryStatus" AS ENUM ('SENT', 'DELIVERED', 'FAILED', 'PENDING');

-- CreateTable
CREATE TABLE "push_topics" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subscriber_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_delivery_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body_preview" TEXT NOT NULL,
    "topic_key" TEXT,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "status" "PushDeliveryStatus" NOT NULL DEFAULT 'SENT',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "push_topics_tenant_id_is_active_sort_order_idx" ON "push_topics"("tenant_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "push_topics_tenant_id_key_key" ON "push_topics"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "push_delivery_logs_tenant_id_created_at_idx" ON "push_delivery_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "push_delivery_logs_tenant_id_status_created_at_idx" ON "push_delivery_logs"("tenant_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "push_topics" ADD CONSTRAINT "push_topics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_delivery_logs" ADD CONSTRAINT "push_delivery_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
