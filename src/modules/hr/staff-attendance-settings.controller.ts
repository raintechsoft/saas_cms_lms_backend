import { HolidayKind } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  createStaffWorkShift,
  deleteStaffHoliday,
  deleteStaffWorkShift,
  getStaffAttendanceSettingsSetup,
  updateStaffAttendanceSettings,
  updateStaffWorkShift,
  upsertStaffHoliday,
} from "./staff-attendance-settings.service.js";

const idParams = z.object({ id: z.string().min(1) });
const timeString = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format");

const settingsBody = z.object({
  moduleEnabled: z.boolean().optional(),
  markingMode: z.string().trim().min(1).max(40).optional(),
  allowManual: z.boolean().optional(),
  allowSelfCheckIn: z.boolean().optional(),
  allowSelfCheckOut: z.boolean().optional(),
  showOfficeLocation: z.boolean().optional(),
  requireRemarksManual: z.boolean().optional(),
  halfDayAs: z.string().trim().min(1).max(40).optional(),
  colorScheme: z.string().trim().min(1).max(40).optional(),
  defaultShiftId: z.string().min(1).nullable().optional(),
  workingDays: z.array(z.coerce.number().int().min(0).max(6)).max(7).optional(),
  weeklyOffDays: z.array(z.coerce.number().int().min(0).max(6)).max(7).optional(),
  workFrom: timeString.optional(),
  workTo: timeString.optional(),
  breakMinutes: z.coerce.number().int().min(0).max(24 * 60).optional(),
  graceBeforeMinutes: z.coerce.number().int().min(0).max(24 * 60).optional(),
  graceAfterMinutes: z.coerce.number().int().min(0).max(24 * 60).optional(),
  lateAfterMinutes: z.coerce.number().int().min(0).max(24 * 60).optional(),
  earlyLeavingMinutes: z.coerce.number().int().min(0).max(24 * 60).optional(),
  halfDayAfterMinutes: z.coerce.number().int().min(0).max(24 * 60).optional(),
  overtimeMode: z.string().trim().min(1).max(40).optional(),
  minFullDayMinutes: z.coerce.number().int().min(0).max(24 * 60).optional(),
  markAbsentWeeklyOff: z.boolean().optional(),
  markAbsentHoliday: z.boolean().optional(),
  autoApplyApprovedLeave: z.boolean().optional(),
  autoMarkHoliday: z.boolean().optional(),
  leaveDayCounting: z.string().trim().min(1).max(60).optional(),
  absentMarkingType: z.string().trim().min(1).max(40).optional(),
  cdOnWeeklyOff: z.boolean().optional(),
  locationTracking: z.boolean().optional(),
  attendanceRadiusMeters: z.coerce.number().int().min(1).max(100000).optional(),
  allowCheckInOutside: z.boolean().optional(),
  allowCheckOutOutside: z.boolean().optional(),
  restrictMultipleLogin: z.boolean().optional(),
  deviceRestriction: z.string().trim().min(1).max(40).optional(),
});

const shiftBody = z.object({
  name: z.string().trim().min(1).max(100),
  startTime: timeString,
  endTime: timeString,
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const holidayBody = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  kind: z.nativeEnum(HolidayKind).optional(),
  repeatsAnnually: z.boolean().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

export async function getStaffAttendanceSettingsController(req: Request, res: Response) {
  res.json({ data: await getStaffAttendanceSettingsSetup(req.auth!.tenantId!) });
}

export async function updateStaffAttendanceSettingsController(req: Request, res: Response) {
  res.json({
    data: await updateStaffAttendanceSettings(
      req.auth!.tenantId!,
      settingsBody.parse(req.body),
    ),
  });
}

export async function createStaffWorkShiftController(req: Request, res: Response) {
  res.status(201).json({
    data: await createStaffWorkShift(req.auth!.tenantId!, shiftBody.parse(req.body)),
  });
}

export async function updateStaffWorkShiftController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateStaffWorkShift(
      req.auth!.tenantId!,
      id,
      shiftBody.partial().parse(req.body),
    ),
  });
}

export async function deleteStaffWorkShiftController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteStaffWorkShift(req.auth!.tenantId!, id) });
}

export async function upsertStaffHolidayController(req: Request, res: Response) {
  const body = holidayBody.parse(req.body);
  const idFromParams = typeof req.params.id === "string" ? req.params.id : undefined;
  res.json({
    data: await upsertStaffHoliday(req.auth!.tenantId!, {
      ...body,
      id: idFromParams ?? body.id,
    }),
  });
}

export async function deleteStaffHolidayController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteStaffHoliday(req.auth!.tenantId!, id) });
}
