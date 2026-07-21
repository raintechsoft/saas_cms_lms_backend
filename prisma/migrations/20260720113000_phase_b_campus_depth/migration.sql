-- AlterTable
ALTER TABLE `students` ADD COLUMN `sibling_group_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `students_tenant_id_sibling_group_id_idx` ON `students`(`tenant_id`, `sibling_group_id`);

-- CreateTable
CREATE TABLE `disable_reasons` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `disable_reasons_tenant_id_name_key`(`tenant_id`, `name`),
    INDEX `disable_reasons_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `online_admission_applications` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `academic_session_id` VARCHAR(191) NULL,
    `class_section_id` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NULL,
    `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL,
    `date_of_birth` DATE NULL,
    `mobile` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `father_name` VARCHAR(191) NULL,
    `mother_name` VARCHAR(191) NULL,
    `guardian_phone` VARCHAR(191) NULL,
    `current_address` TEXT NULL,
    `payload` JSON NULL,
    `review_note` TEXT NULL,
    `reviewed_by_id` VARCHAR(191) NULL,
    `student_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `online_admission_applications_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `online_admission_applications_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `disable_reasons` ADD CONSTRAINT `disable_reasons_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `online_admission_applications` ADD CONSTRAINT `online_admission_applications_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `online_admission_applications` ADD CONSTRAINT `online_admission_applications_academic_session_id_fkey` FOREIGN KEY (`academic_session_id`) REFERENCES `academic_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `online_admission_applications` ADD CONSTRAINT `online_admission_applications_class_section_id_fkey` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `online_admission_applications` ADD CONSTRAINT `online_admission_applications_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `online_admission_applications` ADD CONSTRAINT `online_admission_applications_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
