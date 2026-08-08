-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "OnlineExamStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "OnlineQuestionType" AS ENUM ('MCQ', 'SUBJECTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "OnlineAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "online_exams" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "academic_session_id" TEXT,
    "class_section_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "pass_marks" INTEGER NOT NULL DEFAULT 0,
    "status" "OnlineExamStatus" NOT NULL DEFAULT 'DRAFT',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "online_exams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "online_exam_questions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "type" "OnlineQuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB,
    "correct_option" INTEGER,
    "marks" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "online_exam_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "online_exam_attempts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "attempt_no" INTEGER NOT NULL DEFAULT 1,
    "status" "OnlineAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "score" DECIMAL(10,2),
    "max_score" DECIMAL(10,2),
    "rank" INTEGER,
    "graded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "online_exam_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "online_exam_answers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "selected_option" INTEGER,
    "text_answer" TEXT,
    "marks_awarded" DECIMAL(10,2),
    "is_correct" BOOLEAN,
    "graded_at" TIMESTAMP(3),
    "graded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "online_exam_answers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "online_exams_tenant_id_status_is_active_idx" ON "online_exams"("tenant_id", "status", "is_active");
CREATE INDEX IF NOT EXISTS "online_exams_tenant_id_title_idx" ON "online_exams"("tenant_id", "title");
CREATE INDEX IF NOT EXISTS "online_exam_questions_tenant_id_exam_id_sort_order_idx" ON "online_exam_questions"("tenant_id", "exam_id", "sort_order");
CREATE UNIQUE INDEX IF NOT EXISTS "online_exam_attempts_tenant_id_exam_id_student_id_attempt_no_key" ON "online_exam_attempts"("tenant_id", "exam_id", "student_id", "attempt_no");
CREATE INDEX IF NOT EXISTS "online_exam_attempts_tenant_id_exam_id_status_idx" ON "online_exam_attempts"("tenant_id", "exam_id", "status");
CREATE INDEX IF NOT EXISTS "online_exam_attempts_tenant_id_student_id_idx" ON "online_exam_attempts"("tenant_id", "student_id");
CREATE UNIQUE INDEX IF NOT EXISTS "online_exam_answers_attempt_id_question_id_key" ON "online_exam_answers"("attempt_id", "question_id");
CREATE INDEX IF NOT EXISTS "online_exam_answers_tenant_id_question_id_idx" ON "online_exam_answers"("tenant_id", "question_id");

DO $$ BEGIN
  ALTER TABLE "online_exams" ADD CONSTRAINT "online_exams_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "online_exams" ADD CONSTRAINT "online_exams_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "online_exams" ADD CONSTRAINT "online_exams_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "online_exams" ADD CONSTRAINT "online_exams_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "online_exam_questions" ADD CONSTRAINT "online_exam_questions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "online_exam_questions" ADD CONSTRAINT "online_exam_questions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "online_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "online_exam_attempts" ADD CONSTRAINT "online_exam_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "online_exam_attempts" ADD CONSTRAINT "online_exam_attempts_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "online_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "online_exam_attempts" ADD CONSTRAINT "online_exam_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "online_exam_attempts" ADD CONSTRAINT "online_exam_attempts_graded_by_id_fkey" FOREIGN KEY ("graded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "online_exam_answers" ADD CONSTRAINT "online_exam_answers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "online_exam_answers" ADD CONSTRAINT "online_exam_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "online_exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "online_exam_answers" ADD CONSTRAINT "online_exam_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "online_exam_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "online_exam_answers" ADD CONSTRAINT "online_exam_answers_graded_by_id_fkey" FOREIGN KEY ("graded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;