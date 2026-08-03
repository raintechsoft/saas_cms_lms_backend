-- AlterTable
ALTER TABLE "academic_classes" ADD COLUMN IF NOT EXISTS "in_time" TEXT;
ALTER TABLE "academic_classes" ADD COLUMN IF NOT EXISTS "half_day_time" TEXT;
ALTER TABLE "academic_classes" ADD COLUMN IF NOT EXISTS "out_time" TEXT;

-- AlterTable
ALTER TABLE "school_scholars" ADD COLUMN IF NOT EXISTS "final_percent" DECIMAL(5,2);