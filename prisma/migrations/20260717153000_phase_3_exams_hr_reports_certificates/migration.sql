-- CreateTable
CREATE TABLE `exam_grades` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `result_type` ENUM('GENERAL', 'SCHOOL_GRADING', 'COLLEGE_GRADING', 'GPA') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `min_percent` DECIMAL(5, 2) NOT NULL,
    `max_percent` DECIMAL(5, 2) NOT NULL,
    `grade_point` DECIMAL(5, 2) NULL,
    `pass_status` ENUM('PASS', 'FAIL') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `exam_grades_tenant_id_result_type_min_percent_max_percent_idx`(`tenant_id`, `result_type`, `min_percent`, `max_percent`),
    UNIQUE INDEX `exam_grades_tenant_id_result_type_name_key`(`tenant_id`, `result_type`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_groups` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `academic_session_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `result_type` ENUM('GENERAL', 'SCHOOL_GRADING', 'COLLEGE_GRADING', 'GPA') NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `exam_groups_tenant_id_academic_session_id_idx`(`tenant_id`, `academic_session_id`),
    UNIQUE INDEX `exam_groups_tenant_id_academic_session_id_name_key`(`tenant_id`, `academic_session_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exams` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `exam_group_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `exams_tenant_id_status_start_date_idx`(`tenant_id`, `status`, `start_date`),
    UNIQUE INDEX `exams_tenant_id_exam_group_id_name_key`(`tenant_id`, `exam_group_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_schedules` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `exam_id` VARCHAR(191) NOT NULL,
    `class_section_id` VARCHAR(191) NOT NULL,
    `class_subject_id` VARCHAR(191) NOT NULL,
    `exam_date` DATE NOT NULL,
    `start_time` VARCHAR(191) NOT NULL,
    `end_time` VARCHAR(191) NOT NULL,
    `room` VARCHAR(191) NULL,
    `maximum_marks` DECIMAL(8, 2) NOT NULL,
    `minimum_marks` DECIMAL(8, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `exam_schedules_tenant_id_exam_date_idx`(`tenant_id`, `exam_date`),
    UNIQUE INDEX `exam_schedules_tenant_id_exam_id_class_section_id_class_subj_key`(`tenant_id`, `exam_id`, `class_section_id`, `class_subject_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_students` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `exam_id` VARCHAR(191) NOT NULL,
    `student_enrollment_id` VARCHAR(191) NOT NULL,
    `roll_number` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `exam_students_tenant_id_exam_id_idx`(`tenant_id`, `exam_id`),
    UNIQUE INDEX `exam_students_tenant_id_exam_id_student_enrollment_id_key`(`tenant_id`, `exam_id`, `student_enrollment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_marks` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `schedule_id` VARCHAR(191) NOT NULL,
    `exam_student_id` VARCHAR(191) NOT NULL,
    `marks_obtained` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `is_absent` BOOLEAN NOT NULL DEFAULT false,
    `remarks` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `exam_marks_tenant_id_exam_student_id_idx`(`tenant_id`, `exam_student_id`),
    UNIQUE INDEX `exam_marks_tenant_id_schedule_id_exam_student_id_key`(`tenant_id`, `schedule_id`, `exam_student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_mark_components` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `schedule_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `maximum_marks` DECIMAL(8, 2) NOT NULL,

    UNIQUE INDEX `exam_mark_components_tenant_id_schedule_id_name_key`(`tenant_id`, `schedule_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_mark_component_scores` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `exam_mark_id` VARCHAR(191) NOT NULL,
    `component_id` VARCHAR(191) NOT NULL,
    `marks` DECIMAL(8, 2) NOT NULL,

    UNIQUE INDEX `exam_mark_component_scores_tenant_id_exam_mark_id_component__key`(`tenant_id`, `exam_mark_id`, `component_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_aspect_fields` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `exam_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `maximum_value` DECIMAL(8, 2) NOT NULL,

    UNIQUE INDEX `exam_aspect_fields_tenant_id_exam_id_name_key`(`tenant_id`, `exam_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_aspect_values` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `aspect_field_id` VARCHAR(191) NOT NULL,
    `exam_student_id` VARCHAR(191) NOT NULL,
    `value` DECIMAL(8, 2) NOT NULL,
    `remarks` VARCHAR(191) NULL,

    UNIQUE INDEX `exam_aspect_values_tenant_id_aspect_field_id_exam_student_id_key`(`tenant_id`, `aspect_field_id`, `exam_student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `departments_tenant_id_name_key`(`tenant_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `designations` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `designations_tenant_id_name_key`(`tenant_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_leave_types` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `annual_limit` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `staff_leave_types_tenant_id_name_key`(`tenant_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `employee_number` VARCHAR(191) NOT NULL,
    `department_id` VARCHAR(191) NULL,
    `designation_id` VARCHAR(191) NULL,
    `joining_date` DATE NOT NULL,
    `date_of_birth` DATE NULL,
    `phone` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `basic_salary` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `disabled_reason` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `staff_profiles_user_id_key`(`user_id`),
    INDEX `staff_profiles_tenant_id_status_idx`(`tenant_id`, `status`),
    UNIQUE INDEX `staff_profiles_tenant_id_employee_number_key`(`tenant_id`, `employee_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_attendance` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `staff_id` VARCHAR(191) NOT NULL,
    `attendance_date` DATE NOT NULL,
    `status` ENUM('PRESENT', 'LATE', 'ABSENT', 'HALF_DAY', 'HOLIDAY') NOT NULL,
    `in_time` VARCHAR(191) NULL,
    `out_time` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `marked_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `staff_attendance_tenant_id_attendance_date_status_idx`(`tenant_id`, `attendance_date`, `status`),
    UNIQUE INDEX `staff_attendance_tenant_id_staff_id_attendance_date_key`(`tenant_id`, `staff_id`, `attendance_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_leaves` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `staff_id` VARCHAR(191) NOT NULL,
    `leave_type_id` VARCHAR(191) NOT NULL,
    `from_date` DATE NOT NULL,
    `to_date` DATE NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewed_by_id` VARCHAR(191) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `review_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `staff_leaves_tenant_id_status_from_date_idx`(`tenant_id`, `status`, `from_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_adjustments` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `staff_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('EARNING', 'DEDUCTION') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `is_recurring` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `staff_adjustments_tenant_id_staff_id_is_active_idx`(`tenant_id`, `staff_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payrolls` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `staff_id` VARCHAR(191) NOT NULL,
    `academic_session_id` VARCHAR(191) NOT NULL,
    `payroll_month` DATE NOT NULL,
    `basic_salary` DECIMAL(12, 2) NOT NULL,
    `attendance_deduction` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `gross_amount` DECIMAL(12, 2) NOT NULL,
    `net_amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('NOT_GENERATED', 'GENERATED', 'PAID') NOT NULL DEFAULT 'GENERATED',
    `paid_at` DATETIME(3) NULL,
    `payment_mode` ENUM('CASH', 'CARD', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'ONLINE', 'OTHER') NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payrolls_tenant_id_payroll_month_status_idx`(`tenant_id`, `payroll_month`, `status`),
    UNIQUE INDEX `payrolls_tenant_id_staff_id_payroll_month_key`(`tenant_id`, `staff_id`, `payroll_month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_items` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `payroll_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('EARNING', 'DEDUCTION') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,

    INDEX `payroll_items_tenant_id_payroll_id_idx`(`tenant_id`, `payroll_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teacher_ratings` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `staff_id` VARCHAR(191) NOT NULL,
    `rated_by_id` VARCHAR(191) NOT NULL,
    `rating` INTEGER NOT NULL,
    `comment` TEXT NULL,
    `rating_date` DATE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `teacher_ratings_tenant_id_staff_id_rating_date_idx`(`tenant_id`, `staff_id`, `rating_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_templates` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `type` ENUM('ADMIT_CARD', 'MARKSHEET', 'CERTIFICATE', 'ID_CARD') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `background_url` VARCHAR(191) NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `config` JSON NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `document_templates_tenant_id_type_is_active_idx`(`tenant_id`, `type`, `is_active`),
    UNIQUE INDEX `document_templates_tenant_id_type_name_key`(`tenant_id`, `type`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `generated_documents` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `template_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NULL,
    `staff_id` VARCHAR(191) NULL,
    `exam_id` VARCHAR(191) NULL,
    `serial_number` VARCHAR(191) NOT NULL,
    `barcode_value` VARCHAR(191) NULL,
    `payload` JSON NOT NULL,
    `generated_by_id` VARCHAR(191) NOT NULL,
    `generated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `generated_documents_tenant_id_template_id_generated_at_idx`(`tenant_id`, `template_id`, `generated_at`),
    INDEX `generated_documents_student_id_idx`(`student_id`),
    INDEX `generated_documents_staff_id_idx`(`staff_id`),
    UNIQUE INDEX `generated_documents_tenant_id_serial_number_key`(`tenant_id`, `serial_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    INDEX `audit_logs_tenant_id_entity_type_entity_id_idx`(`tenant_id`, `entity_type`, `entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `exam_grades` ADD CONSTRAINT `exam_grades_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_groups` ADD CONSTRAINT `exam_groups_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_groups` ADD CONSTRAINT `exam_groups_academic_session_id_fkey` FOREIGN KEY (`academic_session_id`) REFERENCES `academic_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `exams_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `exams_exam_group_id_fkey` FOREIGN KEY (`exam_group_id`) REFERENCES `exam_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_schedules` ADD CONSTRAINT `exam_schedules_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_schedules` ADD CONSTRAINT `exam_schedules_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_schedules` ADD CONSTRAINT `exam_schedules_class_section_id_fkey` FOREIGN KEY (`class_section_id`) REFERENCES `class_sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_schedules` ADD CONSTRAINT `exam_schedules_class_subject_id_fkey` FOREIGN KEY (`class_subject_id`) REFERENCES `class_subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_students` ADD CONSTRAINT `exam_students_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_students` ADD CONSTRAINT `exam_students_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_students` ADD CONSTRAINT `exam_students_student_enrollment_id_fkey` FOREIGN KEY (`student_enrollment_id`) REFERENCES `student_enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_marks` ADD CONSTRAINT `exam_marks_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_marks` ADD CONSTRAINT `exam_marks_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `exam_schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_marks` ADD CONSTRAINT `exam_marks_exam_student_id_fkey` FOREIGN KEY (`exam_student_id`) REFERENCES `exam_students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_mark_components` ADD CONSTRAINT `exam_mark_components_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_mark_components` ADD CONSTRAINT `exam_mark_components_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `exam_schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_mark_component_scores` ADD CONSTRAINT `exam_mark_component_scores_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_mark_component_scores` ADD CONSTRAINT `exam_mark_component_scores_exam_mark_id_fkey` FOREIGN KEY (`exam_mark_id`) REFERENCES `exam_marks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_mark_component_scores` ADD CONSTRAINT `exam_mark_component_scores_component_id_fkey` FOREIGN KEY (`component_id`) REFERENCES `exam_mark_components`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_aspect_fields` ADD CONSTRAINT `exam_aspect_fields_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_aspect_fields` ADD CONSTRAINT `exam_aspect_fields_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_aspect_values` ADD CONSTRAINT `exam_aspect_values_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_aspect_values` ADD CONSTRAINT `exam_aspect_values_aspect_field_id_fkey` FOREIGN KEY (`aspect_field_id`) REFERENCES `exam_aspect_fields`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_aspect_values` ADD CONSTRAINT `exam_aspect_values_exam_student_id_fkey` FOREIGN KEY (`exam_student_id`) REFERENCES `exam_students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designations` ADD CONSTRAINT `designations_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_leave_types` ADD CONSTRAINT `staff_leave_types_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_profiles` ADD CONSTRAINT `staff_profiles_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_profiles` ADD CONSTRAINT `staff_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_profiles` ADD CONSTRAINT `staff_profiles_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_profiles` ADD CONSTRAINT `staff_profiles_designation_id_fkey` FOREIGN KEY (`designation_id`) REFERENCES `designations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_attendance` ADD CONSTRAINT `staff_attendance_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_attendance` ADD CONSTRAINT `staff_attendance_staff_id_fkey` FOREIGN KEY (`staff_id`) REFERENCES `staff_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_attendance` ADD CONSTRAINT `staff_attendance_marked_by_id_fkey` FOREIGN KEY (`marked_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_leaves` ADD CONSTRAINT `staff_leaves_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_leaves` ADD CONSTRAINT `staff_leaves_staff_id_fkey` FOREIGN KEY (`staff_id`) REFERENCES `staff_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_leaves` ADD CONSTRAINT `staff_leaves_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `staff_leave_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_leaves` ADD CONSTRAINT `staff_leaves_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_adjustments` ADD CONSTRAINT `staff_adjustments_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_adjustments` ADD CONSTRAINT `staff_adjustments_staff_id_fkey` FOREIGN KEY (`staff_id`) REFERENCES `staff_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payrolls` ADD CONSTRAINT `payrolls_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payrolls` ADD CONSTRAINT `payrolls_staff_id_fkey` FOREIGN KEY (`staff_id`) REFERENCES `staff_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payrolls` ADD CONSTRAINT `payrolls_academic_session_id_fkey` FOREIGN KEY (`academic_session_id`) REFERENCES `academic_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_items` ADD CONSTRAINT `payroll_items_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_items` ADD CONSTRAINT `payroll_items_payroll_id_fkey` FOREIGN KEY (`payroll_id`) REFERENCES `payrolls`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_ratings` ADD CONSTRAINT `teacher_ratings_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_ratings` ADD CONSTRAINT `teacher_ratings_staff_id_fkey` FOREIGN KEY (`staff_id`) REFERENCES `staff_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_ratings` ADD CONSTRAINT `teacher_ratings_rated_by_id_fkey` FOREIGN KEY (`rated_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_templates` ADD CONSTRAINT `document_templates_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generated_documents` ADD CONSTRAINT `generated_documents_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generated_documents` ADD CONSTRAINT `generated_documents_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `document_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generated_documents` ADD CONSTRAINT `generated_documents_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generated_documents` ADD CONSTRAINT `generated_documents_staff_id_fkey` FOREIGN KEY (`staff_id`) REFERENCES `staff_profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generated_documents` ADD CONSTRAINT `generated_documents_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generated_documents` ADD CONSTRAINT `generated_documents_generated_by_id_fkey` FOREIGN KEY (`generated_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
