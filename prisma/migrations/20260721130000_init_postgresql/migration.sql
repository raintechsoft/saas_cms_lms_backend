-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantType" AS ENUM ('SCHOOL', 'COLLEGE_UNIVERSITY', 'COACHING_CENTER', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "ProductMode" AS ENUM ('CMS', 'LMS', 'BOTH');

-- CreateEnum
CREATE TYPE "DistributionModel" AS ENUM ('UNIVERSE_AI', 'RESELLER', 'WHITE_LABEL');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AuthVerificationPurpose" AS ENUM ('LOGIN_OTP', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "AttendanceType" AS ENUM ('DAY_WISE', 'PERIOD_WISE', 'BIOMETRIC');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ALUMNI');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PROMOTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('CORE', 'ELECTIVE');

-- CreateEnum
CREATE TYPE "FeeFineType" AS ENUM ('NONE', 'FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "FeeAssignmentStatus" AS ENUM ('ACTIVE', 'WAIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'ONLINE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('COLLECTED', 'REVERTED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'HALF_DAY', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExamResultType" AS ENUM ('GENERAL', 'SCHOOL_GRADING', 'COLLEGE_GRADING', 'GPA');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "PassStatus" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "StaffAttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'HALF_DAY', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "StaffLeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('NOT_GENERATED', 'GENERATED', 'PAID');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "DocumentTemplateType" AS ENUM ('ADMIT_CARD', 'MARKSHEET', 'CERTIFICATE', 'ID_CARD');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "HomeworkStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "HomeworkSubmissionStatus" AS ENUM ('SUBMITTED', 'EVALUATED', 'RESUBMIT_REQUESTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ErpSettingCategory" AS ENUM ('NOTIFICATION', 'SMS', 'EMAIL', 'WEBSITE', 'LIVE_CLASS');

-- CreateEnum
CREATE TYPE "CustomFieldTarget" AS ENUM ('STUDENT', 'STAFF', 'ADMISSION');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX');

-- CreateEnum
CREATE TYPE "OnlineAdmissionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NoticeAudience" AS ENUM ('ALL', 'STUDENTS', 'PARENTS');

-- CreateTable
CREATE TABLE "resellers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "branding" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "TenantType" NOT NULL,
    "product_mode" "ProductMode" NOT NULL,
    "distribution_model" "DistributionModel" NOT NULL DEFAULT 'UNIVERSE_AI',
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "branding" JSONB,
    "reseller_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "reseller_id" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "google_subject_id" TEXT,
    "phone" TEXT,
    "avatar_url" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "tenant_id" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "academic_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "date_format" TEXT NOT NULL DEFAULT 'dd-MM-yyyy',
    "attendance_type" "AttendanceType" NOT NULL DEFAULT 'DAY_WISE',
    "auto_admission_number" BOOLEAN NOT NULL DEFAULT false,
    "admission_prefix" TEXT,
    "next_admission_number" INTEGER NOT NULL DEFAULT 1,
    "auto_staff_number" BOOLEAN NOT NULL DEFAULT false,
    "staff_prefix" TEXT,
    "next_staff_number" INTEGER NOT NULL DEFAULT 1,
    "teacher_restricted" BOOLEAN NOT NULL DEFAULT false,
    "exam_result_type" "ExamResultType" NOT NULL DEFAULT 'GENERAL',
    "online_admission" BOOLEAN NOT NULL DEFAULT false,
    "live_class_auto_attendance" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_houses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_houses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "admission_number" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "gender" "Gender",
    "date_of_birth" DATE,
    "category_id" TEXT,
    "house_id" TEXT,
    "religion" TEXT,
    "caste" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "admission_date" DATE NOT NULL,
    "photo_url" TEXT,
    "blood_group" TEXT,
    "height" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "current_address" TEXT,
    "permanent_address" TEXT,
    "father_name" TEXT,
    "father_phone" TEXT,
    "mother_name" TEXT,
    "mother_phone" TEXT,
    "guardian_name" TEXT,
    "guardian_relation" TEXT,
    "guardian_phone" TEXT,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "disabled_reason" TEXT,
    "sibling_group_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_classes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_sections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "academic_session_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "class_teacher_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" "SubjectType" NOT NULL DEFAULT 'CORE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_subjects" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "class_section_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "teacher_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_enrollments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "academic_session_id" TEXT NOT NULL,
    "class_section_id" TEXT NOT NULL,
    "roll_number" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_types" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_groups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_group_items" (
    "fee_group_id" TEXT NOT NULL,
    "fee_type_id" TEXT NOT NULL,

    CONSTRAINT "fee_group_items_pkey" PRIMARY KEY ("fee_group_id","fee_type_id")
);

-- CreateTable
CREATE TABLE "fee_masters" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "academic_session_id" TEXT NOT NULL,
    "class_section_id" TEXT,
    "fee_group_id" TEXT NOT NULL,
    "fee_type_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "fine_type" "FeeFineType" NOT NULL DEFAULT 'NONE',
    "fine_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grace_days" INTEGER NOT NULL DEFAULT 0,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_discounts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_fee_assignments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_enrollment_id" TEXT NOT NULL,
    "fee_master_id" TEXT NOT NULL,
    "discount_id" TEXT,
    "custom_amount" DECIMAL(12,2),
    "carry_forward_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "FeeAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_fee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_receipt_books" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_receipt_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_payments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "academic_session_id" TEXT NOT NULL,
    "receipt_book_id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "payment_date" DATE NOT NULL,
    "payment_mode" "PaymentMode" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COLLECTED',
    "created_by_id" TEXT NOT NULL,
    "reverted_at" TIMESTAMP(3),
    "revert_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_payment_items" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "base_amount" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fine_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "fee_payment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_fee_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "auto_reminder" BOOLEAN NOT NULL DEFAULT false,
    "reminder_days_before" INTEGER NOT NULL DEFAULT 3,
    "reminder_days_after" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_fee_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_enrollment_id" TEXT NOT NULL,
    "academic_session_id" TEXT NOT NULL,
    "class_section_id" TEXT NOT NULL,
    "attendance_date" DATE NOT NULL,
    "period_key" TEXT NOT NULL DEFAULT 'DAY',
    "status" "AttendanceStatus" NOT NULL,
    "in_time" TEXT,
    "out_time" TEXT,
    "note" TEXT,
    "marked_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_leaves" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_enrollment_id" TEXT NOT NULL,
    "academic_session_id" TEXT NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_points" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_enrollment_id" TEXT NOT NULL,
    "academic_session_id" TEXT NOT NULL,
    "point_date" DATE NOT NULL,
    "points" INTEGER NOT NULL,
    "note" TEXT,
    "awarded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_grades" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "result_type" "ExamResultType" NOT NULL,
    "name" TEXT NOT NULL,
    "min_percent" DECIMAL(5,2) NOT NULL,
    "max_percent" DECIMAL(5,2) NOT NULL,
    "grade_point" DECIMAL(5,2),
    "pass_status" "PassStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_groups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "academic_session_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "result_type" "ExamResultType" NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "exam_group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_schedules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "class_section_id" TEXT NOT NULL,
    "class_subject_id" TEXT NOT NULL,
    "exam_date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "room" TEXT,
    "maximum_marks" DECIMAL(8,2) NOT NULL,
    "minimum_marks" DECIMAL(8,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_students" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "student_enrollment_id" TEXT NOT NULL,
    "roll_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_marks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "exam_student_id" TEXT NOT NULL,
    "marks_obtained" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "is_absent" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_mark_components" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maximum_marks" DECIMAL(8,2) NOT NULL,

    CONSTRAINT "exam_mark_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_mark_component_scores" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "exam_mark_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "marks" DECIMAL(8,2) NOT NULL,

    CONSTRAINT "exam_mark_component_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_aspect_fields" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maximum_value" DECIMAL(8,2) NOT NULL,

    CONSTRAINT "exam_aspect_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_aspect_values" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "aspect_field_id" TEXT NOT NULL,
    "exam_student_id" TEXT NOT NULL,
    "value" DECIMAL(8,2) NOT NULL,
    "remarks" TEXT,

    CONSTRAINT "exam_aspect_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "designations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "designations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_leave_types" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "annual_limit" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_profiles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "employee_number" TEXT NOT NULL,
    "department_id" TEXT,
    "designation_id" TEXT,
    "joining_date" DATE NOT NULL,
    "date_of_birth" DATE,
    "phone" TEXT,
    "address" TEXT,
    "basic_salary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "disabled_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_attendance" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "attendance_date" DATE NOT NULL,
    "status" "StaffAttendanceStatus" NOT NULL,
    "in_time" TEXT,
    "out_time" TEXT,
    "note" TEXT,
    "marked_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_leaves" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "StaffLeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_adjustments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AdjustmentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payrolls" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "academic_session_id" TEXT NOT NULL,
    "payroll_month" DATE NOT NULL,
    "basic_salary" DECIMAL(12,2) NOT NULL,
    "attendance_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gross_amount" DECIMAL(12,2) NOT NULL,
    "net_amount" DECIMAL(12,2) NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'GENERATED',
    "paid_at" TIMESTAMP(3),
    "payment_mode" "PaymentMode",
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "payroll_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AdjustmentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "payroll_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_ratings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "rated_by_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "rating_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" "DocumentTemplateType" NOT NULL,
    "name" TEXT NOT NULL,
    "background_url" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_documents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "student_id" TEXT,
    "staff_id" TEXT,
    "exam_id" TEXT,
    "serial_number" TEXT NOT NULL,
    "barcode_value" TEXT,
    "payload" JSONB NOT NULL,
    "generated_by_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_entries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "academic_session_id" TEXT NOT NULL,
    "class_section_id" TEXT NOT NULL,
    "class_subject_id" TEXT NOT NULL,
    "teacher_id" TEXT,
    "weekday" "Weekday" NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "room" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetable_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homework" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "academic_session_id" TEXT NOT NULL,
    "class_section_id" TEXT NOT NULL,
    "class_subject_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attachment_url" TEXT,
    "homework_date" DATE NOT NULL,
    "submission_date" DATE NOT NULL,
    "status" "HomeworkStatus" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homework_submissions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "homework_id" TEXT NOT NULL,
    "student_enrollment_id" TEXT NOT NULL,
    "answer_text" TEXT,
    "attachment_url" TEXT,
    "status" "HomeworkSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "review" TEXT,
    "evaluated_by_id" TEXT,
    "evaluated_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homework_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_integration_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category" "ErpSettingCategory" NOT NULL,
    "provider" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL,
    "encrypted_secrets" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_integration_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_payment_methods" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT,
    "config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_module_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "module_key" TEXT NOT NULL,
    "admin_enabled" BOOLEAN NOT NULL DEFAULT true,
    "student_enabled" BOOLEAN NOT NULL DEFAULT true,
    "parent_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_module_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_languages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_fields" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "target" "CustomFieldTarget" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "options" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_field_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "target" "CustomFieldTarget" NOT NULL,
    "field_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_field_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shortcut_key_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "action_key" TEXT NOT NULL,
    "shortcut" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shortcut_key_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profile_rights" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "student_visible" BOOLEAN NOT NULL DEFAULT true,
    "parent_visible" BOOLEAN NOT NULL DEFAULT true,
    "student_editable" BOOLEAN NOT NULL DEFAULT false,
    "parent_editable" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profile_rights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "academic_session_id" TEXT,
    "title" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_document_folders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_document_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_documents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "folder_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration_backups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "restored_by_id" TEXT,
    "restored_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuration_backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_guardians" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "relation" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "branding" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disable_reasons" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disable_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "online_admission_applications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "academic_session_id" TEXT,
    "class_section_id" TEXT,
    "status" "OnlineAdmissionStatus" NOT NULL DEFAULT 'PENDING',
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "gender" "Gender",
    "date_of_birth" DATE,
    "mobile" TEXT,
    "email" TEXT,
    "father_name" TEXT,
    "mother_name" TEXT,
    "guardian_phone" TEXT,
    "current_address" TEXT,
    "payload" JSONB,
    "review_note" TEXT,
    "reviewed_by_id" TEXT,
    "student_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "online_admission_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachment_url" TEXT,
    "audience" "NoticeAudience" NOT NULL DEFAULT 'ALL',
    "academic_session_id" TEXT,
    "class_section_id" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purpose" "AuthVerificationPurpose" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resellers_slug_key" ON "resellers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_reseller_id_idx" ON "tenants"("reseller_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_subject_id_key" ON "users"("google_subject_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_reseller_id_idx" ON "users"("reseller_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "roles_tenant_id_idx" ON "roles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_code_key" ON "roles"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "user_roles_tenant_id_idx" ON "user_roles"("tenant_id");

-- CreateIndex
CREATE INDEX "academic_sessions_tenant_id_is_current_idx" ON "academic_sessions"("tenant_id", "is_current");

-- CreateIndex
CREATE UNIQUE INDEX "academic_sessions_tenant_id_name_key" ON "academic_sessions"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenant_id_key" ON "tenant_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "student_categories_tenant_id_idx" ON "student_categories"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_categories_tenant_id_name_key" ON "student_categories"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "student_houses_tenant_id_idx" ON "student_houses"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_houses_tenant_id_name_key" ON "student_houses"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "students_user_id_key" ON "students"("user_id");

-- CreateIndex
CREATE INDEX "students_tenant_id_status_idx" ON "students"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "students_tenant_id_first_name_last_name_idx" ON "students"("tenant_id", "first_name", "last_name");

-- CreateIndex
CREATE INDEX "students_tenant_id_sibling_group_id_idx" ON "students"("tenant_id", "sibling_group_id");

-- CreateIndex
CREATE INDEX "students_category_id_idx" ON "students"("category_id");

-- CreateIndex
CREATE INDEX "students_house_id_idx" ON "students"("house_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_tenant_id_admission_number_key" ON "students"("tenant_id", "admission_number");

-- CreateIndex
CREATE INDEX "academic_classes_tenant_id_sort_order_idx" ON "academic_classes"("tenant_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "academic_classes_tenant_id_name_key" ON "academic_classes"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "academic_classes_tenant_id_code_key" ON "academic_classes"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "sections_tenant_id_idx" ON "sections"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "sections_tenant_id_name_key" ON "sections"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "class_sections_tenant_id_academic_session_id_idx" ON "class_sections"("tenant_id", "academic_session_id");

-- CreateIndex
CREATE INDEX "class_sections_class_teacher_id_idx" ON "class_sections"("class_teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_sections_tenant_id_academic_session_id_class_id_secti_key" ON "class_sections"("tenant_id", "academic_session_id", "class_id", "section_id");

-- CreateIndex
CREATE INDEX "subjects_tenant_id_idx" ON "subjects"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_tenant_id_name_key" ON "subjects"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_tenant_id_code_key" ON "subjects"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "class_subjects_tenant_id_teacher_id_idx" ON "class_subjects"("tenant_id", "teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_subjects_tenant_id_class_section_id_subject_id_key" ON "class_subjects"("tenant_id", "class_section_id", "subject_id");

-- CreateIndex
CREATE INDEX "student_enrollments_tenant_id_academic_session_id_class_sec_idx" ON "student_enrollments"("tenant_id", "academic_session_id", "class_section_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_enrollments_tenant_id_student_id_academic_session_i_key" ON "student_enrollments"("tenant_id", "student_id", "academic_session_id", "class_section_id");

-- CreateIndex
CREATE INDEX "fee_types_tenant_id_is_active_idx" ON "fee_types"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "fee_types_tenant_id_name_key" ON "fee_types"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "fee_types_tenant_id_code_key" ON "fee_types"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "fee_groups_tenant_id_idx" ON "fee_groups"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "fee_groups_tenant_id_name_key" ON "fee_groups"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "fee_masters_tenant_id_academic_session_id_due_date_idx" ON "fee_masters"("tenant_id", "academic_session_id", "due_date");

-- CreateIndex
CREATE INDEX "fee_masters_class_section_id_idx" ON "fee_masters"("class_section_id");

-- CreateIndex
CREATE UNIQUE INDEX "fee_masters_tenant_id_academic_session_id_class_section_id__key" ON "fee_masters"("tenant_id", "academic_session_id", "class_section_id", "fee_group_id", "fee_type_id", "due_date");

-- CreateIndex
CREATE INDEX "fee_discounts_tenant_id_is_active_idx" ON "fee_discounts"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "fee_discounts_tenant_id_name_key" ON "fee_discounts"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "student_fee_assignments_tenant_id_status_idx" ON "student_fee_assignments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "student_fee_assignments_discount_id_idx" ON "student_fee_assignments"("discount_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_fee_assignments_tenant_id_student_enrollment_id_fee_key" ON "student_fee_assignments"("tenant_id", "student_enrollment_id", "fee_master_id");

-- CreateIndex
CREATE INDEX "fee_receipt_books_tenant_id_is_default_idx" ON "fee_receipt_books"("tenant_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "fee_receipt_books_tenant_id_name_key" ON "fee_receipt_books"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "fee_receipt_books_tenant_id_prefix_key" ON "fee_receipt_books"("tenant_id", "prefix");

-- CreateIndex
CREATE INDEX "fee_payments_tenant_id_payment_date_status_idx" ON "fee_payments"("tenant_id", "payment_date", "status");

-- CreateIndex
CREATE INDEX "fee_payments_tenant_id_student_id_idx" ON "fee_payments"("tenant_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "fee_payments_tenant_id_receipt_number_key" ON "fee_payments"("tenant_id", "receipt_number");

-- CreateIndex
CREATE UNIQUE INDEX "fee_payments_tenant_id_payment_id_key" ON "fee_payments"("tenant_id", "payment_id");

-- CreateIndex
CREATE INDEX "fee_payment_items_assignment_id_idx" ON "fee_payment_items"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_fee_settings_tenant_id_key" ON "tenant_fee_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "attendance_records_tenant_id_class_section_id_attendance_da_idx" ON "attendance_records"("tenant_id", "class_section_id", "attendance_date");

-- CreateIndex
CREATE INDEX "attendance_records_tenant_id_academic_session_id_status_idx" ON "attendance_records"("tenant_id", "academic_session_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_tenant_id_student_enrollment_id_attendan_key" ON "attendance_records"("tenant_id", "student_enrollment_id", "attendance_date", "period_key");

-- CreateIndex
CREATE INDEX "student_leaves_tenant_id_status_from_date_idx" ON "student_leaves"("tenant_id", "status", "from_date");

-- CreateIndex
CREATE INDEX "student_leaves_student_enrollment_id_idx" ON "student_leaves"("student_enrollment_id");

-- CreateIndex
CREATE INDEX "attendance_points_tenant_id_academic_session_id_point_date_idx" ON "attendance_points"("tenant_id", "academic_session_id", "point_date");

-- CreateIndex
CREATE INDEX "attendance_points_student_enrollment_id_idx" ON "attendance_points"("student_enrollment_id");

-- CreateIndex
CREATE INDEX "exam_grades_tenant_id_result_type_min_percent_max_percent_idx" ON "exam_grades"("tenant_id", "result_type", "min_percent", "max_percent");

-- CreateIndex
CREATE UNIQUE INDEX "exam_grades_tenant_id_result_type_name_key" ON "exam_grades"("tenant_id", "result_type", "name");

-- CreateIndex
CREATE INDEX "exam_groups_tenant_id_academic_session_id_idx" ON "exam_groups"("tenant_id", "academic_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_groups_tenant_id_academic_session_id_name_key" ON "exam_groups"("tenant_id", "academic_session_id", "name");

-- CreateIndex
CREATE INDEX "exams_tenant_id_status_start_date_idx" ON "exams"("tenant_id", "status", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "exams_tenant_id_exam_group_id_name_key" ON "exams"("tenant_id", "exam_group_id", "name");

-- CreateIndex
CREATE INDEX "exam_schedules_tenant_id_exam_date_idx" ON "exam_schedules"("tenant_id", "exam_date");

-- CreateIndex
CREATE UNIQUE INDEX "exam_schedules_tenant_id_exam_id_class_section_id_class_sub_key" ON "exam_schedules"("tenant_id", "exam_id", "class_section_id", "class_subject_id");

-- CreateIndex
CREATE INDEX "exam_students_tenant_id_exam_id_idx" ON "exam_students"("tenant_id", "exam_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_students_tenant_id_exam_id_student_enrollment_id_key" ON "exam_students"("tenant_id", "exam_id", "student_enrollment_id");

-- CreateIndex
CREATE INDEX "exam_marks_tenant_id_exam_student_id_idx" ON "exam_marks"("tenant_id", "exam_student_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_marks_tenant_id_schedule_id_exam_student_id_key" ON "exam_marks"("tenant_id", "schedule_id", "exam_student_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_mark_components_tenant_id_schedule_id_name_key" ON "exam_mark_components"("tenant_id", "schedule_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "exam_mark_component_scores_tenant_id_exam_mark_id_component_key" ON "exam_mark_component_scores"("tenant_id", "exam_mark_id", "component_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_aspect_fields_tenant_id_exam_id_name_key" ON "exam_aspect_fields"("tenant_id", "exam_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "exam_aspect_values_tenant_id_aspect_field_id_exam_student_i_key" ON "exam_aspect_values"("tenant_id", "aspect_field_id", "exam_student_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_tenant_id_name_key" ON "departments"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "designations_tenant_id_name_key" ON "designations"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "staff_leave_types_tenant_id_name_key" ON "staff_leave_types"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_user_id_key" ON "staff_profiles"("user_id");

-- CreateIndex
CREATE INDEX "staff_profiles_tenant_id_status_idx" ON "staff_profiles"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_tenant_id_employee_number_key" ON "staff_profiles"("tenant_id", "employee_number");

-- CreateIndex
CREATE INDEX "staff_attendance_tenant_id_attendance_date_status_idx" ON "staff_attendance"("tenant_id", "attendance_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "staff_attendance_tenant_id_staff_id_attendance_date_key" ON "staff_attendance"("tenant_id", "staff_id", "attendance_date");

-- CreateIndex
CREATE INDEX "staff_leaves_tenant_id_status_from_date_idx" ON "staff_leaves"("tenant_id", "status", "from_date");

-- CreateIndex
CREATE INDEX "staff_adjustments_tenant_id_staff_id_is_active_idx" ON "staff_adjustments"("tenant_id", "staff_id", "is_active");

-- CreateIndex
CREATE INDEX "payrolls_tenant_id_payroll_month_status_idx" ON "payrolls"("tenant_id", "payroll_month", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payrolls_tenant_id_staff_id_payroll_month_key" ON "payrolls"("tenant_id", "staff_id", "payroll_month");

-- CreateIndex
CREATE INDEX "payroll_items_tenant_id_payroll_id_idx" ON "payroll_items"("tenant_id", "payroll_id");

-- CreateIndex
CREATE INDEX "teacher_ratings_tenant_id_staff_id_rating_date_idx" ON "teacher_ratings"("tenant_id", "staff_id", "rating_date");

-- CreateIndex
CREATE INDEX "document_templates_tenant_id_type_is_active_idx" ON "document_templates"("tenant_id", "type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_tenant_id_type_name_key" ON "document_templates"("tenant_id", "type", "name");

-- CreateIndex
CREATE INDEX "generated_documents_tenant_id_template_id_generated_at_idx" ON "generated_documents"("tenant_id", "template_id", "generated_at");

-- CreateIndex
CREATE INDEX "generated_documents_student_id_idx" ON "generated_documents"("student_id");

-- CreateIndex
CREATE INDEX "generated_documents_staff_id_idx" ON "generated_documents"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "generated_documents_tenant_id_serial_number_key" ON "generated_documents"("tenant_id", "serial_number");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_type_entity_id_idx" ON "audit_logs"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "timetable_entries_tenant_id_academic_session_id_weekday_idx" ON "timetable_entries"("tenant_id", "academic_session_id", "weekday");

-- CreateIndex
CREATE INDEX "timetable_entries_tenant_id_teacher_id_weekday_idx" ON "timetable_entries"("tenant_id", "teacher_id", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_entries_tenant_id_class_section_id_weekday_start__key" ON "timetable_entries"("tenant_id", "class_section_id", "weekday", "start_time");

-- CreateIndex
CREATE INDEX "homework_tenant_id_academic_session_id_class_section_id_sub_idx" ON "homework"("tenant_id", "academic_session_id", "class_section_id", "submission_date");

-- CreateIndex
CREATE INDEX "homework_tenant_id_teacher_id_status_idx" ON "homework"("tenant_id", "teacher_id", "status");

-- CreateIndex
CREATE INDEX "homework_submissions_tenant_id_status_submitted_at_idx" ON "homework_submissions"("tenant_id", "status", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "homework_submissions_tenant_id_homework_id_student_enrollme_key" ON "homework_submissions"("tenant_id", "homework_id", "student_enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "erp_integration_settings_tenant_id_category_key" ON "erp_integration_settings"("tenant_id", "category");

-- CreateIndex
CREATE INDEX "tenant_payment_methods_tenant_id_is_active_sort_order_idx" ON "tenant_payment_methods"("tenant_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_payment_methods_tenant_id_code_key" ON "tenant_payment_methods"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_module_settings_tenant_id_module_key_key" ON "tenant_module_settings"("tenant_id", "module_key");

-- CreateIndex
CREATE INDEX "tenant_languages_tenant_id_is_enabled_idx" ON "tenant_languages"("tenant_id", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_languages_tenant_id_code_key" ON "tenant_languages"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "custom_fields_tenant_id_target_is_active_idx" ON "custom_fields"("tenant_id", "target", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "custom_fields_tenant_id_target_key_key" ON "custom_fields"("tenant_id", "target", "key");

-- CreateIndex
CREATE UNIQUE INDEX "system_field_settings_tenant_id_target_field_key_key" ON "system_field_settings"("tenant_id", "target", "field_key");

-- CreateIndex
CREATE UNIQUE INDEX "shortcut_key_settings_tenant_id_action_key_key" ON "shortcut_key_settings"("tenant_id", "action_key");

-- CreateIndex
CREATE UNIQUE INDEX "shortcut_key_settings_tenant_id_shortcut_key" ON "shortcut_key_settings"("tenant_id", "shortcut");

-- CreateIndex
CREATE UNIQUE INDEX "student_profile_rights_tenant_id_field_key_key" ON "student_profile_rights"("tenant_id", "field_key");

-- CreateIndex
CREATE INDEX "holidays_tenant_id_start_date_end_date_idx" ON "holidays"("tenant_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "student_document_folders_tenant_id_parent_id_idx" ON "student_document_folders"("tenant_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_document_folders_tenant_id_parent_id_name_key" ON "student_document_folders"("tenant_id", "parent_id", "name");

-- CreateIndex
CREATE INDEX "student_documents_tenant_id_student_id_folder_id_idx" ON "student_documents"("tenant_id", "student_id", "folder_id");

-- CreateIndex
CREATE INDEX "configuration_backups_tenant_id_created_at_idx" ON "configuration_backups"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "student_guardians_tenant_id_user_id_idx" ON "student_guardians"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_guardians_tenant_id_student_id_user_id_key" ON "student_guardians"("tenant_id", "student_id", "user_id");

-- CreateIndex
CREATE INDEX "disable_reasons_tenant_id_idx" ON "disable_reasons"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "disable_reasons_tenant_id_name_key" ON "disable_reasons"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "online_admission_applications_tenant_id_status_idx" ON "online_admission_applications"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "online_admission_applications_tenant_id_created_at_idx" ON "online_admission_applications"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "notices_tenant_id_published_at_idx" ON "notices"("tenant_id", "published_at");

-- CreateIndex
CREATE INDEX "notices_tenant_id_audience_idx" ON "notices"("tenant_id", "audience");

-- CreateIndex
CREATE INDEX "auth_verifications_user_id_purpose_idx" ON "auth_verifications"("user_id", "purpose");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_reseller_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_reseller_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_sessions" ADD CONSTRAINT "academic_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_categories" ADD CONSTRAINT "student_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_houses" ADD CONSTRAINT "student_houses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "student_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "student_houses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_classes" ADD CONSTRAINT "academic_classes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sections" ADD CONSTRAINT "class_sections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sections" ADD CONSTRAINT "class_sections_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sections" ADD CONSTRAINT "class_sections_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "academic_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sections" ADD CONSTRAINT "class_sections_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sections" ADD CONSTRAINT "class_sections_class_teacher_id_fkey" FOREIGN KEY ("class_teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_types" ADD CONSTRAINT "fee_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_groups" ADD CONSTRAINT "fee_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_group_items" ADD CONSTRAINT "fee_group_items_fee_group_id_fkey" FOREIGN KEY ("fee_group_id") REFERENCES "fee_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_group_items" ADD CONSTRAINT "fee_group_items_fee_type_id_fkey" FOREIGN KEY ("fee_type_id") REFERENCES "fee_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_masters" ADD CONSTRAINT "fee_masters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_masters" ADD CONSTRAINT "fee_masters_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_masters" ADD CONSTRAINT "fee_masters_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_masters" ADD CONSTRAINT "fee_masters_fee_group_id_fkey" FOREIGN KEY ("fee_group_id") REFERENCES "fee_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_masters" ADD CONSTRAINT "fee_masters_fee_type_id_fkey" FOREIGN KEY ("fee_type_id") REFERENCES "fee_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_discounts" ADD CONSTRAINT "fee_discounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_student_enrollment_id_fkey" FOREIGN KEY ("student_enrollment_id") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_fee_master_id_fkey" FOREIGN KEY ("fee_master_id") REFERENCES "fee_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "fee_discounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_receipt_books" ADD CONSTRAINT "fee_receipt_books_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_receipt_book_id_fkey" FOREIGN KEY ("receipt_book_id") REFERENCES "fee_receipt_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payment_items" ADD CONSTRAINT "fee_payment_items_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "fee_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payment_items" ADD CONSTRAINT "fee_payment_items_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "student_fee_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_fee_settings" ADD CONSTRAINT "tenant_fee_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_enrollment_id_fkey" FOREIGN KEY ("student_enrollment_id") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_id_fkey" FOREIGN KEY ("marked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leaves" ADD CONSTRAINT "student_leaves_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leaves" ADD CONSTRAINT "student_leaves_student_enrollment_id_fkey" FOREIGN KEY ("student_enrollment_id") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leaves" ADD CONSTRAINT "student_leaves_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leaves" ADD CONSTRAINT "student_leaves_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_points" ADD CONSTRAINT "attendance_points_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_points" ADD CONSTRAINT "attendance_points_student_enrollment_id_fkey" FOREIGN KEY ("student_enrollment_id") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_points" ADD CONSTRAINT "attendance_points_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_points" ADD CONSTRAINT "attendance_points_awarded_by_id_fkey" FOREIGN KEY ("awarded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_grades" ADD CONSTRAINT "exam_grades_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_groups" ADD CONSTRAINT "exam_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_groups" ADD CONSTRAINT "exam_groups_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_exam_group_id_fkey" FOREIGN KEY ("exam_group_id") REFERENCES "exam_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_class_subject_id_fkey" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_students" ADD CONSTRAINT "exam_students_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_students" ADD CONSTRAINT "exam_students_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_students" ADD CONSTRAINT "exam_students_student_enrollment_id_fkey" FOREIGN KEY ("student_enrollment_id") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "exam_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_exam_student_id_fkey" FOREIGN KEY ("exam_student_id") REFERENCES "exam_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_mark_components" ADD CONSTRAINT "exam_mark_components_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_mark_components" ADD CONSTRAINT "exam_mark_components_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "exam_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_mark_component_scores" ADD CONSTRAINT "exam_mark_component_scores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_mark_component_scores" ADD CONSTRAINT "exam_mark_component_scores_exam_mark_id_fkey" FOREIGN KEY ("exam_mark_id") REFERENCES "exam_marks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_mark_component_scores" ADD CONSTRAINT "exam_mark_component_scores_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "exam_mark_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_aspect_fields" ADD CONSTRAINT "exam_aspect_fields_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_aspect_fields" ADD CONSTRAINT "exam_aspect_fields_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_aspect_values" ADD CONSTRAINT "exam_aspect_values_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_aspect_values" ADD CONSTRAINT "exam_aspect_values_aspect_field_id_fkey" FOREIGN KEY ("aspect_field_id") REFERENCES "exam_aspect_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_aspect_values" ADD CONSTRAINT "exam_aspect_values_exam_student_id_fkey" FOREIGN KEY ("exam_student_id") REFERENCES "exam_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designations" ADD CONSTRAINT "designations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leave_types" ADD CONSTRAINT "staff_leave_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_marked_by_id_fkey" FOREIGN KEY ("marked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leaves" ADD CONSTRAINT "staff_leaves_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leaves" ADD CONSTRAINT "staff_leaves_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leaves" ADD CONSTRAINT "staff_leaves_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "staff_leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leaves" ADD CONSTRAINT "staff_leaves_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_adjustments" ADD CONSTRAINT "staff_adjustments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_adjustments" ADD CONSTRAINT "staff_adjustments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_payroll_id_fkey" FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_ratings" ADD CONSTRAINT "teacher_ratings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_ratings" ADD CONSTRAINT "teacher_ratings_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_ratings" ADD CONSTRAINT "teacher_ratings_rated_by_id_fkey" FOREIGN KEY ("rated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_class_subject_id_fkey" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework" ADD CONSTRAINT "homework_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework" ADD CONSTRAINT "homework_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework" ADD CONSTRAINT "homework_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework" ADD CONSTRAINT "homework_class_subject_id_fkey" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework" ADD CONSTRAINT "homework_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_homework_id_fkey" FOREIGN KEY ("homework_id") REFERENCES "homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_student_enrollment_id_fkey" FOREIGN KEY ("student_enrollment_id") REFERENCES "student_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_evaluated_by_id_fkey" FOREIGN KEY ("evaluated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_integration_settings" ADD CONSTRAINT "erp_integration_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_payment_methods" ADD CONSTRAINT "tenant_payment_methods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_module_settings" ADD CONSTRAINT "tenant_module_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_languages" ADD CONSTRAINT "tenant_languages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_fields" ADD CONSTRAINT "custom_fields_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_field_settings" ADD CONSTRAINT "system_field_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shortcut_key_settings" ADD CONSTRAINT "shortcut_key_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profile_rights" ADD CONSTRAINT "student_profile_rights_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_document_folders" ADD CONSTRAINT "student_document_folders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_document_folders" ADD CONSTRAINT "student_document_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "student_document_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "student_document_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_backups" ADD CONSTRAINT "configuration_backups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_backups" ADD CONSTRAINT "configuration_backups_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_backups" ADD CONSTRAINT "configuration_backups_restored_by_id_fkey" FOREIGN KEY ("restored_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disable_reasons" ADD CONSTRAINT "disable_reasons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_admission_applications" ADD CONSTRAINT "online_admission_applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_admission_applications" ADD CONSTRAINT "online_admission_applications_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_admission_applications" ADD CONSTRAINT "online_admission_applications_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_admission_applications" ADD CONSTRAINT "online_admission_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_admission_applications" ADD CONSTRAINT "online_admission_applications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_verifications" ADD CONSTRAINT "auth_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
