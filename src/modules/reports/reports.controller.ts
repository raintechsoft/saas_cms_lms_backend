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
  if (mode === "CMS" && ["timetable", "homework"].includes(module)) {
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
