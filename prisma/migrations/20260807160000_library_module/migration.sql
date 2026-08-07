-- Library module
CREATE TYPE "LibraryLoanStatus" AS ENUM ('ISSUED', 'RETURNED', 'LOST');

CREATE TABLE IF NOT EXISTS "library_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "library_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "library_books" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category_id" TEXT,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "isbn" TEXT,
    "accession_no" TEXT,
    "publisher" TEXT,
    "published_year" INTEGER,
    "total_copies" INTEGER NOT NULL DEFAULT 1,
    "available_copies" INTEGER NOT NULL DEFAULT 1,
    "location" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "library_books_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "library_loans" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMP(3) NOT NULL,
    "returned_at" TIMESTAMP(3),
    "status" "LibraryLoanStatus" NOT NULL DEFAULT 'ISSUED',
    "fine_amount" DECIMAL(12,2),
    "note" TEXT,
    "issued_by_id" TEXT,
    "returned_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "library_loans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "library_categories_tenant_id_name_key" ON "library_categories"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "library_categories_tenant_id_is_active_idx" ON "library_categories"("tenant_id", "is_active");

CREATE UNIQUE INDEX IF NOT EXISTS "library_books_tenant_id_accession_no_key" ON "library_books"("tenant_id", "accession_no");
CREATE INDEX IF NOT EXISTS "library_books_tenant_id_is_active_idx" ON "library_books"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "library_books_tenant_id_title_idx" ON "library_books"("tenant_id", "title");

CREATE INDEX IF NOT EXISTS "library_loans_tenant_id_status_due_at_idx" ON "library_loans"("tenant_id", "status", "due_at");
CREATE INDEX IF NOT EXISTS "library_loans_tenant_id_student_id_issued_at_idx" ON "library_loans"("tenant_id", "student_id", "issued_at");
CREATE INDEX IF NOT EXISTS "library_loans_tenant_id_book_id_status_idx" ON "library_loans"("tenant_id", "book_id", "status");

DO $$ BEGIN
  ALTER TABLE "library_categories" ADD CONSTRAINT "library_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "library_books" ADD CONSTRAINT "library_books_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "library_books" ADD CONSTRAINT "library_books_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "library_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "library_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_returned_by_id_fkey" FOREIGN KEY ("returned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
