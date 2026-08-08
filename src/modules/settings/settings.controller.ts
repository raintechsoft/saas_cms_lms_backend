import { AttendanceType, ExamResultType } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import { getSchoolProfile, updateSchoolProfile } from "./school-profile.service.js";
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
  attendancePresentPoints: z.coerce.number().int().min(-100).max(100).optional(),
  attendanceHalfDayPoints: z.coerce.number().int().min(-100).max(100).optional(),
  attendanceLatePoints: z.coerce.number().int().min(-100).max(100).optional(),
}).strict();

const schoolProfileSchema = z.object({
  institutionName: z.string().trim().min(1).max(160).optional(),
  frontDisplayName: z.string().trim().max(160).nullable().optional(),
  tagline: z.string().trim().max(240).nullable().optional(),
  address: z.string().max(1000).nullable().optional(),
  email: z
    .union([z.string().email(), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  phone: z.string().max(30).nullable().optional(),
  website: z.string().trim().max(200).nullable().optional(),
  establishedYear: z.string().trim().max(10).nullable().optional(),
  affiliation: z.string().trim().max(120).nullable().optional(),
  schoolCode: z.string().trim().max(40).nullable().optional(),
  logoUrl: z.string().trim().max(2_000_000).nullable().optional(),
});

export async function getSettingsController(req: Request, res: Response) {
  res.json({ data: await getSettings(req.auth!.tenantId!) });
}

export async function updateSettingsController(req: Request, res: Response) {
  const input = updateSettingsSchema.parse(req.body);
  res.json({ data: await updateSettings(req.auth!.tenantId!, input) });
}

export async function getSchoolProfileController(req: Request, res: Response) {
  res.json({ data: await getSchoolProfile(req.auth!.tenantId!) });
}

export async function updateSchoolProfileController(req: Request, res: Response) {
  const input = schoolProfileSchema.parse(req.body);
  res.json({ data: await updateSchoolProfile(req.auth!.tenantId!, input) });
}
