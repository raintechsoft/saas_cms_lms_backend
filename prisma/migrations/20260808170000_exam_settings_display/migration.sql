-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ExamResultDisplayType" AS ENUM ('SUBJECT_WISE', 'OVERALL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OnlineExamViewMode" AS ENUM ('AFTER_SUBMISSION', 'AFTER_PUBLISH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "exam_result_display_type" "ExamResultDisplayType" NOT NULL DEFAULT 'SUBJECT_WISE';
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "online_exam_view_mode" "OnlineExamViewMode" NOT NULL DEFAULT 'AFTER_SUBMISSION';
