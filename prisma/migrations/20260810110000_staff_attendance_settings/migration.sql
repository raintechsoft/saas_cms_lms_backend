-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "HolidayKind" AS ENUM ('MANDATORY', 'OPTIONAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable holidays
ALTER TABLE "holidays" ADD COLUMN IF NOT EXISTS "kind" "HolidayKind" NOT NULL DEFAULT 'MANDATORY';
ALTER TABLE "holidays" ADD COLUMN IF NOT EXISTS "repeats_annually" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE IF NOT EXISTS "staff_work_shifts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "staff_work_shifts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tenant_staff_attendance_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "module_enabled" BOOLEAN NOT NULL DEFAULT true,
    "marking_mode" TEXT NOT NULL DEFAULT 'WEB_MOBILE',
    "allow_manual" BOOLEAN NOT NULL DEFAULT true,
    "allow_self_check_in" BOOLEAN NOT NULL DEFAULT true,
    "allow_self_check_out" BOOLEAN NOT NULL DEFAULT true,
    "show_office_location" BOOLEAN NOT NULL DEFAULT true,
    "require_remarks_manual" BOOLEAN NOT NULL DEFAULT false,
    "half_day_as" TEXT NOT NULL DEFAULT 'HALF_DAY',
    "color_scheme" TEXT NOT NULL DEFAULT 'purple',
    "default_shift_id" TEXT,
    "working_days" INTEGER[] DEFAULT ARRAY[1,2,3,4,5]::INTEGER[],
    "weekly_off_days" INTEGER[] DEFAULT ARRAY[0,6]::INTEGER[],
    "work_from" TEXT NOT NULL DEFAULT '09:00',
    "work_to" TEXT NOT NULL DEFAULT '18:00',
    "break_minutes" INTEGER NOT NULL DEFAULT 60,
    "grace_before_minutes" INTEGER NOT NULL DEFAULT 15,
    "grace_after_minutes" INTEGER NOT NULL DEFAULT 15,
    "late_after_minutes" INTEGER NOT NULL DEFAULT 15,
    "early_leaving_minutes" INTEGER NOT NULL DEFAULT 15,
    "half_day_after_minutes" INTEGER NOT NULL DEFAULT 240,
    "overtime_mode" TEXT NOT NULL DEFAULT 'AFTER_OFFICE',
    "min_full_day_minutes" INTEGER NOT NULL DEFAULT 480,
    "mark_absent_weekly_off" BOOLEAN NOT NULL DEFAULT false,
    "mark_absent_holiday" BOOLEAN NOT NULL DEFAULT false,
    "auto_apply_approved_leave" BOOLEAN NOT NULL DEFAULT true,
    "auto_mark_holiday" BOOLEAN NOT NULL DEFAULT true,
    "leave_day_counting" TEXT NOT NULL DEFAULT 'EXCLUDE_OFF_HOLIDAY',
    "absent_marking_type" TEXT NOT NULL DEFAULT 'FULL_DAY',
    "cd_on_weekly_off" BOOLEAN NOT NULL DEFAULT false,
    "location_tracking" BOOLEAN NOT NULL DEFAULT true,
    "attendance_radius_meters" INTEGER NOT NULL DEFAULT 100,
    "allow_check_in_outside" BOOLEAN NOT NULL DEFAULT false,
    "allow_check_out_outside" BOOLEAN NOT NULL DEFAULT false,
    "restrict_multiple_login" BOOLEAN NOT NULL DEFAULT true,
    "device_restriction" TEXT NOT NULL DEFAULT 'ANY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_staff_attendance_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "staff_work_shifts_tenant_id_name_key" ON "staff_work_shifts"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "staff_work_shifts_tenant_id_is_active_idx" ON "staff_work_shifts"("tenant_id", "is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_staff_attendance_settings_tenant_id_key" ON "tenant_staff_attendance_settings"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "staff_work_shifts" ADD CONSTRAINT "staff_work_shifts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "tenant_staff_attendance_settings" ADD CONSTRAINT "tenant_staff_attendance_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "tenant_staff_attendance_settings" ADD CONSTRAINT "tenant_staff_attendance_settings_default_shift_id_fkey" FOREIGN KEY ("default_shift_id") REFERENCES "staff_work_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
