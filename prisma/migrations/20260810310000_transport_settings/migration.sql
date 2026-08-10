-- CreateEnum
CREATE TYPE "TransportVehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');
CREATE TYPE "TransportFeeType" AS ENUM ('ANNUAL', 'MONTHLY', 'QUARTERLY');
CREATE TYPE "TransportFeeCollectionMode" AS ENUM ('IN_ADVANCE', 'IN_ARREARS');
CREATE TYPE "TransportWindowUnit" AS ENUM ('HOURS', 'MINUTES');

-- AlterTable transport_routes
ALTER TABLE "transport_routes" ADD COLUMN IF NOT EXISTS "attendant_name" TEXT;
ALTER TABLE "transport_routes" ADD COLUMN IF NOT EXISTS "color" TEXT NOT NULL DEFAULT '#10B981';

-- CreateTable
CREATE TABLE "transport_vehicles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "registration_no" TEXT NOT NULL,
    "label" TEXT,
    "vehicle_type" TEXT NOT NULL DEFAULT 'Bus',
    "capacity" INTEGER NOT NULL DEFAULT 40,
    "status" "TransportVehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "route_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transport_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_transport_settings" (
    "tenant_id" TEXT NOT NULL,
    "module_enabled" BOOLEAN NOT NULL DEFAULT true,
    "pickup_window_value" TEXT NOT NULL DEFAULT '01:00',
    "pickup_window_unit" "TransportWindowUnit" NOT NULL DEFAULT 'HOURS',
    "drop_window_value" TEXT NOT NULL DEFAULT '01:30',
    "drop_window_unit" "TransportWindowUnit" NOT NULL DEFAULT 'HOURS',
    "allow_parent_tracking" BOOLEAN NOT NULL DEFAULT true,
    "fee_type" "TransportFeeType" NOT NULL DEFAULT 'MONTHLY',
    "fee_collection_mode" "TransportFeeCollectionMode" NOT NULL DEFAULT 'IN_ADVANCE',
    "fee_due_day" INTEGER NOT NULL DEFAULT 5,
    "late_fee_amount" DECIMAL(12,2) NOT NULL DEFAULT 100,
    "mark_attendance_on_pickup" BOOLEAN NOT NULL DEFAULT true,
    "mark_attendance_on_drop" BOOLEAN NOT NULL DEFAULT true,
    "notify_parent_on_pickup_drop" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_transport_settings_pkey" PRIMARY KEY ("tenant_id")
);

CREATE UNIQUE INDEX "transport_vehicles_tenant_id_registration_no_key" ON "transport_vehicles"("tenant_id", "registration_no");
CREATE INDEX "transport_vehicles_tenant_id_status_idx" ON "transport_vehicles"("tenant_id", "status");
CREATE INDEX "transport_vehicles_tenant_id_route_id_idx" ON "transport_vehicles"("tenant_id", "route_id");

ALTER TABLE "transport_vehicles" ADD CONSTRAINT "transport_vehicles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transport_vehicles" ADD CONSTRAINT "transport_vehicles_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "transport_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tenant_transport_settings" ADD CONSTRAINT "tenant_transport_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
