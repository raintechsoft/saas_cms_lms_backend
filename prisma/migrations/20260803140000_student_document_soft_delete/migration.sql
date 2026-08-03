-- Soft-delete support for student documents (delete with reason)
ALTER TABLE "student_documents" ADD COLUMN IF NOT EXISTS "delete_reason" TEXT;
ALTER TABLE "student_documents" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "student_documents" ADD COLUMN IF NOT EXISTS "deleted_by_id" TEXT;

CREATE INDEX IF NOT EXISTS "student_documents_tenant_id_deleted_at_idx"
  ON "student_documents"("tenant_id", "deleted_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_documents_deleted_by_id_fkey'
  ) THEN
    ALTER TABLE "student_documents"
      ADD CONSTRAINT "student_documents_deleted_by_id_fkey"
      FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
