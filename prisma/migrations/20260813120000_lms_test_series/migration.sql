-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TestSeriesStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "test_series" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject_id" TEXT,
    "class_id" TEXT,
    "status" "TestSeriesStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "test_series_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "test_series_papers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "series_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "pass_marks" DECIMAL(8,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "TestSeriesStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "test_series_papers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "test_series_paper_questions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "paper_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "marks" DECIMAL(6,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "test_series_paper_questions_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "test_series_tenant_id_status_idx" ON "test_series"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "test_series_tenant_id_subject_id_idx" ON "test_series"("tenant_id", "subject_id");
CREATE INDEX IF NOT EXISTS "test_series_tenant_id_created_at_idx" ON "test_series"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "test_series_papers_tenant_id_series_id_sort_order_idx" ON "test_series_papers"("tenant_id", "series_id", "sort_order");
CREATE INDEX IF NOT EXISTS "test_series_papers_tenant_id_status_idx" ON "test_series_papers"("tenant_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "test_series_paper_questions_paper_id_question_id_key" ON "test_series_paper_questions"("paper_id", "question_id");
CREATE INDEX IF NOT EXISTS "test_series_paper_questions_tenant_id_paper_id_sort_order_idx" ON "test_series_paper_questions"("tenant_id", "paper_id", "sort_order");
CREATE INDEX IF NOT EXISTS "test_series_paper_questions_question_id_idx" ON "test_series_paper_questions"("question_id");

-- ForeignKeys
DO $$ BEGIN
  ALTER TABLE "test_series" ADD CONSTRAINT "test_series_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "test_series" ADD CONSTRAINT "test_series_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "test_series" ADD CONSTRAINT "test_series_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "academic_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "test_series" ADD CONSTRAINT "test_series_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "test_series_papers" ADD CONSTRAINT "test_series_papers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "test_series_papers" ADD CONSTRAINT "test_series_papers_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "test_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "test_series_paper_questions" ADD CONSTRAINT "test_series_paper_questions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "test_series_paper_questions" ADD CONSTRAINT "test_series_paper_questions_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "test_series_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "test_series_paper_questions" ADD CONSTRAINT "test_series_paper_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "bank_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
