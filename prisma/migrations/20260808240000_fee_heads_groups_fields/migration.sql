-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FeeHeadKind" AS ENUM ('MANDATORY', 'ONE_TIME', 'OPTIONAL', 'REFUNDABLE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable fee_types
ALTER TABLE "fee_types" ADD COLUMN IF NOT EXISTS "kind" "FeeHeadKind" NOT NULL DEFAULT 'MANDATORY';
ALTER TABLE "fee_types" ADD COLUMN IF NOT EXISTS "applicable_to" TEXT NOT NULL DEFAULT 'All Classes';
ALTER TABLE "fee_types" ADD COLUMN IF NOT EXISTS "gst_applicable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "fee_types" ADD COLUMN IF NOT EXISTS "default_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable fee_groups
ALTER TABLE "fee_groups" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

-- Deduplicate fee_group_items so each fee type belongs to one group (keep oldest group by name)
DELETE FROM "fee_group_items" a
USING "fee_group_items" b
WHERE a."fee_type_id" = b."fee_type_id"
  AND a."fee_group_id" > b."fee_group_id";

CREATE UNIQUE INDEX IF NOT EXISTS "fee_group_items_fee_type_id_key" ON "fee_group_items"("fee_type_id");
CREATE INDEX IF NOT EXISTS "fee_groups_tenant_id_is_active_idx" ON "fee_groups"("tenant_id", "is_active");
