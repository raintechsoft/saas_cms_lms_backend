-- AlterTable
ALTER TABLE "pay_parameters" ADD COLUMN "short_code" TEXT,
ADD COLUMN "taxable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "pay_parameters_tenant_id_type_is_active_idx" ON "pay_parameters"("tenant_id", "type", "is_active");

-- CreateTable
CREATE TABLE "tenant_payroll_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "payroll_frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "financial_year" TEXT NOT NULL DEFAULT '2026-2027',
    "pay_day" INTEGER NOT NULL DEFAULT 31,
    "payment_method" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "salary_calculation_method" TEXT NOT NULL DEFAULT 'CALENDAR_DAYS',
    "rounding_off" TEXT NOT NULL DEFAULT 'NEAREST_RUPEE',
    "income_tax_calculation" TEXT NOT NULL DEFAULT 'NEW_REGIME',
    "arrear_calculation" BOOLEAN NOT NULL DEFAULT true,
    "auto_recalculate" BOOLEAN NOT NULL DEFAULT true,
    "generate_payslip" BOOLEAN NOT NULL DEFAULT true,
    "email_payslip" BOOLEAN NOT NULL DEFAULT false,
    "lock_payroll_after_approval" BOOLEAN NOT NULL DEFAULT true,
    "pf_scheme" TEXT NOT NULL DEFAULT '12_BOTH',
    "esi_applicability" TEXT NOT NULL DEFAULT 'APPLICABLE',
    "epf_number" TEXT,
    "esi_number" TEXT,
    "professional_tax" TEXT NOT NULL DEFAULT 'STATE_RULES',
    "labour_welfare_fund" TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
    "pay_structure" TEXT NOT NULL DEFAULT 'DEFAULT',
    "allow_negative_salary" BOOLEAN NOT NULL DEFAULT false,
    "minimum_pay_limit" DECIMAL(12,2) NOT NULL DEFAULT 5000,
    "maximum_pay_limit" DECIMAL(12,2) NOT NULL DEFAULT 500000,
    "overtime_calculation" TEXT NOT NULL DEFAULT 'HOURLY_RATE',
    "leave_encashment" TEXT NOT NULL DEFAULT 'YEAR_END',
    "prepared_by_role" TEXT NOT NULL DEFAULT 'HR Manager',
    "reviewed_by_role" TEXT NOT NULL DEFAULT 'Accounts Manager',
    "approved_by_role" TEXT NOT NULL DEFAULT 'Finance Head',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_payroll_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_payroll_settings_tenant_id_key" ON "tenant_payroll_settings"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_payroll_settings" ADD CONSTRAINT "tenant_payroll_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
