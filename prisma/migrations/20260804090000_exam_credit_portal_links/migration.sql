-- AlterTable
ALTER TABLE "exam_schedules" ADD COLUMN IF NOT EXISTS "credit_hours" DECIMAL(6,2);
ALTER TABLE "exam_students" ADD COLUMN IF NOT EXISTS "show_on_portal" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE IF NOT EXISTS "exam_links" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "result_type" "ExamResultType" NOT NULL,
    "final_exam_id" TEXT NOT NULL,
    "exam_ids" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exam_links_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "exam_links_tenant_id_final_exam_id_idx" ON "exam_links"("tenant_id", "final_exam_id");

ALTER TABLE "exam_links" DROP CONSTRAINT IF EXISTS "exam_links_tenant_id_fkey";
ALTER TABLE "exam_links" ADD CONSTRAINT "exam_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;