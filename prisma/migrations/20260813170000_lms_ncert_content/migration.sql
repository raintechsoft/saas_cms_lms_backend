DO $$ BEGIN
  CREATE TYPE "NcertResourceStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NcertResourceType" AS ENUM ('LINK', 'FILE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "tenant_ncert_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "allow_teachers_to_create_ncert_resources" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_ncert_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_ncert_settings_tenant_id_key"
  ON "tenant_ncert_settings"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "tenant_ncert_settings"
    ADD CONSTRAINT "tenant_ncert_settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ncert_resources" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "chapter" TEXT,
    "resource_type" "NcertResourceType" NOT NULL DEFAULT 'LINK',
    "resource_url" TEXT,
    "file_name" TEXT,
    "subject_id" TEXT,
    "class_id" TEXT,
    "status" "NcertResourceStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ncert_resources_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ncert_resources_tenant_id_status_idx" ON "ncert_resources"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "ncert_resources_tenant_id_subject_id_idx" ON "ncert_resources"("tenant_id", "subject_id");
CREATE INDEX IF NOT EXISTS "ncert_resources_tenant_id_class_id_idx" ON "ncert_resources"("tenant_id", "class_id");
CREATE INDEX IF NOT EXISTS "ncert_resources_tenant_id_chapter_idx" ON "ncert_resources"("tenant_id", "chapter");
CREATE INDEX IF NOT EXISTS "ncert_resources_tenant_id_created_by_id_idx" ON "ncert_resources"("tenant_id", "created_by_id");

DO $$ BEGIN
  ALTER TABLE "ncert_resources" ADD CONSTRAINT "ncert_resources_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ncert_resources" ADD CONSTRAINT "ncert_resources_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ncert_resources" ADD CONSTRAINT "ncert_resources_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "academic_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ncert_resources" ADD CONSTRAINT "ncert_resources_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
