-- AlterTable
ALTER TABLE "tenant_question_bank_settings"
ADD COLUMN IF NOT EXISTS "allow_teachers_to_add_questions" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "QuestionSource" AS ENUM ('MANUAL', 'NCERT', 'AI_GENERATED', 'IMPORTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "QuestionMediaType" AS ENUM ('IMAGE', 'AUDIO', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "QuestionUsageContext" AS ENUM ('EXAM_PAPER', 'TEST_SERIES');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "question_type_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_marks" DECIMAL(6,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "question_type_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "difficulty_level_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color_tag" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "difficulty_level_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "question_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_category_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "question_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bank_questions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "class_id" TEXT,
    "category_id" TEXT,
    "question_type_id" TEXT NOT NULL,
    "difficulty_level_id" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "QuestionSource" NOT NULL DEFAULT 'MANUAL',
    "question_text" TEXT NOT NULL,
    "explanation" TEXT,
    "marks" DECIMAL(6,2) NOT NULL,
    "negative_marks" DECIMAL(6,2),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by_id" TEXT NOT NULL,
    "reviewed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "bank_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bank_question_options" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "option_text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "media_url" TEXT,
    CONSTRAINT "bank_question_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bank_question_media" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "QuestionMediaType" NOT NULL,
    "alt_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_question_media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bank_question_usage_logs" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "context" "QuestionUsageContext" NOT NULL,
    "ref_id" TEXT NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_question_usage_logs_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "question_type_configs_tenant_id_name_key" ON "question_type_configs"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "question_type_configs_tenant_id_sort_order_idx" ON "question_type_configs"("tenant_id", "sort_order");
CREATE UNIQUE INDEX IF NOT EXISTS "difficulty_level_configs_tenant_id_name_key" ON "difficulty_level_configs"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "difficulty_level_configs_tenant_id_sort_order_idx" ON "difficulty_level_configs"("tenant_id", "sort_order");
CREATE INDEX IF NOT EXISTS "question_categories_tenant_id_subject_id_idx" ON "question_categories"("tenant_id", "subject_id");
CREATE INDEX IF NOT EXISTS "question_categories_parent_category_id_idx" ON "question_categories"("parent_category_id");
CREATE INDEX IF NOT EXISTS "bank_questions_tenant_id_subject_id_status_idx" ON "bank_questions"("tenant_id", "subject_id", "status");
CREATE INDEX IF NOT EXISTS "bank_questions_tenant_id_category_id_idx" ON "bank_questions"("tenant_id", "category_id");
CREATE INDEX IF NOT EXISTS "bank_questions_tenant_id_difficulty_level_id_idx" ON "bank_questions"("tenant_id", "difficulty_level_id");
CREATE INDEX IF NOT EXISTS "bank_questions_tenant_id_created_by_id_idx" ON "bank_questions"("tenant_id", "created_by_id");
CREATE INDEX IF NOT EXISTS "bank_questions_tenant_id_deleted_at_idx" ON "bank_questions"("tenant_id", "deleted_at");
CREATE INDEX IF NOT EXISTS "bank_question_options_question_id_sort_order_idx" ON "bank_question_options"("question_id", "sort_order");
CREATE INDEX IF NOT EXISTS "bank_question_media_question_id_idx" ON "bank_question_media"("question_id");
CREATE INDEX IF NOT EXISTS "bank_question_usage_logs_question_id_idx" ON "bank_question_usage_logs"("question_id");
CREATE INDEX IF NOT EXISTS "bank_question_usage_logs_context_ref_id_idx" ON "bank_question_usage_logs"("context", "ref_id");

-- ForeignKeys
DO $$ BEGIN
  ALTER TABLE "question_type_configs" ADD CONSTRAINT "question_type_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "difficulty_level_configs" ADD CONSTRAINT "difficulty_level_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "question_categories" ADD CONSTRAINT "question_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "question_categories" ADD CONSTRAINT "question_categories_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "question_categories" ADD CONSTRAINT "question_categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "question_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "academic_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "question_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_question_type_id_fkey" FOREIGN KEY ("question_type_id") REFERENCES "question_type_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_difficulty_level_id_fkey" FOREIGN KEY ("difficulty_level_id") REFERENCES "difficulty_level_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bank_question_options" ADD CONSTRAINT "bank_question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "bank_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bank_question_media" ADD CONSTRAINT "bank_question_media_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "bank_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bank_question_usage_logs" ADD CONSTRAINT "bank_question_usage_logs_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "bank_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
