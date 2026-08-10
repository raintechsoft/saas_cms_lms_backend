import { PeriodNumberingMode, Weekday } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  createTimetablePeriod,
  createTimetableTemplate,
  deleteTimetablePeriod,
  deleteTimetableTemplate,
  getTimetablePeriodSetup,
  updateTimetablePeriod,
  updateTimetablePeriodSettings,
  updateTimetableTemplate,
} from "./period-setup.service.js";

const idParams = z.object({ id: z.string().min(1) });
const timeString = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Expected HH:mm");

const settingsBody = z.object({
  workingDays: z.array(z.nativeEnum(Weekday)).max(7).optional(),
  defaultPeriodDuration: z.coerce.number().int().min(5).max(240).optional(),
  firstPeriodStartsAt: timeString.optional(),
  lastPeriodEndsAt: timeString.optional(),
  periodNumberingMode: z.nativeEnum(PeriodNumberingMode).optional(),
  allowPeriodOverlap: z.boolean().optional(),
  enableDoublePeriod: z.boolean().optional(),
});

const periodBody = z.object({
  name: z.string().trim().min(1).max(100),
  startTime: timeString,
  endTime: timeString,
  isBreak: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
});

const templateBody = z.object({
  name: z.string().trim().min(1).max(120),
  classIds: z.array(z.string().min(1)).max(200).optional(),
  workingDays: z.array(z.nativeEnum(Weekday)).max(7).optional(),
  isActive: z.boolean().optional(),
});

export async function getTimetablePeriodSetupController(req: Request, res: Response) {
  res.json({ data: await getTimetablePeriodSetup(req.auth!.tenantId!) });
}

export async function updateTimetablePeriodSettingsController(req: Request, res: Response) {
  res.json({
    data: await updateTimetablePeriodSettings(req.auth!.tenantId!, settingsBody.parse(req.body)),
  });
}

export async function createTimetablePeriodController(req: Request, res: Response) {
  res.status(201).json({
    data: await createTimetablePeriod(req.auth!.tenantId!, periodBody.parse(req.body)),
  });
}

export async function updateTimetablePeriodController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateTimetablePeriod(
      req.auth!.tenantId!,
      id,
      periodBody.partial().parse(req.body),
    ),
  });
}

export async function deleteTimetablePeriodController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteTimetablePeriod(req.auth!.tenantId!, id) });
}

export async function createTimetableTemplateController(req: Request, res: Response) {
  res.status(201).json({
    data: await createTimetableTemplate(req.auth!.tenantId!, templateBody.parse(req.body)),
  });
}

export async function updateTimetableTemplateController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateTimetableTemplate(
      req.auth!.tenantId!,
      id,
      templateBody.partial().parse(req.body),
    ),
  });
}

export async function deleteTimetableTemplateController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteTimetableTemplate(req.auth!.tenantId!, id) });
}
