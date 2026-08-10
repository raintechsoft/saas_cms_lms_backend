-- AlterTable
ALTER TABLE "tenant_payment_methods" ADD COLUMN IF NOT EXISTS "encrypted_secrets" TEXT;
