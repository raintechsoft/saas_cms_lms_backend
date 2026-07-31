CREATE TABLE IF NOT EXISTS "pay_parameters" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "AdjustmentType" NOT NULL DEFAULT 'EARNING',
  "default_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pay_parameters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pay_parameters_tenant_id_name_key" ON "pay_parameters"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "pay_parameters_tenant_id_idx" ON "pay_parameters"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "pay_parameters"
    ADD CONSTRAINT "pay_parameters_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
