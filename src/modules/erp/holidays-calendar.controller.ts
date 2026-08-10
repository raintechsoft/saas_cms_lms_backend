import type { Request, Response } from "express";
import { z } from "zod";
import {
  buildHolidaysExportCsv,
  createCalendarHoliday,
  deleteCalendarHoliday,
  deleteHolidayGroup,
  getHolidaysCalendarSetup,
  saveHolidaySettings,
  updateCalendarHoliday,
  upsertHolidayGroup,
} from "./holidays-calendar.service.js";

const sessionQuery = z.object({
  sessionId: z.string().min(1).optional(),
});

const holidayBody = z.object({
  academicSessionId: z.string().min(1).nullable().optional(),
  groupId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(200),
  startDate: z.string().min(1),
  endDate: z.string().min(1).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  calendarType: z.enum(["GAZETTED", "OPTIONAL", "RESTRICTED"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  repeatsAnnually: z.boolean().optional(),
});

const idParams = z.object({ id: z.string().min(1) });

const groupBody = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  color: z.string().trim().max(20).optional(),
  isActive: z.boolean().optional(),
});

const settingsBody = z.object({
  sundayIsHoliday: z.boolean().optional(),
  saturdayIsHoliday: z.boolean().optional(),
  autoApplyAttendance: z.boolean().optional(),
  notifyParentsOnHoliday: z.boolean().optional(),
  showOnPortal: z.boolean().optional(),
  defaultCalendarType: z.enum(["GAZETTED", "OPTIONAL", "RESTRICTED"]).optional(),
});

export async function getHolidaysCalendarSetupController(req: Request, res: Response) {
  const query = sessionQuery.parse(req.query);
  res.json({
    data: await getHolidaysCalendarSetup(req.auth!.tenantId!, query.sessionId),
  });
}

export async function createCalendarHolidayController(req: Request, res: Response) {
  res.status(201).json({
    data: await createCalendarHoliday(req.auth!.tenantId!, holidayBody.parse(req.body)),
  });
}

export async function updateCalendarHolidayController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateCalendarHoliday(req.auth!.tenantId!, id, holidayBody.parse(req.body)),
  });
}

export async function deleteCalendarHolidayController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const query = sessionQuery.parse(req.query);
  res.json({
    data: await deleteCalendarHoliday(req.auth!.tenantId!, id, query.sessionId),
  });
}

export async function upsertHolidayGroupController(req: Request, res: Response) {
  res.json({
    data: await upsertHolidayGroup(req.auth!.tenantId!, groupBody.parse(req.body)),
  });
}

export async function deleteHolidayGroupController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteHolidayGroup(req.auth!.tenantId!, id) });
}

export async function saveHolidaySettingsController(req: Request, res: Response) {
  res.json({
    data: await saveHolidaySettings(req.auth!.tenantId!, settingsBody.parse(req.body)),
  });
}

export async function exportHolidaysCalendarController(req: Request, res: Response) {
  const query = sessionQuery.parse(req.query);
  const setup = await getHolidaysCalendarSetup(req.auth!.tenantId!, query.sessionId);
  const csv = buildHolidaysExportCsv(setup.holidays);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="holidays_${setup.stats.sessionName.replace(/\s+/g, "_")}.csv"`,
  );
  res.send(csv);
}
