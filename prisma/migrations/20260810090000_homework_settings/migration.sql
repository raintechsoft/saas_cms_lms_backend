-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "HomeworkLatePenaltyType" AS ENUM ('PERCENT_MARKS', 'FIXED_MARKS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "HomeworkSubmissionStartMode" AS ENUM ('ASSIGNMENT_DATETIME', 'NEXT_DAY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "HomeworkDueDateBehavior" AS ENUM ('BLOCK', 'ALLOW_WITH_PENALTY', 'ALLOW');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "HomeworkReminderUnit" AS ENUM ('DAYS', 'DAY_BEFORE', 'HOURS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "HomeworkAutoReminderMode" AS ENUM ('NONE', 'EMAIL_SMS', 'EMAIL', 'SMS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "tenant_homework_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "module_enabled" BOOLEAN NOT NULL DEFAULT true,
    "allow_teachers_assign" BOOLEAN NOT NULL DEFAULT true,
    "allow_attachments" BOOLEAN NOT NULL DEFAULT true,
    "allow_online_submission" BOOLEAN NOT NULL DEFAULT true,
    "allow_late_submission" BOOLEAN NOT NULL DEFAULT false,
    "late_penalty_value" DECIMAL(8,2) NOT NULL DEFAULT 10,
    "late_penalty_type" "HomeworkLatePenaltyType" NOT NULL DEFAULT 'PERCENT_MARKS',
    "allow_portal_view" BOOLEAN NOT NULL DEFAULT true,
    "submission_starts_from" "HomeworkSubmissionStartMode" NOT NULL DEFAULT 'ASSIGNMENT_DATETIME',
    "due_date_behavior" "HomeworkDueDateBehavior" NOT NULL DEFAULT 'BLOCK',
    "grace_days" INTEGER NOT NULL DEFAULT 0,
    "reminder_before_value" INTEGER NOT NULL DEFAULT 1,
    "reminder_before_unit" "HomeworkReminderUnit" NOT NULL DEFAULT 'DAY_BEFORE',
    "auto_reminder_mode" "HomeworkAutoReminderMode" NOT NULL DEFAULT 'EMAIL_SMS',
    "max_file_size_mb" INTEGER NOT NULL DEFAULT 10,
    "allowed_file_types" TEXT[] DEFAULT ARRAY['PDF','DOC','DOCX','JPG','PNG']::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_homework_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "homework_types" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "homework_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "homework_workflow_statuses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366F1',
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "homework_workflow_statuses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_homework_settings_tenant_id_key" ON "tenant_homework_settings"("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "homework_types_tenant_id_name_key" ON "homework_types"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "homework_types_tenant_id_sort_order_idx" ON "homework_types"("tenant_id", "sort_order");
CREATE UNIQUE INDEX IF NOT EXISTS "homework_workflow_statuses_tenant_id_name_key" ON "homework_workflow_statuses"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "homework_workflow_statuses_tenant_id_sort_order_idx" ON "homework_workflow_statuses"("tenant_id", "sort_order");

DO $$ BEGIN
  ALTER TABLE "tenant_homework_settings" ADD CONSTRAINT "tenant_homework_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "homework_types" ADD CONSTRAINT "homework_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "homework_workflow_statuses" ADD CONSTRAINT "homework_workflow_statuses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
