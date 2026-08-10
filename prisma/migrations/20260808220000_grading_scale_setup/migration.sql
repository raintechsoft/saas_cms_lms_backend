-- CreateTable
CREATE TABLE IF NOT EXISTS "grading_scales" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "grading_scales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "grading_scale_grades" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "scale_id" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "grade_point" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "from_percent" DECIMAL(5,2) NOT NULL,
    "to_percent" DECIMAL(5,2) NOT NULL,
    "grade_name" TEXT,
    "remarks" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "grading_scale_grades_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "grading_scale_classes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "scale_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "grading_scale_classes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "grading_scales_tenant_id_name_key" ON "grading_scales"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "grading_scales_tenant_id_is_active_idx" ON "grading_scales"("tenant_id", "is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "grading_scale_grades_scale_id_grade_key" ON "grading_scale_grades"("scale_id", "grade");
CREATE INDEX IF NOT EXISTS "grading_scale_grades_tenant_id_scale_id_sort_order_idx" ON "grading_scale_grades"("tenant_id", "scale_id", "sort_order");
CREATE UNIQUE INDEX IF NOT EXISTS "grading_scale_classes_tenant_id_class_id_key" ON "grading_scale_classes"("tenant_id", "class_id");
CREATE INDEX IF NOT EXISTS "grading_scale_classes_tenant_id_scale_id_idx" ON "grading_scale_classes"("tenant_id", "scale_id");

DO $$ BEGIN
  ALTER TABLE "grading_scales" ADD CONSTRAINT "grading_scales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "grading_scale_grades" ADD CONSTRAINT "grading_scale_grades_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "grading_scale_grades" ADD CONSTRAINT "grading_scale_grades_scale_id_fkey" FOREIGN KEY ("scale_id") REFERENCES "grading_scales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "grading_scale_classes" ADD CONSTRAINT "grading_scale_classes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "grading_scale_classes" ADD CONSTRAINT "grading_scale_classes_scale_id_fkey" FOREIGN KEY ("scale_id") REFERENCES "grading_scales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "grading_scale_classes" ADD CONSTRAINT "grading_scale_classes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "academic_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
