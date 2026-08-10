import type { Request, Response } from "express";
import { z } from "zod";
import {
  createLeaveType,
  deleteLeaveType,
  getLeaveTypesSetup,
  updateLeaveType,
} from "./leave-types-settings.service.js";

const idParams = z.object({ id: z.string().min(1) });

const leaveTypeBody = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(20).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  annualLimit: z.coerce.number().int().min(0).max(366).nullable().optional(),
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

export async function getLeaveTypesSetupController(req: Request, res: Response) {
  res.json({ data: await getLeaveTypesSetup(req.auth!.tenantId!) });
}

export async function createLeaveTypeSettingsController(req: Request, res: Response) {
  res.status(201).json({
    data: await createLeaveType(req.auth!.tenantId!, leaveTypeBody.parse(req.body)),
  });
}

export async function updateLeaveTypeSettingsController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateLeaveType(
      req.auth!.tenantId!,
      id,
      leaveTypeBody.partial().parse(req.body),
    ),
  });
}

export async function deleteLeaveTypeSettingsController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteLeaveType(req.auth!.tenantId!, id) });
}
