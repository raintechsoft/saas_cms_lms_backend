-- CreateEnum
CREATE TYPE "DataImportStatus" AS ENUM ('COMPLETED', 'FAILED', 'PROCESSING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DataImportDuplicateMode" AS ENUM ('SKIP', 'UPDATE', 'REPLACE');

-- CreateTable
CREATE TABLE "data_import_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "module_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "status" "DataImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "duplicate_mode" "DataImportDuplicateMode" NOT NULL DEFAULT 'SKIP',
    "encoding" TEXT NOT NULL DEFAULT 'UTF-8',
    "has_headers" BOOLEAN NOT NULL DEFAULT true,
    "skip_blank_rows" BOOLEAN NOT NULL DEFAULT true,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "success_rows" INTEGER NOT NULL DEFAULT 0,
    "failed_rows" INTEGER NOT NULL DEFAULT 0,
    "column_mapping" JSONB,
    "error_message" TEXT,
    "created_by_label" TEXT NOT NULL DEFAULT 'Admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "data_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_import_jobs_tenant_id_created_at_idx" ON "data_import_jobs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "data_import_jobs_tenant_id_module_key_status_idx" ON "data_import_jobs"("tenant_id", "module_key", "status");

-- AddForeignKey
ALTER TABLE "data_import_jobs" ADD CONSTRAINT "data_import_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
