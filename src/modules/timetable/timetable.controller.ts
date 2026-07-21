import { Weekday } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  createTimetableEntry,
  deleteTimetableEntry,
  getFreePeriodReport,
  getTimetableSetup,
  updateTimetableEntry,
} from "./timetable.service.js";

const idParams = z.object({ id: z.string().min(1) });
const setupQuery = z.object({
  sessionId: z.string().min(1).optional(),
  classSectionId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional(),
});
const entryBody = z.object({
  academicSessionId: z.string().min(1),
  classSectionId: z.string().min(1),
  classSubjectId: z.string().min(1),
  teacherId: z.string().min(1).nullable().optional(),
  weekday: z.nativeEnum(Weekday),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().trim().max(50).nullable().optional(),
});
const freeQuery = z.object({
  sessionId: z.string().min(1),
  weekday: z.nativeEnum(Weekday),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function getTimetableSetupController(req: Request, res: Response) {
  res.json({
    data: await getTimetableSetup(
      req.auth!.tenantId!,
      setupQuery.parse(req.query),
      { userId: req.auth!.userId, roles: req.auth!.roles },
    ),
  });
}

export async function createTimetableEntryController(req: Request, res: Response) {
  res.status(201).json({
    data: await createTimetableEntry(req.auth!.tenantId!, entryBody.parse(req.body)),
  });
}

export async function updateTimetableEntryController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateTimetableEntry(req.auth!.tenantId!, id, entryBody.parse(req.body)),
  });
}

export async function deleteTimetableEntryController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteTimetableEntry(req.auth!.tenantId!, id) });
}

export async function getFreePeriodReportController(req: Request, res: Response) {
  res.json({
    data: await getFreePeriodReport(req.auth!.tenantId!, freeQuery.parse(req.query)),
  });
}
