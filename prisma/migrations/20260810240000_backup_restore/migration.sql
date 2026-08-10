-- CreateEnum
CREATE TYPE "SystemBackupType" AS ENUM ('FULL', 'DATABASE', 'FILES');

-- CreateEnum
CREATE TYPE "SystemBackupStatus" AS ENUM ('SUCCESS', 'FAILED', 'IN_PROGRESS');

-- CreateEnum
CREATE TYPE "BackupScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "system_backups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SystemBackupType" NOT NULL DEFAULT 'FULL',
    "size_bytes" BIGINT NOT NULL DEFAULT 0,
    "status" "SystemBackupStatus" NOT NULL DEFAULT 'SUCCESS',
    "created_by_label" TEXT NOT NULL DEFAULT 'System',
    "configuration_backup_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_schedules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "BackupScheduleFrequency" NOT NULL DEFAULT 'DAILY',
    "time_of_day" TEXT NOT NULL DEFAULT '02:00',
    "backup_type" "SystemBackupType" NOT NULL DEFAULT 'FULL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "next_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backup_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_backup_settings" (
    "tenant_id" TEXT NOT NULL,
    "retention_days" INTEGER NOT NULL DEFAULT 30,
    "primary_location" TEXT NOT NULL DEFAULT 'AWS S3 (us-east-1)',
    "secondary_location" TEXT NOT NULL DEFAULT 'Wasabi Cloud Storage',
    "local_enabled" BOOLEAN NOT NULL DEFAULT true,
    "compress_backups" BOOLEAN NOT NULL DEFAULT true,
    "encrypt_backups" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_success" BOOLEAN NOT NULL DEFAULT false,
    "notify_on_failure" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_backup_settings_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "backup_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_backups_configuration_backup_id_key" ON "system_backups"("configuration_backup_id");

-- CreateIndex
CREATE INDEX "system_backups_tenant_id_created_at_idx" ON "system_backups"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "system_backups_tenant_id_type_status_idx" ON "system_backups"("tenant_id", "type", "status");

-- CreateIndex
CREATE INDEX "backup_schedules_tenant_id_is_active_idx" ON "backup_schedules"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "backup_logs_tenant_id_created_at_idx" ON "backup_logs"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "system_backups" ADD CONSTRAINT "system_backups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_backups" ADD CONSTRAINT "system_backups_configuration_backup_id_fkey" FOREIGN KEY ("configuration_backup_id") REFERENCES "configuration_backups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_schedules" ADD CONSTRAINT "backup_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_backup_settings" ADD CONSTRAINT "tenant_backup_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_logs" ADD CONSTRAINT "backup_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
