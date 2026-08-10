-- AlterTable
ALTER TABLE "student_document_folders" ADD COLUMN "description" TEXT,
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "student_document_folders_tenant_id_parent_id_is_active_idx" ON "student_document_folders"("tenant_id", "parent_id", "is_active");

-- CreateIndex
CREATE INDEX "student_document_folders_tenant_id_deleted_at_sort_order_idx" ON "student_document_folders"("tenant_id", "deleted_at", "sort_order");
