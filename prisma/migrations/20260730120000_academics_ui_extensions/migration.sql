-- CreateEnum
CREATE TYPE "SubjectDeliveryType" AS ENUM ('THEORY', 'PRACTICAL');
CREATE TYPE "ScholarshipType" AS ENUM ('MERIT', 'NEED', 'GOVERNMENT');
CREATE TYPE "ScholarStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN "delivery_type" "SubjectDeliveryType" NOT NULL DEFAULT 'THEORY';

-- CreateTable
CREATE TABLE "subject_groups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "class_section_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subject_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subject_group_items" (
    "subject_group_id" TEXT NOT NULL,
    "class_subject_id" TEXT NOT NULL,
    CONSTRAINT "subject_group_items_pkey" PRIMARY KEY ("subject_group_id","class_subject_id")
);

CREATE TABLE "school_scholars" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "academic_session_id" TEXT NOT NULL,
    "scholarship_type" "ScholarshipType" NOT NULL,
    "scholarship_name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE NOT NULL,
    "status" "ScholarStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "fee_discount_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_scholars_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_bulk_update_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "update_type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "affected_ids" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "academic_bulk_update_logs_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "subject_groups_tenant_id_class_section_id_name_key" ON "subject_groups"("tenant_id", "class_section_id", "name");
CREATE INDEX "subject_groups_tenant_id_class_section_id_idx" ON "subject_groups"("tenant_id", "class_section_id");
CREATE INDEX "subject_group_items_class_subject_id_idx" ON "subject_group_items"("class_subject_id");
CREATE INDEX "school_scholars_tenant_id_academic_session_id_status_idx" ON "school_scholars"("tenant_id", "academic_session_id", "status");
CREATE INDEX "school_scholars_tenant_id_student_id_idx" ON "school_scholars"("tenant_id", "student_id");
CREATE INDEX "school_scholars_tenant_id_scholarship_type_idx" ON "school_scholars"("tenant_id", "scholarship_type");
CREATE INDEX "academic_bulk_update_logs_tenant_id_created_at_idx" ON "academic_bulk_update_logs"("tenant_id", "created_at");

-- ForeignKeys
ALTER TABLE "subject_groups" ADD CONSTRAINT "subject_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subject_groups" ADD CONSTRAINT "subject_groups_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subject_group_items" ADD CONSTRAINT "subject_group_items_subject_group_id_fkey" FOREIGN KEY ("subject_group_id") REFERENCES "subject_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subject_group_items" ADD CONSTRAINT "subject_group_items_class_subject_id_fkey" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school_scholars" ADD CONSTRAINT "school_scholars_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school_scholars" ADD CONSTRAINT "school_scholars_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school_scholars" ADD CONSTRAINT "school_scholars_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_scholars" ADD CONSTRAINT "school_scholars_fee_discount_id_fkey" FOREIGN KEY ("fee_discount_id") REFERENCES "fee_discounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic_bulk_update_logs" ADD CONSTRAINT "academic_bulk_update_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic_bulk_update_logs" ADD CONSTRAINT "academic_bulk_update_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
