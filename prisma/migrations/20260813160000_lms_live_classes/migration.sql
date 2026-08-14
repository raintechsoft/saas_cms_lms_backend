DO $$ BEGIN
  CREATE TYPE "LiveClassStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "tenant_live_classes_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "allow_teachers_to_create_live_classes" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_live_classes_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_live_classes_settings_tenant_id_key"
  ON "tenant_live_classes_settings"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "tenant_live_classes_settings"
    ADD CONSTRAINT "tenant_live_classes_settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "live_classes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT,
    "description" TEXT,
    "meeting_url" TEXT,
    "provider" TEXT,
    "subject_id" TEXT,
    "class_id" TEXT,
    "class_section_id" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "LiveClassStatus" NOT NULL DEFAULT 'DRAFT',
    "host_teacher_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "live_classes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "live_classes_tenant_id_status_idx" ON "live_classes"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "live_classes_tenant_id_starts_at_idx" ON "live_classes"("tenant_id", "starts_at");
CREATE INDEX IF NOT EXISTS "live_classes_tenant_id_class_id_idx" ON "live_classes"("tenant_id", "class_id");
CREATE INDEX IF NOT EXISTS "live_classes_tenant_id_class_section_id_idx" ON "live_classes"("tenant_id", "class_section_id");
CREATE INDEX IF NOT EXISTS "live_classes_tenant_id_host_teacher_id_idx" ON "live_classes"("tenant_id", "host_teacher_id");
CREATE INDEX IF NOT EXISTS "live_classes_tenant_id_created_by_id_idx" ON "live_classes"("tenant_id", "created_by_id");

DO $$ BEGIN
  ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "academic_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_class_section_id_fkey"
    FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_host_teacher_id_fkey"
    FOREIGN KEY ("host_teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
