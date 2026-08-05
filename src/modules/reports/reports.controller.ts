import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import {
  getReportHub,
  runCoreReport,
  runModuleReport,
  type CoreReportKey,
  type ReportModule,
} from "./reports.service.js";
import {
  runFeeReport,
  type FeeReportKey,
} from "./fee-reports.service.js";
import {
  runStudentReport,
  type StudentReportKey,
} from "./student-reports.service.js";
import {
  runExtendedReport,
  type ExtendedReportKey,
  type ExtendedReportSection,
} from "./extended-reports.service.js";

const moduleParams = z.object({
  module: z.enum([
    "students",
    "finance",
    "attendance",
    "examinations",
    "timetable",
    "homework",
    "hr",
    "audit",
  ]),
});

const coreParams = z.object({
  reportKey: z.enum([
    "active_students",
    "due_fees",
    "fee_collection",
    "daily_attendance",
    "attendance_summary",
    "exam_rank",
  ]),
});

const studentReportParams = z.object({
  reportKey: z.enum([
    "new_admissions",
    "old_admissions",
    "active_students",
    "disabled_students",
    "alumni_students",
    "student_history",
    "student_login_status",
    "student_profile",
    "student_gender",
    "student_birthday",
    "student_siblings",
    "student_guardian",
    "student_teacher",
    "student_headcounts",
    "class_subject",
    "online_admissions",
    "at_school_admissions",
  ]),
});

const feeReportParams = z.object({
  reportKey: z.enum([
    "due_fees",
    "fee_collection",
    "fee_master",
    "fee_assigned",
    "fee_summary",
    "day_book",
    "till_date_due",
    "balance_fee",
    "parents_wise_due",
    "students_wise_fee",
    "fee_statement",
    "previous_session_fees",
    "fine_report",
    "discount_report",
    "online_fee",
    "daily_fees_collection",
  ]),
});

const reportQuery = z.object({
  sessionId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  examId: z.string().min(1).optional(),
  classSectionId: z.string().min(1).optional(),
  includeDisabled: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

const extraReportParams = z.object({
  reportKey: z.enum([
    "staff",
    "payroll",
    "staff_birthday",
    "user_log",
    "audit_trail",
    "transport",
    "hostel",
    "alumni",
    "exam_rank_session",
    "exam_cumulative",
    "book_issue",
    "book_due",
    "book_inventory",
    "book_return",
    "stock",
    "add_item",
    "issue_item",
    "online_exam_wise",
    "online_exams",
    "online_attempt",
    "online_rank",
    "subjective_marks",
    "syllabus_status",
    "subject_lesson_plan",
  ]),
});

const extraReportQuery = reportQuery.extend({
  section: z
    .enum(["hr", "ops", "exams", "library", "inventory", "onlineExam", "lessonPlan", "alumni"])
    .optional(),
  examGroupId: z.string().min(1).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export async function getReportHubController(req: Request, res: Response) {
  res.json({
    data: await getReportHub(req.auth!.tenantId!, req.auth!.productMode),
  });
}

export async function runCoreReportController(req: Request, res: Response) {
  const { reportKey } = coreParams.parse(req.params);
  const mode = req.auth!.productMode;
  if (mode === "LMS" && ["due_fees", "fee_collection"].includes(reportKey)) {
    throw new AppError(
      403,
      "This report requires CMS entitlement",
      "ENTITLEMENT_REQUIRED",
    );
  }
  res.json({
    data: await runCoreReport(
      req.auth!.tenantId!,
      reportKey as CoreReportKey,
      reportQuery.parse(req.query),
    ),
  });
}

export async function runStudentReportController(req: Request, res: Response) {
  if (req.auth!.productMode === "LMS") {
    throw new AppError(
      403,
      "This report requires CMS entitlement",
      "ENTITLEMENT_REQUIRED",
    );
  }
  const { reportKey } = studentReportParams.parse(req.params);
  res.json({
    data: await runStudentReport(
      req.auth!.tenantId!,
      reportKey as StudentReportKey,
      reportQuery.parse(req.query),
    ),
  });
}

export async function runFeeReportController(req: Request, res: Response) {
  if (req.auth!.productMode === "LMS") {
    throw new AppError(
      403,
      "This report requires CMS entitlement",
      "ENTITLEMENT_REQUIRED",
    );
  }
  const { reportKey } = feeReportParams.parse(req.params);
  res.json({
    data: await runFeeReport(
      req.auth!.tenantId!,
      reportKey as FeeReportKey,
      reportQuery.parse(req.query),
    ),
  });
}

export async function runModuleReportController(req: Request, res: Response) {
  const { module } = moduleParams.parse(req.params);
  const mode = req.auth!.productMode;
  if (mode === "LMS" && ["finance", "hr"].includes(module)) {
    throw new AppError(
      403,
      "This report requires CMS entitlement",
      "ENTITLEMENT_REQUIRED",
    );
  }
  if (mode === "CMS" && ["timetable"].includes(module)) {
    throw new AppError(
      403,
      "This report requires LMS entitlement",
      "ENTITLEMENT_REQUIRED",
    );
  }
  res.json({
    data: await runModuleReport(
      req.auth!.tenantId!,
      module as ReportModule,
      reportQuery.parse(req.query),
    ),
  });
}

export async function runExtraReportController(req: Request, res: Response) {
  const { reportKey } = extraReportParams.parse(req.params);
  const query = extraReportQuery.parse(req.query);
  const cmsOnlyKeys = new Set([
    "staff",
    "payroll",
    "staff_birthday",
    "transport",
    "hostel",
  ]);
  if (req.auth!.productMode === "LMS" && cmsOnlyKeys.has(reportKey)) {
    throw new AppError(
      403,
      "This report requires CMS entitlement",
      "ENTITLEMENT_REQUIRED",
    );
  }
  res.json({
    data: await runExtendedReport(
      req.auth!.tenantId!,
      reportKey as ExtendedReportKey,
      {
        section: query.section as ExtendedReportSection | undefined,
        sessionId: query.sessionId,
        from: query.from,
        to: query.to,
        classSectionId: query.classSectionId,
        examGroupId: query.examGroupId,
        month: query.month,
      },
    ),
  });
}
