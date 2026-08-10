-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PeriodNumberingMode" AS ENUM ('CONTINUOUS', 'RESET_AFTER_BREAKS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable tenant_settings
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "working_days" "Weekday"[] DEFAULT ARRAY['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']::"Weekday"[];
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "default_period_duration" INTEGER NOT NULL DEFAULT 45;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "first_period_starts_at" TEXT NOT NULL DEFAULT '08:00';
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "last_period_ends_at" TEXT NOT NULL DEFAULT '15:30';
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "period_numbering_mode" "PeriodNumberingMode" NOT NULL DEFAULT 'CONTINUOUS';
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "allow_period_overlap" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "enable_double_period" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE IF NOT EXISTS "timetable_periods" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_break" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "timetable_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "timetable_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "working_days" "Weekday"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "timetable_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "timetable_template_classes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "timetable_template_classes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "timetable_periods_tenant_id_sort_order_idx" ON "timetable_periods"("tenant_id", "sort_order");
CREATE UNIQUE INDEX IF NOT EXISTS "timetable_templates_tenant_id_name_key" ON "timetable_templates"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "timetable_templates_tenant_id_is_active_idx" ON "timetable_templates"("tenant_id", "is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "timetable_template_classes_template_id_class_id_key" ON "timetable_template_classes"("template_id", "class_id");
CREATE INDEX IF NOT EXISTS "timetable_template_classes_tenant_id_class_id_idx" ON "timetable_template_classes"("tenant_id", "class_id");

DO $$ BEGIN
  ALTER TABLE "timetable_periods" ADD CONSTRAINT "timetable_periods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "timetable_templates" ADD CONSTRAINT "timetable_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "timetable_template_classes" ADD CONSTRAINT "timetable_template_classes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "timetable_template_classes" ADD CONSTRAINT "timetable_template_classes_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "timetable_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "timetable_template_classes" ADD CONSTRAINT "timetable_template_classes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "academic_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
