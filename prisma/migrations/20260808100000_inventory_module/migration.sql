-- Inventory module
CREATE TYPE "InventoryMovementType" AS ENUM ('ADD', 'ISSUE', 'RETURN', 'ADJUST');

CREATE TABLE IF NOT EXISTS "inventory_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category_id" TEXT,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT DEFAULT 'pcs',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reorder_level" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_movements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "student_id" TEXT,
    "note" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_categories_tenant_id_name_key" ON "inventory_categories"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "inventory_categories_tenant_id_is_active_idx" ON "inventory_categories"("tenant_id", "is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_tenant_id_sku_key" ON "inventory_items"("tenant_id", "sku");
CREATE INDEX IF NOT EXISTS "inventory_items_tenant_id_is_active_idx" ON "inventory_items"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "inventory_items_tenant_id_name_idx" ON "inventory_items"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "inventory_movements_tenant_id_type_created_at_idx" ON "inventory_movements"("tenant_id", "type", "created_at");
CREATE INDEX IF NOT EXISTS "inventory_movements_tenant_id_item_id_created_at_idx" ON "inventory_movements"("tenant_id", "item_id", "created_at");
CREATE INDEX IF NOT EXISTS "inventory_movements_tenant_id_student_id_idx" ON "inventory_movements"("tenant_id", "student_id");

DO $$ BEGIN
  ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "inventory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;