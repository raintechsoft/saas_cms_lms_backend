-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "QuestionBankScope" AS ENUM ('GLOBAL', 'BY_CLASS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NegativeMarkingApplyTo" AS ENUM ('ALL', 'MCQ_ONLY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "QuestionDifficultyLevel" AS ENUM ('EASY', 'MEDIUM', 'HARD');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "tenant_question_bank_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "scope" "QuestionBankScope" NOT NULL DEFAULT 'GLOBAL',
    "enabled_question_types" TEXT[] DEFAULT ARRAY['MCQ_SINGLE','MCQ_MULTI','TRUE_FALSE','SHORT_ANSWER','LONG_ANSWER','FILL_BLANKS']::TEXT[],
    "show_question_marks" BOOLEAN NOT NULL DEFAULT true,
    "enabled_difficulties" "QuestionDifficultyLevel"[] DEFAULT ARRAY['EASY','MEDIUM','HARD']::"QuestionDifficultyLevel"[],
    "auto_question_code" BOOLEAN NOT NULL DEFAULT true,
    "default_marks" JSONB NOT NULL DEFAULT '{"MCQ_SINGLE":1,"MCQ_MULTI":1,"TRUE_FALSE":1,"SHORT_ANSWER":2,"LONG_ANSWER":5,"FILL_BLANKS":1,"MATCHING":1}'::jsonb,
    "negative_marking_enabled" BOOLEAN NOT NULL DEFAULT true,
    "negative_marks" DECIMAL(5,2) NOT NULL DEFAULT 0.25,
    "negative_apply_to" "NegativeMarkingApplyTo" NOT NULL DEFAULT 'ALL',
    "prevent_duplicates" BOOLEAN NOT NULL DEFAULT true,
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT true,
    "shuffle_options" BOOLEAN NOT NULL DEFAULT true,
    "allow_import" BOOLEAN NOT NULL DEFAULT true,
    "allow_export" BOOLEAN NOT NULL DEFAULT true,
    "require_approval" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_question_bank_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "question_bank_difficulty_rules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "setting_id" TEXT NOT NULL,
    "level" "QuestionDifficultyLevel" NOT NULL,
    "from_percent" INTEGER NOT NULL,
    "to_percent" INTEGER NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "question_bank_difficulty_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_question_bank_settings_tenant_id_key" ON "tenant_question_bank_settings"("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "question_bank_difficulty_rules_setting_id_level_key" ON "question_bank_difficulty_rules"("setting_id", "level");
CREATE INDEX IF NOT EXISTS "question_bank_difficulty_rules_tenant_id_sort_order_idx" ON "question_bank_difficulty_rules"("tenant_id", "sort_order");

DO $$ BEGIN
  ALTER TABLE "tenant_question_bank_settings" ADD CONSTRAINT "tenant_question_bank_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "question_bank_difficulty_rules" ADD CONSTRAINT "question_bank_difficulty_rules_setting_id_fkey" FOREIGN KEY ("setting_id") REFERENCES "tenant_question_bank_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
