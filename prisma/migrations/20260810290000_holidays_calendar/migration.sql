-- AlterEnum HolidayKind
DO $$ BEGIN
  ALTER TYPE "HolidayKind" ADD VALUE 'RESTRICTED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "HolidayCalendarType" AS ENUM ('GAZETTED', 'OPTIONAL', 'RESTRICTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "HolidayStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "holiday_groups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#7C3AED',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holiday_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tenant_holiday_settings" (
    "tenant_id" TEXT NOT NULL,
    "sunday_is_holiday" BOOLEAN NOT NULL DEFAULT true,
    "saturday_is_holiday" BOOLEAN NOT NULL DEFAULT false,
    "auto_apply_attendance" BOOLEAN NOT NULL DEFAULT true,
    "notify_parents_on_holiday" BOOLEAN NOT NULL DEFAULT true,
    "show_on_portal" BOOLEAN NOT NULL DEFAULT true,
    "default_calendar_type" "HolidayCalendarType" NOT NULL DEFAULT 'GAZETTED',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_holiday_settings_pkey" PRIMARY KEY ("tenant_id")
);

ALTER TABLE "holidays" ADD COLUMN IF NOT EXISTS "group_id" TEXT;
ALTER TABLE "holidays" ADD COLUMN IF NOT EXISTS "calendar_type" "HolidayCalendarType" NOT NULL DEFAULT 'GAZETTED';
ALTER TABLE "holidays" ADD COLUMN IF NOT EXISTS "status" "HolidayStatus" NOT NULL DEFAULT 'ACTIVE';

UPDATE "holidays"
SET "calendar_type" = CASE
  WHEN "kind"::text = 'OPTIONAL' THEN 'OPTIONAL'::"HolidayCalendarType"
  WHEN "kind"::text = 'RESTRICTED' THEN 'RESTRICTED'::"HolidayCalendarType"
  ELSE 'GAZETTED'::"HolidayCalendarType"
END;

CREATE UNIQUE INDEX IF NOT EXISTS "holiday_groups_tenant_id_name_key" ON "holiday_groups"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "holiday_groups_tenant_id_is_active_idx" ON "holiday_groups"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "holidays_tenant_id_academic_session_id_status_idx" ON "holidays"("tenant_id", "academic_session_id", "status");
CREATE INDEX IF NOT EXISTS "holidays_tenant_id_group_id_idx" ON "holidays"("tenant_id", "group_id");

DO $$ BEGIN
  ALTER TABLE "holiday_groups" ADD CONSTRAINT "holiday_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "tenant_holiday_settings" ADD CONSTRAINT "tenant_holiday_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "holidays" ADD CONSTRAINT "holidays_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "holiday_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
