-- AlterTable
ALTER TABLE "tenant_module_settings" ADD COLUMN IF NOT EXISTS "label" TEXT;
ALTER TABLE "tenant_module_settings" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "tenant_module_settings" ADD COLUMN IF NOT EXISTS "group_key" TEXT NOT NULL DEFAULT 'CMS';
ALTER TABLE "tenant_module_settings" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tenant_module_settings" ADD COLUMN IF NOT EXISTS "is_configured" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tenant_module_settings_tenant_id_group_key_sort_order_idx" ON "tenant_module_settings"("tenant_id", "group_key", "sort_order");
