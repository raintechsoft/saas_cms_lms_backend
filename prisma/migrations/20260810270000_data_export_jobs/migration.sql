-- CreateEnum
CREATE TYPE "DataExportFormat" AS ENUM ('XLSX', 'CSV', 'PDF', 'JSON');

-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "data_export_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "format" "DataExportFormat" NOT NULL DEFAULT 'XLSX',
    "status" "DataExportStatus" NOT NULL DEFAULT 'PROCESSING',
    "module_keys" JSONB NOT NULL,
    "total_records" INTEGER NOT NULL DEFAULT 0,
    "estimated_size_kb" INTEGER NOT NULL DEFAULT 0,
    "include_headers" BOOLEAN NOT NULL DEFAULT true,
    "include_related" BOOLEAN NOT NULL DEFAULT true,
    "active_only" BOOLEAN NOT NULL DEFAULT true,
    "compress_zip" BOOLEAN NOT NULL DEFAULT false,
    "encrypt_password" BOOLEAN NOT NULL DEFAULT false,
    "academic_session_id" TEXT,
    "class_section_id" TEXT,
    "status_filter" TEXT,
    "date_from" DATE,
    "date_to" DATE,
    "error_message" TEXT,
    "created_by_label" TEXT NOT NULL DEFAULT 'Admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "data_export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_export_jobs_tenant_id_created_at_idx" ON "data_export_jobs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "data_export_jobs_tenant_id_status_idx" ON "data_export_jobs"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "data_export_jobs" ADD CONSTRAINT "data_export_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
