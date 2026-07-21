import {
  AdjustmentType,
  PaymentMode,
  StaffAttendanceStatus,
  StaffLeaveStatus,
  StaffStatus,
} from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  addStaffAdjustment,
  addTeacherRating,
  applyStaffLeave,
  createDepartment,
  createDesignation,
  createStaffLeaveType,
  createStaffProfile,
  generatePayroll,
  getHrSetup,
  getStaffAttendanceReport,
  markStaffAttendance,
  payPayroll,
  reviewStaffLeave,
  updateStaffStatus,
} from "./hr.service.js";

const idParams = z.object({ id: z.string().min(1) });
const nameBody = z.object({ name: z.string().trim().min(1).max(100) });
const leaveTypeBody = nameBody.extend({
  annualLimit: z.coerce.number().int().positive().max(366).nullable().optional(),
});
const setupQuery = z.object({ month: z.coerce.date().optional() });
const staffBody = z.object({
  userId: z.string().min(1),
  employeeNumber: z.string().trim().min(1).max(50).optional(),
  departmentId: z.string().min(1).nullable().optional(),
  designationId: z.string().min(1).nullable().optional(),
  joiningDate: z.coerce.date(),
  dateOfBirth: z.coerce.date().nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(1000).nullable().optional(),
  basicSalary: z.coerce.number().min(0),
});
const statusBody = z.object({
  status: z.nativeEnum(StaffStatus),
  disabledReason: z.string().trim().max(1000).nullable().optional(),
});
const attendanceBody = z.object({
  attendanceDate: z.coerce.date(),
  records: z.array(z.object({
    staffId: z.string().min(1),
    status: z.nativeEnum(StaffAttendanceStatus),
    inTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    outTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })).min(1),
});
const attendanceQuery = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  staffId: z.string().min(1).optional(),
});
const leaveBody = z.object({
  staffId: z.string().min(1),
  leaveTypeId: z.string().min(1),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  reason: z.string().trim().min(3).max(2000),
});
const reviewBody = z.object({
  status: z.nativeEnum(StaffLeaveStatus),
  reviewNote: z.string().trim().max(1000).nullable().optional(),
});
const adjustmentBody = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.nativeEnum(AdjustmentType),
  amount: z.coerce.number().positive(),
  isRecurring: z.boolean().optional(),
});
const payrollBody = z.object({
  academicSessionId: z.string().min(1),
  payrollMonth: z.coerce.date(),
  staffIds: z.array(z.string().min(1)).optional(),
});
const payBody = z.object({
  paymentMode: z.nativeEnum(PaymentMode),
  note: z.string().trim().max(1000).nullable().optional(),
});
const ratingBody = z.object({
  staffId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).nullable().optional(),
  ratingDate: z.coerce.date(),
});

export async function getHrSetupController(req: Request, res: Response) {
  const { month } = setupQuery.parse(req.query);
  res.json({ data: await getHrSetup(req.auth!.tenantId!, month) });
}

export async function createDepartmentController(req: Request, res: Response) {
  const { name } = nameBody.parse(req.body);
  res.status(201).json({ data: await createDepartment(req.auth!.tenantId!, name) });
}

export async function createDesignationController(req: Request, res: Response) {
  const { name } = nameBody.parse(req.body);
  res.status(201).json({ data: await createDesignation(req.auth!.tenantId!, name) });
}

export async function createStaffLeaveTypeController(req: Request, res: Response) {
  res.status(201).json({
    data: await createStaffLeaveType(req.auth!.tenantId!, leaveTypeBody.parse(req.body)),
  });
}

export async function createStaffProfileController(req: Request, res: Response) {
  res.status(201).json({
    data: await createStaffProfile(req.auth!.tenantId!, staffBody.parse(req.body)),
  });
}

export async function updateStaffStatusController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateStaffStatus(req.auth!.tenantId!, id, statusBody.parse(req.body)),
  });
}

export async function markStaffAttendanceController(req: Request, res: Response) {
  res.json({
    data: await markStaffAttendance(
      req.auth!.tenantId!,
      req.auth!.userId,
      attendanceBody.parse(req.body),
    ),
  });
}

export async function getStaffAttendanceReportController(req: Request, res: Response) {
  res.json({
    data: await getStaffAttendanceReport(
      req.auth!.tenantId!,
      attendanceQuery.parse(req.query),
    ),
  });
}

export async function applyStaffLeaveController(req: Request, res: Response) {
  res.status(201).json({
    data: await applyStaffLeave(req.auth!.tenantId!, leaveBody.parse(req.body)),
  });
}

export async function reviewStaffLeaveController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await reviewStaffLeave(
      req.auth!.tenantId!,
      req.auth!.userId,
      id,
      reviewBody.parse(req.body),
    ),
  });
}

export async function addStaffAdjustmentController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.status(201).json({
    data: await addStaffAdjustment(
      req.auth!.tenantId!,
      id,
      adjustmentBody.parse(req.body),
    ),
  });
}

export async function generatePayrollController(req: Request, res: Response) {
  res.status(201).json({
    data: await generatePayroll(req.auth!.tenantId!, payrollBody.parse(req.body)),
  });
}

export async function payPayrollController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await payPayroll(req.auth!.tenantId!, id, payBody.parse(req.body)),
  });
}

export async function addTeacherRatingController(req: Request, res: Response) {
  res.status(201).json({
    data: await addTeacherRating(
      req.auth!.tenantId!,
      req.auth!.userId,
      ratingBody.parse(req.body),
    ),
  });
}
