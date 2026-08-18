-- CreateTable
CREATE TABLE IF NOT EXISTS "tenant_test_series_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "allow_teachers_to_create_test_series" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_test_series_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_test_series_settings_tenant_id_key"
  ON "tenant_test_series_settings"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "tenant_test_series_settings"
    ADD CONSTRAINT "tenant_test_series_settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
