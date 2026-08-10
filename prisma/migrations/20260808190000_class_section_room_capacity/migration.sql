-- AlterTable
ALTER TABLE "class_sections" ADD COLUMN IF NOT EXISTS "room_no" TEXT;
ALTER TABLE "class_sections" ADD COLUMN IF NOT EXISTS "capacity" INTEGER;
