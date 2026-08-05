import {
  AttendanceStatus,
  LeaveStatus,
} from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  getAttendanceReportCatalog,
  runAttendancePackReport,
  scanAttendance,
  type AttendancePackReportKey,
} from "./attendance-extensions.service.js";
import {
  awardAttendancePoints,
  createLeave,
  getAttendancePoints,
  getAttendancePointScores,
  getAttendanceReport,
  getAttendanceSetup,
  listLeaves,
  markAttendance,
  reviewLeave,
  updateAttendancePointConfig,
} from "./attendance.service.js";

const idParams = z.object({ id: z.string().min(1) });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional();
const setupQuery = z.object({
  classSectionId: z.string().min(1).optional(),
  date: z.coerce.date().default(() => new Date()),
  periodKey: z.string().trim().min(1).max(50).optional(),
});
const markBody = z.object({
  classSectionId: z.string().min(1),
  attendanceDate: z.coerce.date(),
  periodKey: z.string().trim().min(1).max(50).optional(),
  records: z.array(z.object({
    studentEnrollmentId: z.string().min(1),
    status: z.nativeEnum(AttendanceStatus),
    inTime: time,
    outTime: time,
    note: z.string().trim().max(500).nullable().optional(),
  })).min(1),
});
const reportQuery = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  classSectionId: z.string().min(1).optional(),
  studentId: z.string().min(1).optional(),
  periodKey: z.string().trim().min(1).max(50).optional(),
});
const leaveBody = z.object({
  studentEnrollmentId: z.string().min(1),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  reason: z.string().trim().min(3).max(1000),
  status: z.nativeEnum(LeaveStatus).optional(),
  attachmentUrl: z
    .string()
    .trim()
    .min(1)
    .max(30_000_000)
    .refine(
      (value) =>
        value.startsWith("http://") ||
        value.startsWith("https://") ||
        value.startsWith("data:") ||
        value.startsWith("/"),
      "Attachment must be a URL, data URL, or uploaded path",
    )
    .nullable()
    .optional(),
});
const leaveQuery = z.object({ status: z.nativeEnum(LeaveStatus).optional() });
const reviewBody = z.object({
  status: z.enum([LeaveStatus.APPROVED, LeaveStatus.REJECTED]),
  reviewNote: z.string().trim().max(1000).nullable().optional(),
});
const pointBody = z.object({
  studentEnrollmentId: z.string().min(1),
  pointDate: z.coerce.date(),
  points: z.coerce.number().int().min(-100).max(100),
  note: z.string().trim().max(500).nullable().optional(),
});
const pointQuery = z.object({ sessionId: z.string().min(1) });
const scanBody = z.object({
  code: z.string().trim().min(1).max(200),
  mode: z.enum(["IN", "OUT"]),
  deviceType: z.enum(["BARCODE", "RFID", "BIOMETRIC"]).optional(),
  classSectionId: z.string().min(1).optional(),
  attendanceDate: z.coerce.date().optional(),
  periodKey: z.string().trim().min(1).max(50).optional(),
  scanTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
});
const packReportQuery = z.object({
  reportKey: z.enum([
    "daily_attendance",
    "custom_attendance",
    "remaining_class",
    "student_summary",
    "staff_summary",
    "inout_time",
    "period_wise",
    "class_wise",
    "frequently_absent",
    "attendance_type",
  ]),
  date: z.coerce.date().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  classSectionId: z.string().min(1).optional(),
  periodKey: z.string().trim().min(1).max(50).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  threshold: z.coerce.number().min(0).max(100).optional(),
});

export async function getAttendanceSetupController(req: Request, res: Response) {
  res.json({
    data: await getAttendanceSetup(req.auth!.tenantId!, setupQuery.parse(req.query)),
  });
}

export async function markAttendanceController(req: Request, res: Response) {
  res.json({
    data: await markAttendance(
      req.auth!.tenantId!,
      req.auth!.userId,
      markBody.parse(req.body),
    ),
  });
}

export async function getAttendanceReportController(req: Request, res: Response) {
  res.json({
    data: await getAttendanceReport(req.auth!.tenantId!, reportQuery.parse(req.query)),
  });
}

export async function createLeaveController(req: Request, res: Response) {
  res.status(201).json({
    data: await createLeave(
      req.auth!.tenantId!,
      req.auth!.userId,
      leaveBody.parse(req.body),
    ),
  });
}

export async function listLeavesController(req: Request, res: Response) {
  const { status } = leaveQuery.parse(req.query);
  res.json({ data: await listLeaves(req.auth!.tenantId!, status) });
}

export async function reviewLeaveController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await reviewLeave(
      req.auth!.tenantId!,
      req.auth!.userId,
      id,
      reviewBody.parse(req.body),
    ),
  });
}

export async function awardAttendancePointsController(req: Request, res: Response) {
  res.status(201).json({
    data: await awardAttendancePoints(
      req.auth!.tenantId!,
      req.auth!.userId,
      pointBody.parse(req.body),
    ),
  });
}

export async function getAttendancePointsController(req: Request, res: Response) {
  const { sessionId } = pointQuery.parse(req.query);
  res.json({
    data: await getAttendancePoints(req.auth!.tenantId!, sessionId),
  });
}

export async function getAttendancePointScoresController(req: Request, res: Response) {
  const query = z.object({
    sessionId: z.string().min(1).optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  }).parse(req.query);
  res.json({
    data: await getAttendancePointScores(
      req.auth!.tenantId!,
      query.sessionId,
      query.month,
    ),
  });
}

const pointConfigBody = z.object({
  presentPoints: z.coerce.number().int().min(-100).max(100),
  halfDayPoints: z.coerce.number().int().min(-100).max(100),
  latePoints: z.coerce.number().int().min(-100).max(100),
});

export async function updateAttendancePointConfigController(req: Request, res: Response) {
  res.json({
    data: await updateAttendancePointConfig(
      req.auth!.tenantId!,
      pointConfigBody.parse(req.body),
    ),
  });
}

export async function scanAttendanceController(req: Request, res: Response) {
  res.json({
    data: await scanAttendance(
      req.auth!.tenantId!,
      req.auth!.userId,
      scanBody.parse(req.body),
    ),
  });
}

export async function getAttendanceReportCatalogController(_req: Request, res: Response) {
  res.json({ data: getAttendanceReportCatalog() });
}

export async function runAttendancePackReportController(req: Request, res: Response) {
  const query = packReportQuery.parse(req.query);
  res.json({
    data: await runAttendancePackReport(req.auth!.tenantId!, {
      ...query,
      reportKey: query.reportKey as AttendancePackReportKey,
    }),
  });
}
