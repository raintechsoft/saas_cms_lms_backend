-- CreateTable
CREATE TABLE "tenant_student_access_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "disable_student_login" BOOLEAN NOT NULL DEFAULT false,
    "allow_profile_editing" BOOLEAN NOT NULL DEFAULT true,
    "profile_edit_from" DATE,
    "profile_edit_to" DATE,
    "selected_class_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled_permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_student_access_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_student_access_settings_tenant_id_key" ON "tenant_student_access_settings"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_student_access_settings" ADD CONSTRAINT "tenant_student_access_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
