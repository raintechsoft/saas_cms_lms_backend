ALTER TYPE "FeeFineType" ADD VALUE IF NOT EXISTS 'PER_DAY';
ALTER TYPE "FeeFineType" ADD VALUE IF NOT EXISTS 'DATE_RANGE';

CREATE TYPE "FeeInvoiceStatus" AS ENUM ('DUE', 'PAID', 'OVERDUE', 'CANCELLED');

CREATE TABLE "fee_fine_ranges" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "fee_master_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "amount" DECIMAL(12,2) NOT NULL,
    "per_day" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_fine_ranges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fee_invoices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "academic_session_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "FeeInvoiceStatus" NOT NULL DEFAULT 'DUE',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fine_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fee_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fee_invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "base_amount" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fine" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "fee_invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fee_fine_ranges_tenant_id_fee_master_id_start_date_idx"
ON "fee_fine_ranges"("tenant_id", "fee_master_id", "start_date");

CREATE UNIQUE INDEX "fee_invoices_tenant_id_invoice_number_key"
ON "fee_invoices"("tenant_id", "invoice_number");
CREATE INDEX "fee_invoices_tenant_id_academic_session_id_status_due_date_idx"
ON "fee_invoices"("tenant_id", "academic_session_id", "status", "due_date");
CREATE INDEX "fee_invoices_tenant_id_student_id_idx"
ON "fee_invoices"("tenant_id", "student_id");

CREATE UNIQUE INDEX "fee_invoice_items_invoice_id_assignment_id_key"
ON "fee_invoice_items"("invoice_id", "assignment_id");
CREATE INDEX "fee_invoice_items_assignment_id_idx"
ON "fee_invoice_items"("assignment_id");

ALTER TABLE "fee_fine_ranges"
ADD CONSTRAINT "fee_fine_ranges_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_fine_ranges"
ADD CONSTRAINT "fee_fine_ranges_fee_master_id_fkey"
FOREIGN KEY ("fee_master_id") REFERENCES "fee_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fee_invoices"
ADD CONSTRAINT "fee_invoices_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_invoices"
ADD CONSTRAINT "fee_invoices_academic_session_id_fkey"
FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_invoices"
ADD CONSTRAINT "fee_invoices_student_id_fkey"
FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fee_invoice_items"
ADD CONSTRAINT "fee_invoice_items_invoice_id_fkey"
FOREIGN KEY ("invoice_id") REFERENCES "fee_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_invoice_items"
ADD CONSTRAINT "fee_invoice_items_assignment_id_fkey"
FOREIGN KEY ("assignment_id") REFERENCES "student_fee_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
