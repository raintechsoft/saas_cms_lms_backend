import { AttendanceType, ExamResultType } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import { getSettings, updateSettings } from "./settings.service.js";

const updateSettingsSchema = z.object({
  address: z.string().max(1000).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(),
  currency: z.string().trim().min(3).max(3).transform((value) => value.toUpperCase()).optional(),
  timezone: z.string().trim().min(2).max(100).optional(),
  dateFormat: z.string().trim().min(4).max(30).optional(),
  attendanceType: z.nativeEnum(AttendanceType).optional(),
  autoAdmissionNumber: z.boolean().optional(),
  admissionPrefix: z.string().trim().max(20).nullable().optional(),
  autoStaffNumber: z.boolean().optional(),
  staffPrefix: z.string().trim().max(20).nullable().optional(),
  teacherRestricted: z.boolean().optional(),
  examResultType: z.nativeEnum(ExamResultType).optional(),
  onlineAdmission: z.boolean().optional(),
  liveClassAutoAttendance: z.boolean().optional(),
}).strict();

export async function getSettingsController(req: Request, res: Response) {
  res.json({ data: await getSettings(req.auth!.tenantId!) });
}

export async function updateSettingsController(req: Request, res: Response) {
  const input = updateSettingsSchema.parse(req.body);
  res.json({ data: await updateSettings(req.auth!.tenantId!, input) });
}
