-- AlterTable
ALTER TABLE "fee_masters" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "fee_masters_tenant_id_academic_session_id_sort_order_idx" ON "fee_masters"("tenant_id", "academic_session_id", "sort_order");
