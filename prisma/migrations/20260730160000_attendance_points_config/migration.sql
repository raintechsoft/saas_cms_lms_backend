-- Attendance points configuration on tenant settings
ALTER TABLE "tenant_settings"
  ADD COLUMN IF NOT EXISTS "attendance_present_points" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "attendance_half_day_points" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "attendance_late_points" INTEGER NOT NULL DEFAULT -1;
