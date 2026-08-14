ALTER TABLE "ncert_resources" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'BOOKS';

CREATE INDEX IF NOT EXISTS "ncert_resources_tenant_id_category_idx" ON "ncert_resources"("tenant_id", "category");
