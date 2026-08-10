-- CreateEnum
CREATE TYPE "LibraryFineType" AS ENUM ('PER_DAY', 'FLAT');
CREATE TYPE "LibraryBarcodeType" AS ENUM ('CODE128', 'CODE39', 'EAN13', 'QR');

-- AlterTable library_categories
ALTER TABLE "library_categories" ADD COLUMN IF NOT EXISTS "parent_id" TEXT;

CREATE INDEX IF NOT EXISTS "library_categories_tenant_id_parent_id_idx" ON "library_categories"("tenant_id", "parent_id");

DO $$ BEGIN
  ALTER TABLE "library_categories" ADD CONSTRAINT "library_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "library_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable member types
CREATE TABLE "library_member_types" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#10B981',
    "max_books" INTEGER NOT NULL DEFAULT 5,
    "issue_period_days" INTEGER NOT NULL DEFAULT 14,
    "max_renewals" INTEGER NOT NULL DEFAULT 2,
    "fine_per_day" DECIMAL(12,2) NOT NULL DEFAULT 5,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_member_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "library_member_types_tenant_id_name_key" ON "library_member_types"("tenant_id", "name");
CREATE INDEX "library_member_types_tenant_id_sort_order_idx" ON "library_member_types"("tenant_id", "sort_order");

ALTER TABLE "library_member_types" ADD CONSTRAINT "library_member_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable settings
CREATE TABLE "tenant_library_settings" (
    "tenant_id" TEXT NOT NULL,
    "module_enabled" BOOLEAN NOT NULL DEFAULT true,
    "library_name" TEXT NOT NULL DEFAULT 'School Central Library',
    "accession_prefix" TEXT NOT NULL DEFAULT 'LIB-2025-',
    "default_issue_period_days" INTEGER NOT NULL DEFAULT 14,
    "allow_renewals" BOOLEAN NOT NULL DEFAULT true,
    "max_books_per_member" INTEGER NOT NULL DEFAULT 5,
    "max_renewals_per_book" INTEGER NOT NULL DEFAULT 2,
    "reservation_validity_days" INTEGER NOT NULL DEFAULT 2,
    "return_grace_period_days" INTEGER NOT NULL DEFAULT 1,
    "fine_type" "LibraryFineType" NOT NULL DEFAULT 'PER_DAY',
    "fine_amount" DECIMAL(12,2) NOT NULL DEFAULT 5,
    "max_fine_per_book" DECIMAL(12,2) NOT NULL DEFAULT 100,
    "processing_fee" DECIMAL(12,2) NOT NULL DEFAULT 20,
    "enable_reservations" BOOLEAN NOT NULL DEFAULT true,
    "due_date_reminders" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_overdue" BOOLEAN NOT NULL DEFAULT true,
    "allow_fine_exemptions" BOOLEAN NOT NULL DEFAULT true,
    "auto_calculate_fine" BOOLEAN NOT NULL DEFAULT true,
    "show_availability_to_students" BOOLEAN NOT NULL DEFAULT false,
    "allow_member_self_registration" BOOLEAN NOT NULL DEFAULT false,
    "barcode_type" "LibraryBarcodeType" NOT NULL DEFAULT 'CODE128',
    "barcode_prefix" TEXT NOT NULL DEFAULT 'LIB',
    "barcode_starting_number" INTEGER NOT NULL DEFAULT 1001,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_library_settings_pkey" PRIMARY KEY ("tenant_id")
);

ALTER TABLE "tenant_library_settings" ADD CONSTRAINT "tenant_library_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
