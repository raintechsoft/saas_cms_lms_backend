-- CreateTable
CREATE TABLE `fee_types` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `fee_types_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    UNIQUE INDEX `fee_types_tenant_id_name_key`(`tenant_id`, `name`),
    UNIQUE INDEX `fee_types_tenant_id_code_key`(`tenant_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee_groups` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `fee_groups_tenant_id_idx`(`tenant_id`),
    UNIQUE INDEX `fee_groups_tenant_id_name_key`(`tenant_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee_group_items` (
    `fee_group_id` VARCHAR(191) NOT NULL,
    `fee_type_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`fee_group_id`, `fee_type_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee_masters` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `academic_session_id` VARCHAR(191) NOT NULL,
    `class_section_id` VARCHAR(191) NULL,
    `fee_group_id` VARCHAR(191) NOT NULL,
    `fee_type_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `due_date` DATE NOT NULL,
    `fine_type` ENUM('NONE', 'FIXED', 'PERCENTAGE') NOT NULL DEFAULT 'NONE',
    `fine_value` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `grace_days` INTEGER NOT NULL DEFAULT 0,
    `is_custom` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `fee_masters_tenant_id_academic_session_id_due_date_idx`(`tenant_id`, `academic_session_id`, `due_date`),
    INDEX `fee_masters_class_section_id_idx`(`class_section_id`),
    UNIQUE INDEX `fee_masters_tenant_id_academic_session_id_class_section_id_f_key`(`tenant_id`, `academic_session_id`, `class_section_id`, `fee_group_id`, `fee_type_id`, `due_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee_discounts` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('FIXED', 'PERCENTAGE') NOT NULL,
    `value` DECIMAL(12, 2) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `fee_discounts_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    UNIQUE INDEX `fee_discounts_tenant_id_name_key`(`tenant_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_fee_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `student_enrollment_id` VARCHAR(191) NOT NULL,
    `fee_master_id` VARCHAR(191) NOT NULL,
    `discount_id` VARCHAR(191) NULL,
    `custom_amount` DECIMAL(12, 2) NULL,
    `carry_forward_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'WAIVED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `student_fee_assignments_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `student_fee_assignments_discount_id_idx`(`discount_id`),
    UNIQUE INDEX `student_fee_assignments_tenant_id_student_enrollment_id_fee__key`(`tenant_id`, `student_enrollment_id`, `fee_master_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee_receipt_books` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `prefix` VARCHAR(191) NOT NULL,
    `next_number` INTEGER NOT NULL DEFAULT 1,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `fee_receipt_books_tenant_id_is_default_idx`(`tenant_id`, `is_default`),
    UNIQUE INDEX `fee_receipt_books_tenant_id_name_key`(`tenant_id`, `name`),
    UNIQUE INDEX `fee_receipt_books_tenant_id_prefix_key`(`tenant_id`, `prefix`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee_payments` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `academic_session_id` VARCHAR(191) NOT NULL,
    `receipt_book_id` VARCHAR(191) NOT NULL,
    `receipt_number` VARCHAR(191) NOT NULL,
    `payment_id` VARCHAR(191) NOT NULL,
    `payment_date` DATE NOT NULL,
    `payment_mode` ENUM('CASH', 'CARD', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'ONLINE', 'OTHER') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `note` TEXT NULL,
    `status` ENUM('COLLECTED', 'REVERTED') NOT NULL DEFAULT 'COLLECTED',
    `created_by_id` VARCHAR(191) NOT NULL,
    `reverted_at` DATETIME(3) NULL,
    `revert_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `fee_payments_tenant_id_payment_date_status_idx`(`tenant_id`, `payment_date`, `status`),
    INDEX `fee_payments_tenant_id_student_id_idx`(`tenant_id`, `student_id`),
    UNIQUE INDEX `fee_payments_tenant_id_receipt_number_key`(`tenant_id`, `receipt_number`),
    UNIQUE INDEX `fee_payments_tenant_id_payment_id_key`(`tenant_id`, `payment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee_payment_items` (
    `id` VARCHAR(191) NOT NULL,
    `payment_id` VARCHAR(191) NOT NULL,
    `assignment_id` VARCHAR(191) NOT NULL,
    `base_amount` DECIMAL(12, 2) NOT NULL,
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `fine_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `paid_amount` DECIMAL(12, 2) NOT NULL,

    INDEX `fee_payment_items_assignment_id_idx`(`assignment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_fee_settings` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `auto_reminder` BOOLEAN NOT NULL DEFAULT false,
    `reminder_days_before` INTEGER NOT NULL DEFAULT 3,
    `reminder_days_after` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tenant_fee_settings_tenant_id_key`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_records` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `student_enrollment_id` VARCHAR(191) NOT NULL,
    `academic_session_id` VARCHAR(191) NOT NULL,
    `class_section_id` VARCHAR(191) NOT NULL,
    `attendance_date` DATE NOT NULL,
    `period_key` VARCHAR(191) NOT NULL DEFAULT 'DAY',
    `status` ENUM('PRESENT', 'LATE', 'ABSENT', 'HALF_DAY', 'HOLIDAY') NOT NULL,
    `in_time` VARCHAR(191) NULL,
    `out_time` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `marked_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_records_tenant_id_class_section_id_attendance_dat_idx`(`tenant_id`, `class_section_id`, `attendance_date`),
    INDEX `attendance_records_tenant_id_academic_session_id_status_idx`(`tenant_id`, `academic_session_id`, `status`),
    UNIQUE INDEX `attendance_records_tenant_id_student_enrollment_id_attendanc_key`(`tenant_id`, `student_enrollment_id`, `attendance_date`, `period_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_leaves` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `student_enrollment_id` VARCHAR(191) NOT NULL,
    `academic_session_id` VARCHAR(191) NOT NULL,
    `from_date` DATE NOT NULL,
    `to_date` DATE NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewed_by_id` VARCHAR(191) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `review_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `student_leaves_tenant_id_status_from_date_idx`(`tenant_id`, `status`, `from_date`),
    INDEX `student_leaves_student_enrollment_id_idx`(`student_enrollment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_points` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `student_enrollment_id` VARCHAR(191) NOT NULL,
    `academic_session_id` VARCHAR(191) NOT NULL,
    `point_date` DATE NOT NULL,
    `points` INTEGER NOT NULL,
    `note` TEXT NULL,
    `awarded_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attendance_points_tenant_id_academic_session_id_point_date_idx`(`tenant_id`, `academic_session_id`, `point_date`),
    INDEX `attendance_points_student_enrollment_id_idx`(`student_enrollment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `fee_types` ADD CONSTRAINT `fee_types_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_groups` ADD CONSTRAINT `fee_groups_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_group_items` ADD CONSTRAINT `fee_group_items_fee_group_id_fkey` FOREIGN KEY (`fee_group_id`) REFERENCES `fee_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_group_items` ADD CONSTRAINT `fee_group_items_fee_type_id_fkey` FOREIGN KEY (`fee_type_id`) REFERENCES `fee_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_masters` ADD CONSTRAINT `fee_masters_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_masters` ADD CONSTRAINT `fee_masters_academic_session_id_fkey` FOREIGN KEY (`academic_session_id`) REFERENCES `academic_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_masters` ADD CONSTRAINT `fee_masters_class_section_id_fkey` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_masters` ADD CONSTRAINT `fee_masters_fee_group_id_fkey` FOREIGN KEY (`fee_group_id`) REFERENCES `fee_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_masters` ADD CONSTRAINT `fee_masters_fee_type_id_fkey` FOREIGN KEY (`fee_type_id`) REFERENCES `fee_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_discounts` ADD CONSTRAINT `fee_discounts_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_fee_assignments` ADD CONSTRAINT `student_fee_assignments_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_fee_assignments` ADD CONSTRAINT `student_fee_assignments_student_enrollment_id_fkey` FOREIGN KEY (`student_enrollment_id`) REFERENCES `student_enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_fee_assignments` ADD CONSTRAINT `student_fee_assignments_fee_master_id_fkey` FOREIGN KEY (`fee_master_id`) REFERENCES `fee_masters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_fee_assignments` ADD CONSTRAINT `student_fee_assignments_discount_id_fkey` FOREIGN KEY (`discount_id`) REFERENCES `fee_discounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_receipt_books` ADD CONSTRAINT `fee_receipt_books_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_payments` ADD CONSTRAINT `fee_payments_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_payments` ADD CONSTRAINT `fee_payments_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_payments` ADD CONSTRAINT `fee_payments_academic_session_id_fkey` FOREIGN KEY (`academic_session_id`) REFERENCES `academic_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_payments` ADD CONSTRAINT `fee_payments_receipt_book_id_fkey` FOREIGN KEY (`receipt_book_id`) REFERENCES `fee_receipt_books`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_payments` ADD CONSTRAINT `fee_payments_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_payment_items` ADD CONSTRAINT `fee_payment_items_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `fee_payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_payment_items` ADD CONSTRAINT `fee_payment_items_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `student_fee_assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_fee_settings` ADD CONSTRAINT `tenant_fee_settings_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_student_enrollment_id_fkey` FOREIGN KEY (`student_enrollment_id`) REFERENCES `student_enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_academic_session_id_fkey` FOREIGN KEY (`academic_session_id`) REFERENCES `academic_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_class_section_id_fkey` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_marked_by_id_fkey` FOREIGN KEY (`marked_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_leaves` ADD CONSTRAINT `student_leaves_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_leaves` ADD CONSTRAINT `student_leaves_student_enrollment_id_fkey` FOREIGN KEY (`student_enrollment_id`) REFERENCES `student_enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_leaves` ADD CONSTRAINT `student_leaves_academic_session_id_fkey` FOREIGN KEY (`academic_session_id`) REFERENCES `academic_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_leaves` ADD CONSTRAINT `student_leaves_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_points` ADD CONSTRAINT `attendance_points_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_points` ADD CONSTRAINT `attendance_points_student_enrollment_id_fkey` FOREIGN KEY (`student_enrollment_id`) REFERENCES `student_enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_points` ADD CONSTRAINT `attendance_points_academic_session_id_fkey` FOREIGN KEY (`academic_session_id`) REFERENCES `academic_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_points` ADD CONSTRAINT `attendance_points_awarded_by_id_fkey` FOREIGN KEY (`awarded_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
