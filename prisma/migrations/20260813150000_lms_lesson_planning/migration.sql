DO $$ BEGIN
  CREATE TYPE "LessonPlanStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "tenant_lesson_planning_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "allow_teachers_to_create_lesson_plans" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_lesson_planning_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_lesson_planning_settings_tenant_id_key"
  ON "tenant_lesson_planning_settings"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "tenant_lesson_planning_settings"
    ADD CONSTRAINT "tenant_lesson_planning_settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "lesson_plans" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT,
    "objectives" TEXT,
    "materials" TEXT,
    "activities" TEXT,
    "assessment_notes" TEXT,
    "homework" TEXT,
    "subject_id" TEXT,
    "class_id" TEXT,
    "planned_date" DATE,
    "duration_minutes" INTEGER,
    "status" "LessonPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lesson_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lesson_plans_tenant_id_status_idx" ON "lesson_plans"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "lesson_plans_tenant_id_subject_id_idx" ON "lesson_plans"("tenant_id", "subject_id");
CREATE INDEX IF NOT EXISTS "lesson_plans_tenant_id_class_id_idx" ON "lesson_plans"("tenant_id", "class_id");
CREATE INDEX IF NOT EXISTS "lesson_plans_tenant_id_planned_date_idx" ON "lesson_plans"("tenant_id", "planned_date");
CREATE INDEX IF NOT EXISTS "lesson_plans_tenant_id_created_by_id_idx" ON "lesson_plans"("tenant_id", "created_by_id");

DO $$ BEGIN
  ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "academic_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
