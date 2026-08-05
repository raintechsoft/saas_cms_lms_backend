-- AlterEnum
ALTER TYPE "ErpSettingCategory" ADD VALUE IF NOT EXISTS 'PAYMENT';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "OnlineFeeOrderStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "OnlineFeeGateway" AS ENUM ('RAZORPAY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable students
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "transport_route_id" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "hostel_room_id" TEXT;

-- CreateTable online_fee_orders
CREATE TABLE IF NOT EXISTS "online_fee_orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "academic_session_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "OnlineFeeOrderStatus" NOT NULL DEFAULT 'PENDING',
    "gateway" "OnlineFeeGateway" NOT NULL DEFAULT 'RAZORPAY',
    "gateway_order_id" TEXT,
    "gateway_payment_id" TEXT,
    "gateway_signature" TEXT,
    "fee_payment_id" TEXT,
    "items" JSONB NOT NULL,
    "metadata" JSONB,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "online_fee_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "transport_routes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "vehicle_number" TEXT,
    "driver_name" TEXT,
    "driver_phone" TEXT,
    "stops" JSONB,
    "fare_amount" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transport_routes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hostel_blocks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hostel_blocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hostel_rooms" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "block_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hostel_rooms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "online_fee_orders_fee_payment_id_key" ON "online_fee_orders"("fee_payment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "online_fee_orders_tenant_id_gateway_order_id_key" ON "online_fee_orders"("tenant_id", "gateway_order_id");
CREATE INDEX IF NOT EXISTS "online_fee_orders_tenant_id_status_created_at_idx" ON "online_fee_orders"("tenant_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "online_fee_orders_tenant_id_student_id_idx" ON "online_fee_orders"("tenant_id", "student_id");
CREATE INDEX IF NOT EXISTS "online_fee_orders_gateway_payment_id_idx" ON "online_fee_orders"("gateway_payment_id");

CREATE UNIQUE INDEX IF NOT EXISTS "transport_routes_tenant_id_name_key" ON "transport_routes"("tenant_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "transport_routes_tenant_id_code_key" ON "transport_routes"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "transport_routes_tenant_id_is_active_idx" ON "transport_routes"("tenant_id", "is_active");

CREATE UNIQUE INDEX IF NOT EXISTS "hostel_blocks_tenant_id_name_key" ON "hostel_blocks"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "hostel_blocks_tenant_id_is_active_idx" ON "hostel_blocks"("tenant_id", "is_active");

CREATE UNIQUE INDEX IF NOT EXISTS "hostel_rooms_tenant_id_block_id_name_key" ON "hostel_rooms"("tenant_id", "block_id", "name");
CREATE INDEX IF NOT EXISTS "hostel_rooms_tenant_id_is_active_idx" ON "hostel_rooms"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "hostel_rooms_block_id_idx" ON "hostel_rooms"("block_id");

CREATE INDEX IF NOT EXISTS "students_transport_route_id_idx" ON "students"("transport_route_id");
CREATE INDEX IF NOT EXISTS "students_hostel_room_id_idx" ON "students"("hostel_room_id");

DO $$ BEGIN
  ALTER TABLE "online_fee_orders" ADD CONSTRAINT "online_fee_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "online_fee_orders" ADD CONSTRAINT "online_fee_orders_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "online_fee_orders" ADD CONSTRAINT "online_fee_orders_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "online_fee_orders" ADD CONSTRAINT "online_fee_orders_fee_payment_id_fkey" FOREIGN KEY ("fee_payment_id") REFERENCES "fee_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "online_fee_orders" ADD CONSTRAINT "online_fee_orders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "hostel_blocks" ADD CONSTRAINT "hostel_blocks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "hostel_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "students" ADD CONSTRAINT "students_transport_route_id_fkey" FOREIGN KEY ("transport_route_id") REFERENCES "transport_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "students" ADD CONSTRAINT "students_hostel_room_id_fkey" FOREIGN KEY ("hostel_room_id") REFERENCES "hostel_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
