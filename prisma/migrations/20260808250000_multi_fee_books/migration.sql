-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "MultiFeeBookType" AS ENUM ('GENERAL', 'PROFESSIONAL', 'HOSTEL', 'TRANSPORT', 'ACTIVITY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "MultiFeeBookTarget" AS ENUM ('CLASSES', 'COURSES', 'STREAMS', 'PROGRAMS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "MultiFeeBookHeadFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY', 'ONE_TIME');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "multi_fee_books" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "academic_session_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "MultiFeeBookType" NOT NULL DEFAULT 'GENERAL',
    "target" "MultiFeeBookTarget" NOT NULL DEFAULT 'CLASSES',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "multi_fee_books_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "multi_fee_book_classes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "fee_book_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "multi_fee_book_classes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "multi_fee_book_heads" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "fee_book_id" TEXT NOT NULL,
    "fee_type_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "frequency" "MultiFeeBookHeadFrequency" NOT NULL DEFAULT 'YEARLY',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "multi_fee_book_heads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "multi_fee_books_tenant_id_academic_session_id_name_key" ON "multi_fee_books"("tenant_id", "academic_session_id", "name");
CREATE INDEX IF NOT EXISTS "multi_fee_books_tenant_id_is_active_idx" ON "multi_fee_books"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "multi_fee_books_tenant_id_academic_session_id_idx" ON "multi_fee_books"("tenant_id", "academic_session_id");
CREATE UNIQUE INDEX IF NOT EXISTS "multi_fee_book_classes_fee_book_id_class_id_key" ON "multi_fee_book_classes"("fee_book_id", "class_id");
CREATE INDEX IF NOT EXISTS "multi_fee_book_classes_tenant_id_class_id_idx" ON "multi_fee_book_classes"("tenant_id", "class_id");
CREATE UNIQUE INDEX IF NOT EXISTS "multi_fee_book_heads_fee_book_id_fee_type_id_key" ON "multi_fee_book_heads"("fee_book_id", "fee_type_id");
CREATE INDEX IF NOT EXISTS "multi_fee_book_heads_tenant_id_fee_book_id_sort_order_idx" ON "multi_fee_book_heads"("tenant_id", "fee_book_id", "sort_order");

DO $$ BEGIN
  ALTER TABLE "multi_fee_books" ADD CONSTRAINT "multi_fee_books_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "multi_fee_books" ADD CONSTRAINT "multi_fee_books_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "multi_fee_books" ADD CONSTRAINT "multi_fee_books_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "multi_fee_book_classes" ADD CONSTRAINT "multi_fee_book_classes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "multi_fee_book_classes" ADD CONSTRAINT "multi_fee_book_classes_fee_book_id_fkey" FOREIGN KEY ("fee_book_id") REFERENCES "multi_fee_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "multi_fee_book_classes" ADD CONSTRAINT "multi_fee_book_classes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "academic_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "multi_fee_book_heads" ADD CONSTRAINT "multi_fee_book_heads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "multi_fee_book_heads" ADD CONSTRAINT "multi_fee_book_heads_fee_book_id_fkey" FOREIGN KEY ("fee_book_id") REFERENCES "multi_fee_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "multi_fee_book_heads" ADD CONSTRAINT "multi_fee_book_heads_fee_type_id_fkey" FOREIGN KEY ("fee_type_id") REFERENCES "fee_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
