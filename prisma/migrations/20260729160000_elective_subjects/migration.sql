-- Elective categories + student elective assignments
CREATE TABLE "elective_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "class_id" TEXT,
    "max_select" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "elective_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "elective_categories_tenant_id_name_key" ON "elective_categories"("tenant_id", "name");
CREATE INDEX "elective_categories_tenant_id_class_id_idx" ON "elective_categories"("tenant_id", "class_id");

ALTER TABLE "elective_categories"
ADD CONSTRAINT "elective_categories_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "elective_categories"
ADD CONSTRAINT "elective_categories_class_id_fkey"
FOREIGN KEY ("class_id") REFERENCES "academic_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "subjects"
ADD COLUMN "elective_category_id" TEXT;

CREATE INDEX "subjects_elective_category_id_idx" ON "subjects"("elective_category_id");

ALTER TABLE "subjects"
ADD CONSTRAINT "subjects_elective_category_id_fkey"
FOREIGN KEY ("elective_category_id") REFERENCES "elective_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "student_elective_assignments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_enrollment_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "elective_category_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "student_elective_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_elective_assignments_tenant_id_student_enrollment_id_subject_id_key"
ON "student_elective_assignments"("tenant_id", "student_enrollment_id", "subject_id");

CREATE INDEX "student_elective_assignments_tenant_id_student_enrollment_id_idx"
ON "student_elective_assignments"("tenant_id", "student_enrollment_id");

CREATE INDEX "student_elective_assignments_elective_category_id_idx"
ON "student_elective_assignments"("elective_category_id");

ALTER TABLE "student_elective_assignments"
ADD CONSTRAINT "student_elective_assignments_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_elective_assignments"
ADD CONSTRAINT "student_elective_assignments_student_enrollment_id_fkey"
FOREIGN KEY ("student_enrollment_id") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_elective_assignments"
ADD CONSTRAINT "student_elective_assignments_subject_id_fkey"
FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_elective_assignments"
ADD CONSTRAINT "student_elective_assignments_elective_category_id_fkey"
FOREIGN KEY ("elective_category_id") REFERENCES "elective_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
