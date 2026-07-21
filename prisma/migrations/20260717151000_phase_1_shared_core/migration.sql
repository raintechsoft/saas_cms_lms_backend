-- CreateTable
CREATE TABLE `tenant_settings` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `address` TEXT NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Kolkata',
    `date_format` VARCHAR(191) NOT NULL DEFAULT 'dd-MM-yyyy',
    `attendance_type` ENUM('DAY_WISE', 'PERIOD_WISE', 'BIOMETRIC') NOT NULL DEFAULT 'DAY_WISE',
    `auto_admission_number` BOOLEAN NOT NULL DEFAULT false,
    `admission_prefix` VARCHAR(191) NULL,
    `next_admission_number` INTEGER NOT NULL DEFAULT 1,
    `teacher_restricted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tenant_settings_tenant_id_key`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_categories` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `student_categories_tenant_id_idx`(`tenant_id`),
    UNIQUE INDEX `student_categories_tenant_id_name_key`(`tenant_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_houses` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `student_houses_tenant_id_idx`(`tenant_id`),
    UNIQUE INDEX `student_houses_tenant_id_name_key`(`tenant_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `students` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `admission_number` VARCHAR(191) NOT NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NULL,
    `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL,
    `date_of_birth` DATE NULL,
    `category_id` VARCHAR(191) NULL,
    `house_id` VARCHAR(191) NULL,
    `religion` VARCHAR(191) NULL,
    `caste` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `admission_date` DATE NOT NULL,
    `photo_url` VARCHAR(191) NULL,
    `blood_group` VARCHAR(191) NULL,
    `height` DOUBLE NULL,
    `weight` DOUBLE NULL,
    `current_address` TEXT NULL,
    `permanent_address` TEXT NULL,
    `father_name` VARCHAR(191) NULL,
    `father_phone` VARCHAR(191) NULL,
    `mother_name` VARCHAR(191) NULL,
    `mother_phone` VARCHAR(191) NULL,
    `guardian_name` VARCHAR(191) NULL,
    `guardian_relation` VARCHAR(191) NULL,
    `guardian_phone` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'DISABLED', 'ALUMNI') NOT NULL DEFAULT 'ACTIVE',
    `disabled_reason` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `students_user_id_key`(`user_id`),
    INDEX `students_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `students_tenant_id_first_name_last_name_idx`(`tenant_id`, `first_name`, `last_name`),
    INDEX `students_category_id_idx`(`category_id`),
    INDEX `students_house_id_idx`(`house_id`),
    UNIQUE INDEX `students_tenant_id_admission_number_key`(`tenant_id`, `admission_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `academic_classes` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `academic_classes_tenant_id_sort_order_idx`(`tenant_id`, `sort_order`),
    UNIQUE INDEX `academic_classes_tenant_id_name_key`(`tenant_id`, `name`),
    UNIQUE INDEX `academic_classes_tenant_id_code_key`(`tenant_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sections` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sections_tenant_id_idx`(`tenant_id`),
    UNIQUE INDEX `sections_tenant_id_name_key`(`tenant_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `class_sections` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `academic_session_id` VARCHAR(191) NOT NULL,
    `class_id` VARCHAR(191) NOT NULL,
    `section_id` VARCHAR(191) NOT NULL,
    `class_teacher_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `class_sections_tenant_id_academic_session_id_idx`(`tenant_id`, `academic_session_id`),
    INDEX `class_sections_class_teacher_id_idx`(`class_teacher_id`),
    UNIQUE INDEX `class_sections_tenant_id_academic_session_id_class_id_sectio_key`(`tenant_id`, `academic_session_id`, `class_id`, `section_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subjects` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `type` ENUM('CORE', 'ELECTIVE') NOT NULL DEFAULT 'CORE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `subjects_tenant_id_idx`(`tenant_id`),
    UNIQUE INDEX `subjects_tenant_id_name_key`(`tenant_id`, `name`),
    UNIQUE INDEX `subjects_tenant_id_code_key`(`tenant_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `class_subjects` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `class_section_id` VARCHAR(191) NOT NULL,
    `subject_id` VARCHAR(191) NOT NULL,
    `teacher_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `class_subjects_tenant_id_teacher_id_idx`(`tenant_id`, `teacher_id`),
    UNIQUE INDEX `class_subjects_tenant_id_class_section_id_subject_id_key`(`tenant_id`, `class_section_id`, `subject_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_enrollments` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `academic_session_id` VARCHAR(191) NOT NULL,
    `class_section_id` VARCHAR(191) NOT NULL,
    `roll_number` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'PROMOTED', 'WITHDRAWN') NOT NULL DEFAULT 'ACTIVE',
    `enrolled_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `student_enrollments_tenant_id_academic_session_id_class_sect_idx`(`tenant_id`, `academic_session_id`, `class_section_id`),
    UNIQUE INDEX `student_enrollments_tenant_id_student_id_academic_session_id_key`(`tenant_id`, `student_id`, `academic_session_id`, `class_section_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tenant_settings` ADD CONSTRAINT `tenant_settings_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_categories` ADD CONSTRAINT `student_categories_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_houses` ADD CONSTRAINT `student_houses_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `student_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_house_id_fkey` FOREIGN KEY (`house_id`) REFERENCES `student_houses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `academic_classes` ADD CONSTRAINT `academic_classes_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sections` ADD CONSTRAINT `sections_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sections` ADD CONSTRAINT `class_sections_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sections` ADD CONSTRAINT `class_sections_academic_session_id_fkey` FOREIGN KEY (`academic_session_id`) REFERENCES `academic_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sections` ADD CONSTRAINT `class_sections_class_id_fkey` FOREIGN KEY (`class_id`) REFERENCES `academic_classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sections` ADD CONSTRAINT `class_sections_section_id_fkey` FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sections` ADD CONSTRAINT `class_sections_class_teacher_id_fkey` FOREIGN KEY (`class_teacher_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_subjects` ADD CONSTRAINT `class_subjects_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_subjects` ADD CONSTRAINT `class_subjects_class_section_id_fkey` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_subjects` ADD CONSTRAINT `class_subjects_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_subjects` ADD CONSTRAINT `class_subjects_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_enrollments` ADD CONSTRAINT `student_enrollments_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_enrollments` ADD CONSTRAINT `student_enrollments_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_enrollments` ADD CONSTRAINT `student_enrollments_academic_session_id_fkey` FOREIGN KEY (`academic_session_id`) REFERENCES `academic_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_enrollments` ADD CONSTRAINT `student_enrollments_class_section_id_fkey` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
