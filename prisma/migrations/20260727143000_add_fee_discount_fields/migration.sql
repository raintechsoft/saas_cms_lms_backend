-- AlterTable
ALTER TABLE "fee_discounts" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "fee_discounts" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "fee_discounts" ADD COLUMN IF NOT EXISTS "description" TEXT;
