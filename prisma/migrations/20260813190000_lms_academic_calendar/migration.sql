-- CreateEnum
CREATE TYPE "AcademicEventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AcademicEventType" AS ENUM ('ACADEMIC', 'EXAMINATION', 'HOLIDAY', 'MEETING', 'OTHER', 'IMPORTANT');

-- CreateTable
CREATE TABLE "tenant_academic_calendar_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "allow_teachers_to_create_events" BOOLEAN NOT NULL DEFAULT false,
    "important_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_academic_calendar_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "event_type" "AcademicEventType" NOT NULL DEFAULT 'ACADEMIC',
    "status" "AcademicEventStatus" NOT NULL DEFAULT 'DRAFT',
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3),
    "all_day" BOOLEAN NOT NULL DEFAULT true,
    "class_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_academic_calendar_settings_tenant_id_key" ON "tenant_academic_calendar_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "academic_events_tenant_id_status_idx" ON "academic_events"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "academic_events_tenant_id_event_type_idx" ON "academic_events"("tenant_id", "event_type");

-- CreateIndex
CREATE INDEX "academic_events_tenant_id_start_at_idx" ON "academic_events"("tenant_id", "start_at");

-- CreateIndex
CREATE INDEX "academic_events_tenant_id_class_id_idx" ON "academic_events"("tenant_id", "class_id");

-- CreateIndex
CREATE INDEX "academic_events_tenant_id_created_by_id_idx" ON "academic_events"("tenant_id", "created_by_id");

-- AddForeignKey
ALTER TABLE "tenant_academic_calendar_settings" ADD CONSTRAINT "tenant_academic_calendar_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_events" ADD CONSTRAINT "academic_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_events" ADD CONSTRAINT "academic_events_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "academic_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_events" ADD CONSTRAINT "academic_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
