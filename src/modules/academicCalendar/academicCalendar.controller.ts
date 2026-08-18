import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import {
  archiveAcademicEvent,
  createAcademicEvent,
  deleteAcademicEvent,
  getAcademicCalendarSettings,
  getAcademicCalendarStats,
  getAcademicEventById,
  listAcademicEvents,
  publishAcademicEvent,
  updateAcademicCalendarSettings,
  updateAcademicEvent,
} from "./academicCalendar.service.js";

function tenantId(req: Request) {
  const id = req.auth?.tenantId;
  if (!id) throw new AppError(401, "Unauthenticated", "AUTH_REQUIRED");
  return id;
}

function userId(req: Request) {
  const id = req.auth?.userId;
  if (!id) throw new AppError(401, "Unauthenticated", "AUTH_REQUIRED");
  return id;
}

const idParams = z.object({ id: z.string().min(1) });

const eventTypeEnum = z.enum([
  "ACADEMIC",
  "EXAMINATION",
  "HOLIDAY",
  "MEETING",
  "OTHER",
  "IMPORTANT",
]);

const listQuery = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  eventType: eventTypeEnum.optional(),
  classId: z.string().min(1).optional(),
  search: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  createdById: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
});

const eventBody = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(20000).nullable().optional(),
  location: z.string().trim().max(500).nullable().optional(),
  eventType: eventTypeEnum.optional(),
  startAt: z.string().min(1),
  endAt: z.string().nullable().optional(),
  allDay: z.boolean().optional(),
  classId: z.string().min(1).nullable().optional(),
});

const eventUpdateBody = eventBody.partial();

const settingsBody = z.object({
  allowTeachersToCreateEvents: z.boolean().optional(),
  importantNotes: z.string().trim().max(5000).nullable().optional(),
});

const statsQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function listAcademicEventsController(req: Request, res: Response) {
  res.json({ data: await listAcademicEvents(tenantId(req), listQuery.parse(req.query)) });
}

export async function getAcademicEventController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getAcademicEventById(tenantId(req), id) });
}

export async function createAcademicEventController(req: Request, res: Response) {
  const body = eventBody.parse(req.body);
  res.status(201).json({
    data: await createAcademicEvent(tenantId(req), userId(req), body),
  });
}

export async function updateAcademicEventController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = eventUpdateBody.parse(req.body);
  res.json({ data: await updateAcademicEvent(tenantId(req), id, body) });
}

export async function publishAcademicEventController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await publishAcademicEvent(tenantId(req), id) });
}

export async function archiveAcademicEventController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await archiveAcademicEvent(tenantId(req), id) });
}

export async function deleteAcademicEventController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteAcademicEvent(tenantId(req), id) });
}

export async function getStatsController(req: Request, res: Response) {
  res.json({ data: await getAcademicCalendarStats(tenantId(req), statsQuery.parse(req.query)) });
}

export async function getSettingsController(req: Request, res: Response) {
  res.json({ data: await getAcademicCalendarSettings(tenantId(req)) });
}

export async function updateSettingsController(req: Request, res: Response) {
  const body = settingsBody.parse(req.body);
  res.json({ data: await updateAcademicCalendarSettings(tenantId(req), body) });
}
