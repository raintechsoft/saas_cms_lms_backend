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
  applyOwnStaffLeave,
  applyStaffLeave,
  createDepartment,
  createDesignation,
  createPayParameter,
  createStaffLeaveType,
  createStaffProfile,
  deleteDepartment,
  deleteDesignation,
  deletePayParameter,
  deleteStaffAdjustment,
  deleteStaffLeaveType,
  deleteStaffProfile,
  generatePayroll,
  getHrSetup,
  getPayrollPayslip,
  getStaffAttendanceReport,
  getStaffDetail,
  getStaffLeave,
  getTeacherRatingsSummary,
  listDisabledStaff,
  markStaffAttendance,
  payPayroll,
  revertPayroll,
  reviewStaffLeave,
  updateDepartment,
  updateDesignation,
  updatePayParameter,
  updateStaffAdjustment,
  updateStaffLeaveType,
  updateStaffProfile,
  updateStaffStatus,
} from "./hr.service.js";

const idParams = z.object({ id: z.string().min(1) });
const nameBody = z.object({ name: z.string().trim().min(1).max(100) });
const leaveTypeBody = nameBody.extend({
  annualLimit: z.coerce.number().int().min(0).max(366).nullable().optional(),
  code: z.string().trim().max(20).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  isPaid: z.boolean().optional(),
  applicableTo: z.string().trim().min(1).max(40).optional(),
  isActive: z.boolean().optional(),
  carryForward: z.boolean().optional(),
  encashmentAllowed: z.boolean().optional(),
  genderApplicability: z.string().trim().min(1).max(40).optional(),
  allocationMethod: z.string().trim().min(1).max(40).optional(),
  allocationFrequency: z.string().trim().min(1).max(40).optional(),
  defaultAllocationDays: z.coerce.number().int().min(0).max(366).optional(),
  accrualRate: z.coerce.number().min(0).max(100).optional(),
  accrualBased: z.boolean().optional(),
  effectiveFrom: z.coerce.date().nullable().optional(),
  restriction: z.string().trim().min(1).max(60).optional(),
  requireApproval: z.boolean().optional(),
  applyOnWeekends: z.boolean().optional(),
  applyOnHolidays: z.boolean().optional(),
  allowHalfDay: z.boolean().optional(),
  minimumNoticeDays: z.coerce.number().int().min(0).max(365).optional(),
  documentRequired: z.string().trim().min(1).max(40).optional(),
});
const payParameterBody = z.object({
  name: z.string().trim().min(1).max(100),
  shortCode: z.string().trim().max(20).nullable().optional(),
  type: z.nativeEnum(AdjustmentType),
  taxable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  defaultAmount: z.coerce.number().min(0),
});
const payParameterUpdateBody = payParameterBody.partial();
const setupQuery = z.object({ month: z.coerce.date().optional() });
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value));
const staffDetailsShape = {
  employeeNumber: z.string().trim().min(1).max(50).optional(),
  departmentId: z.string().min(1).nullable().optional(),
  designationId: z.string().min(1).nullable().optional(),
  joiningDate: z.coerce.date(),
  dateOfBirth: z.coerce.date().nullable().optional(),
  phone: optionalText(30),
  address: optionalText(1000),
  basicSalary: z.coerce.number().min(0),
  gender: optionalText(20),
  maritalStatus: optionalText(30),
  emergencyContact: optionalText(30),
  epfNumber: optionalText(50),
  contractType: optionalText(30),
  workShift: optionalText(30),
  workLocation: optionalText(100),
  leaveAllowance: z.coerce.number().int().min(0).max(366).nullable().optional(),
  absenceDeduction: z.coerce.number().min(0).nullable().optional(),
  leavingDate: z.coerce.date().nullable().optional(),
  resignationLetter: optionalText(5000),
  bankAccountTitle: optionalText(100),
  bankAccountNumber: optionalText(50),
  bankName: optionalText(100),
  bankIfsc: optionalText(20),
  bankBranch: optionalText(100),
  permanentAddress: optionalText(1000),
  photoUrl: z
    .string()
    .max(3_000_000)
    .nullable()
    .optional()
    .refine(
      (value) =>
        value == null ||
        value === "" ||
        /^https?:\/\//i.test(value) ||
        value.startsWith("data:image/"),
      { message: "Photo must be an image URL or uploaded image" },
    )
    .transform((value) => (value === "" ? null : value)),
  documents: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(50),
        name: z.string().trim().min(1).max(200),
        dataUrl: z.string().min(1).max(7_000_000).startsWith("data:"),
      }),
    )
    .max(10)
    .nullable()
    .optional(),
};
const staffBody = z
  .object({
    userId: z.string().min(1).optional(),
    newUser: z
      .object({
        firstName: z.string().trim().min(1).max(100),
        lastName: z.string().trim().min(1).max(100),
        email: z.string().trim().email().max(200),
        roleCode: z.enum(["INSTITUTION_ADMIN", "TEACHER", "ACCOUNTANT", "STAFF"]),
      })
      .optional(),
    adjustments: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(100),
          type: z.nativeEnum(AdjustmentType),
          amount: z.coerce.number().positive(),
          isRecurring: z.boolean().optional(),
        }),
      )
      .max(20)
      .optional(),
    ...staffDetailsShape,
  })
  .refine((value) => value.userId || value.newUser, {
    message: "Provide an existing user or new staff details",
  });
const statusBody = z.object({
  status: z.nativeEnum(StaffStatus),
  disabledReason: z.string().trim().max(1000).nullable().optional(),
  leavingDate: z.coerce.date().nullable().optional(),
  resignationLetter: optionalText(5000),
});
const staffUpdateBody = z.object(staffDetailsShape).partial();
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
  attachment: z
    .object({
      name: z.string().trim().min(1).max(200),
      dataUrl: z.string().min(1).max(7_000_000).startsWith("data:"),
    })
    .nullable()
    .optional(),
});
const ownLeaveBody = leaveBody.omit({ staffId: true });
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
const adjustmentUpdateBody = adjustmentBody.partial().extend({
  isActive: z.boolean().optional(),
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

export async function updateDepartmentController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const { name } = nameBody.parse(req.body);
  res.json({ data: await updateDepartment(req.auth!.tenantId!, id, name) });
}

export async function deleteDepartmentController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteDepartment(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function updateDesignationController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const { name } = nameBody.parse(req.body);
  res.json({ data: await updateDesignation(req.auth!.tenantId!, id, name) });
}

export async function deleteDesignationController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteDesignation(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function createStaffLeaveTypeController(req: Request, res: Response) {
  res.status(201).json({
    data: await createStaffLeaveType(req.auth!.tenantId!, leaveTypeBody.parse(req.body)),
  });
}

export async function updateStaffLeaveTypeController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateStaffLeaveType(
      req.auth!.tenantId!,
      id,
      leaveTypeBody.partial().parse(req.body),
    ),
  });
}

export async function deleteStaffLeaveTypeController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteStaffLeaveType(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function createPayParameterController(req: Request, res: Response) {
  res.status(201).json({
    data: await createPayParameter(req.auth!.tenantId!, payParameterBody.parse(req.body)),
  });
}

export async function updatePayParameterController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updatePayParameter(
      req.auth!.tenantId!,
      id,
      payParameterUpdateBody.parse(req.body),
    ),
  });
}

export async function deletePayParameterController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deletePayParameter(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function createStaffProfileController(req: Request, res: Response) {
  res.status(201).json({
    data: await createStaffProfile(req.auth!.tenantId!, staffBody.parse(req.body)),
  });
}

export async function updateStaffProfileController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateStaffProfile(req.auth!.tenantId!, id, staffUpdateBody.parse(req.body)),
  });
}

export async function getStaffDetailController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getStaffDetail(req.auth!.tenantId!, id) });
}

export async function deleteStaffProfileController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteStaffProfile(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function listDisabledStaffController(req: Request, res: Response) {
  res.json({ data: await listDisabledStaff(req.auth!.tenantId!) });
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

export async function applyOwnStaffLeaveController(req: Request, res: Response) {
  res.status(201).json({
    data: await applyOwnStaffLeave(
      req.auth!.tenantId!,
      req.auth!.userId,
      ownLeaveBody.parse(req.body),
    ),
  });
}

export async function getStaffLeaveController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getStaffLeave(req.auth!.tenantId!, id) });
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

export async function updateStaffAdjustmentController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateStaffAdjustment(
      req.auth!.tenantId!,
      id,
      adjustmentUpdateBody.parse(req.body),
    ),
  });
}

export async function deleteStaffAdjustmentController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteStaffAdjustment(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function generatePayrollController(req: Request, res: Response) {
  res.status(201).json({
    data: await generatePayroll(req.auth!.tenantId!, payrollBody.parse(req.body)),
  });
}

export async function getPayrollPayslipController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getPayrollPayslip(req.auth!.tenantId!, id) });
}

export async function payPayrollController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await payPayroll(req.auth!.tenantId!, id, payBody.parse(req.body)),
  });
}

export async function revertPayrollController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await revertPayroll(req.auth!.tenantId!, id),
  });
}

export async function getTeacherRatingsSummaryController(req: Request, res: Response) {
  res.json({ data: await getTeacherRatingsSummary(req.auth!.tenantId!) });
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
