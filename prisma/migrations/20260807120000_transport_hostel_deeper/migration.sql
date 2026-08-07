-- AlterTable students
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "transport_stop_name" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "hostel_bed_id" TEXT;

CREATE TABLE IF NOT EXISTS "transport_assignment_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "transport_route_id" TEXT,
    "stop_name" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "assigned_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transport_assignment_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hostel_beds" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hostel_beds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hostel_allocation_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "hostel_room_id" TEXT,
    "hostel_bed_id" TEXT,
    "room_label" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "assigned_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hostel_allocation_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "students_hostel_bed_id_key" ON "students"("hostel_bed_id");
CREATE UNIQUE INDEX IF NOT EXISTS "hostel_beds_tenant_id_room_id_label_key" ON "hostel_beds"("tenant_id", "room_id", "label");
CREATE INDEX IF NOT EXISTS "hostel_beds_tenant_id_room_id_is_active_idx" ON "hostel_beds"("tenant_id", "room_id", "is_active");
CREATE INDEX IF NOT EXISTS "transport_assignment_logs_tenant_id_student_id_created_at_idx" ON "transport_assignment_logs"("tenant_id", "student_id", "created_at");
CREATE INDEX IF NOT EXISTS "transport_assignment_logs_tenant_id_transport_route_id_idx" ON "transport_assignment_logs"("tenant_id", "transport_route_id");
CREATE INDEX IF NOT EXISTS "hostel_allocation_logs_tenant_id_student_id_created_at_idx" ON "hostel_allocation_logs"("tenant_id", "student_id", "created_at");
CREATE INDEX IF NOT EXISTS "hostel_allocation_logs_tenant_id_hostel_room_id_idx" ON "hostel_allocation_logs"("tenant_id", "hostel_room_id");

DO $$ BEGIN
  ALTER TABLE "students" ADD CONSTRAINT "students_hostel_bed_id_fkey" FOREIGN KEY ("hostel_bed_id") REFERENCES "hostel_beds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "transport_assignment_logs" ADD CONSTRAINT "transport_assignment_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "transport_assignment_logs" ADD CONSTRAINT "transport_assignment_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "transport_assignment_logs" ADD CONSTRAINT "transport_assignment_logs_transport_route_id_fkey" FOREIGN KEY ("transport_route_id") REFERENCES "transport_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "transport_assignment_logs" ADD CONSTRAINT "transport_assignment_logs_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "hostel_beds" ADD CONSTRAINT "hostel_beds_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "hostel_beds" ADD CONSTRAINT "hostel_beds_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "hostel_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "hostel_allocation_logs" ADD CONSTRAINT "hostel_allocation_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "hostel_allocation_logs" ADD CONSTRAINT "hostel_allocation_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "hostel_allocation_logs" ADD CONSTRAINT "hostel_allocation_logs_hostel_room_id_fkey" FOREIGN KEY ("hostel_room_id") REFERENCES "hostel_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "hostel_allocation_logs" ADD CONSTRAINT "hostel_allocation_logs_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;