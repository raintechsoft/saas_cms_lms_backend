-- AlterTable
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "is_paid" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "applicable_to" TEXT NOT NULL DEFAULT 'ALL';
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "carry_forward" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "encashment_allowed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "gender_applicability" TEXT NOT NULL DEFAULT 'ALL';
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "allocation_method" TEXT NOT NULL DEFAULT 'YEARLY';
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "allocation_frequency" TEXT NOT NULL DEFAULT 'ON_ANNIVERSARY';
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "default_allocation_days" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "accrual_rate" DECIMAL(8,2) NOT NULL DEFAULT 1;
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "accrual_based" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "effective_from" DATE;
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "restriction" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "require_approval" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "apply_on_weekends" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "apply_on_holidays" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "allow_half_day" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "minimum_notice_days" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "document_required" TEXT NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "staff_leave_types" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill codes for existing rows
UPDATE "staff_leave_types"
SET "code" = UPPER(LEFT(REGEXP_REPLACE(COALESCE(name, 'LEAVE'), '[^A-Za-z0-9]', '', 'g'), 6))
WHERE "code" IS NULL OR "code" = '';

CREATE INDEX IF NOT EXISTS "staff_leave_types_tenant_id_code_idx"
  ON "staff_leave_types"("tenant_id", "code");

CREATE INDEX IF NOT EXISTS "staff_leave_types_tenant_id_is_active_idx"
  ON "staff_leave_types"("tenant_id", "is_active");
