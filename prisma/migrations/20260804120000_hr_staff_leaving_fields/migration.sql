-- AlterTable
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "absence_deduction" DECIMAL(12,2);
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "leaving_date" DATE;
ALTER TABLE "staff_profiles" ADD COLUMN IF NOT EXISTS "resignation_letter" TEXT;
