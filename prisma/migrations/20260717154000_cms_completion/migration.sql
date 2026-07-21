-- AlterTable
ALTER TABLE `tenant_settings` ADD COLUMN `auto_staff_number` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `exam_result_type` ENUM('GENERAL', 'SCHOOL_GRADING', 'COLLEGE_GRADING', 'GPA') NOT NULL DEFAULT 'GENERAL',
    ADD COLUMN `live_class_auto_attendance` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `next_staff_number` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `online_admission` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `staff_prefix` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `timetable_entries` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `academic_session_id` VARCHAR(191) NOT NULL,
    `class_section_id` VARCHAR(191) NOT NULL,
    `class_subject_id` VARCHAR(191) NOT NULL,
    `teacher_id` VARCHAR(191) NULL,
    `weekday` ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY') NOT NULL,
    `start_time` VARCHAR(191) NOT NULL,
    `end_time` VARCHAR(191) NOT NULL,
    `room` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `timetable_entries_tenant_id_academic_session_id_weekday_idx`(`tenant_id`, `academic_session_id`, `weekday`),
    INDEX `timetable_entries_tenant_id_teacher_id_weekday_idx`(`tenant_id`, `teacher_id`, `weekday`),
    UNIQUE INDEX `timetable_entries_tenant_id_class_section_id_weekday_start_t_key`(`tenant_id`, `class_section_id`, `weekday`, `start_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `homework` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `academic_session_id` VARCHAR(191) NOT NULL,
    `class_section_id` VARCHAR(191) NOT NULL,
    `class_subject_id` VARCHAR(191) NOT NULL,
    `teacher_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `attachment_url` VARCHAR(191) NULL,
    `homework_date` DATE NOT NULL,
    `submission_date` DATE NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'CLOSED') NOT NULL DEFAULT 'PUBLISHED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `homework_tenant_id_academic_session_id_class_section_id_subm_idx`(`tenant_id`, `academic_session_id`, `class_section_id`, `submission_date`),
    INDEX `homework_tenant_id_teacher_id_status_idx`(`tenant_id`, `teacher_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `homework_submissions` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `homework_id` VARCHAR(191) NOT NULL,
    `student_enrollment_id` VARCHAR(191) NOT NULL,
    `answer_text` TEXT NULL,
    `attachment_url` VARCHAR(191) NULL,
    `status` ENUM('SUBMITTED', 'EVALUATED', 'RESUBMIT_REQUESTED', 'COMPLETED') NOT NULL DEFAULT 'SUBMITTED',
    `attempt` INTEGER NOT NULL DEFAULT 1,
    `review` TEXT NULL,
    `evaluated_by_id` VARCHAR(191) NULL,
    `evaluated_at` DATETIME(3) NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `homework_submissions_tenant_id_status_submitted_at_idx`(`tenant_id`, `status`, `submitted_at`),
    UNIQUE INDEX `homework_submissions_tenant_id_homework_id_student_enrollmen_key`(`tenant_id`, `homework_id`, `student_enrollment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `erp_integration_settings` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `category` ENUM('NOTIFICATION', 'SMS', 'EMAIL', 'WEBSITE', 'LIVE_CLASS') NOT NULL,
    `provider` VARCHAR(191) NULL,
    `is_enabled` BOOLEAN NOT NULL DEFAULT false,
    `config` JSON NOT NULL,
    `encrypted_secrets` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `erp_integration_settings_tenant_id_category_key`(`tenant_id`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_payment_methods` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `instructions` TEXT NULL,
    `config` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tenant_payment_methods_tenant_id_is_active_sort_order_idx`(`tenant_id`, `is_active`, `sort_order`),
    UNIQUE INDEX `tenant_payment_methods_tenant_id_code_key`(`tenant_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_module_settings` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `module_key` VARCHAR(191) NOT NULL,
    `admin_enabled` BOOLEAN NOT NULL DEFAULT true,
    `student_enabled` BOOLEAN NOT NULL DEFAULT true,
    `parent_enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tenant_module_settings_tenant_id_module_key_key`(`tenant_id`, `module_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_languages` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `is_enabled` BOOLEAN NOT NULL DEFAULT true,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tenant_languages_tenant_id_is_enabled_idx`(`tenant_id`, `is_enabled`),
    UNIQUE INDEX `tenant_languages_tenant_id_code_key`(`tenant_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `custom_fields` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `target` ENUM('STUDENT', 'STAFF', 'ADMISSION') NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `type` ENUM('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX') NOT NULL,
    `options` JSON NULL,
    `is_required` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `custom_fields_tenant_id_target_is_active_idx`(`tenant_id`, `target`, `is_active`),
    UNIQUE INDEX `custom_fields_tenant_id_target_key_key`(`tenant_id`, `target`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_field_settings` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `target` ENUM('STUDENT', 'STAFF', 'ADMISSION') NOT NULL,
    `field_key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `is_enabled` BOOLEAN NOT NULL DEFAULT true,
    `is_required` BOOLEAN NOT NULL DEFAULT false,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_field_settings_tenant_id_target_field_key_key`(`tenant_id`, `target`, `field_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shortcut_key_settings` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `action_key` VARCHAR(191) NOT NULL,
    `shortcut` VARCHAR(191) NOT NULL,
    `is_enabled` BOOLEAN NOT NULL DEFAULT true,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shortcut_key_settings_tenant_id_action_key_key`(`tenant_id`, `action_key`),
    UNIQUE INDEX `shortcut_key_settings_tenant_id_shortcut_key`(`tenant_id`, `shortcut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_profile_rights` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `field_key` VARCHAR(191) NOT NULL,
    `student_visible` BOOLEAN NOT NULL DEFAULT true,
    `parent_visible` BOOLEAN NOT NULL DEFAULT true,
    `student_editable` BOOLEAN NOT NULL DEFAULT false,
    `parent_editable` BOOLEAN NOT NULL DEFAULT false,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `student_profile_rights_tenant_id_field_key_key`(`tenant_id`, `field_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `holidays` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `academic_session_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `holidays_tenant_id_start_date_end_date_idx`(`tenant_id`, `start_date`, `end_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_document_folders` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `parent_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `student_document_folders_tenant_id_parent_id_idx`(`tenant_id`, `parent_id`),
    UNIQUE INDEX `student_document_folders_tenant_id_parent_id_name_key`(`tenant_id`, `parent_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_documents` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `folder_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `file_url` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NULL,
    `size_bytes` INTEGER NULL,
    `uploaded_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `student_documents_tenant_id_student_id_folder_id_idx`(`tenant_id`, `student_id`, `folder_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `configuration_backups` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `snapshot` JSON NOT NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `restored_by_id` VARCHAR(191) NULL,
    `restored_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `configuration_backups_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_academic_session_id_fkey` FOREIGN KEY (`academic_session_id`) REFERENCES `academic_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_class_section_id_fkey` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_class_subject_id_fkey` FOREIGN KEY (`class_subject_id`) REFERENCES `class_subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `homework` ADD CONSTRAINT `homework_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `homework` ADD CONSTRAINT `homework_academic_session_id_fkey` FOREIGN KEY (`academic_session_id`) REFERENCES `academic_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `homework` ADD CONSTRAINT `homework_class_section_id_fkey` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `homework` ADD CONSTRAINT `homework_class_subject_id_fkey` FOREIGN KEY (`class_subject_id`) REFERENCES `class_subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `homework` ADD CONSTRAINT `homework_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `homework_submissions` ADD CONSTRAINT `homework_submissions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `homework_submissions` ADD CONSTRAINT `homework_submissions_homework_id_fkey` FOREIGN KEY (`homework_id`) REFERENCES `homework`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `homework_submissions` ADD CONSTRAINT `homework_submissions_student_enrollment_id_fkey` FOREIGN KEY (`student_enrollment_id`) REFERENCES `student_enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `homework_submissions` ADD CONSTRAINT `homework_submissions_evaluated_by_id_fkey` FOREIGN KEY (`evaluated_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `erp_integration_settings` ADD CONSTRAINT `erp_integration_settings_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_payment_methods` ADD CONSTRAINT `tenant_payment_methods_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_module_settings` ADD CONSTRAINT `tenant_module_settings_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_languages` ADD CONSTRAINT `tenant_languages_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custom_fields` ADD CONSTRAINT `custom_fields_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_field_settings` ADD CONSTRAINT `system_field_settings_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shortcut_key_settings` ADD CONSTRAINT `shortcut_key_settings_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_profile_rights` ADD CONSTRAINT `student_profile_rights_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `holidays` ADD CONSTRAINT `holidays_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `holidays` ADD CONSTRAINT `holidays_academic_session_id_fkey` FOREIGN KEY (`academic_session_id`) REFERENCES `academic_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_document_folders` ADD CONSTRAINT `student_document_folders_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_document_folders` ADD CONSTRAINT `student_document_folders_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `student_document_folders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_documents` ADD CONSTRAINT `student_documents_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_documents` ADD CONSTRAINT `student_documents_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_documents` ADD CONSTRAINT `student_documents_folder_id_fkey` FOREIGN KEY (`folder_id`) REFERENCES `student_document_folders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_documents` ADD CONSTRAINT `student_documents_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `configuration_backups` ADD CONSTRAINT `configuration_backups_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `configuration_backups` ADD CONSTRAINT `configuration_backups_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `configuration_backups` ADD CONSTRAINT `configuration_backups_restored_by_id_fkey` FOREIGN KEY (`restored_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
