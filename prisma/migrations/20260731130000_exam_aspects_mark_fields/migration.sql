-- AlterTable
ALTER TABLE "exam_mark_components" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "exam_aspect_fields" ADD COLUMN IF NOT EXISTS "field_type" TEXT NOT NULL DEFAULT 'BEHAVIOR';

-- CreateTable
CREATE TABLE IF NOT EXISTS "exam_subject_links" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "subject_ids" JSONB NOT NULL,
    "merge_type" TEXT NOT NULL DEFAULT 'MERGE',
    "bifurcation_columns" INTEGER NOT NULL DEFAULT 2,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_subject_links_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "exam_subject_links_tenant_id_idx" ON "exam_subject_links"("tenant_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_subject_links_tenant_id_fkey'
  ) THEN
    ALTER TABLE "exam_subject_links"
      ADD CONSTRAINT "exam_subject_links_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
