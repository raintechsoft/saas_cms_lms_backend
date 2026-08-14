import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import {
  cancelLiveClass,
  createLiveClass,
  deleteLiveClass,
  getLiveClassById,
  getLiveClassesModuleSettings,
  getLiveClassesStats,
  listLiveClasses,
  publishLiveClass,
  updateLiveClass,
  updateLiveClassesModuleSettings,
} from "./liveClasses.service.js";

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

const listQuery = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED"]).optional(),
  subjectId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  hostTeacherId: z.string().min(1).optional(),
  search: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const sessionBody = z.object({
  title: z.string().trim().min(1).max(300),
  topic: z.string().trim().max(300).nullable().optional(),
  description: z.string().trim().max(20000).nullable().optional(),
  meetingUrl: z.string().trim().max(2000).nullable().optional(),
  provider: z.string().trim().max(32).nullable().optional(),
  subjectId: z.string().min(1).nullable().optional(),
  classId: z.string().min(1).nullable().optional(),
  classSectionId: z.string().min(1).nullable().optional(),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  hostTeacherId: z.string().min(1).nullable().optional(),
});

const sessionUpdateBody = sessionBody.partial().extend({
  startsAt: z.string().min(1).optional(),
  endsAt: z.string().min(1).optional(),
});

const settingsBody = z.object({
  allowTeachersToCreateLiveClasses: z.boolean(),
});

export async function listLiveClassesController(req: Request, res: Response) {
  res.json({ data: await listLiveClasses(tenantId(req), listQuery.parse(req.query)) });
}

export async function getLiveClassController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getLiveClassById(tenantId(req), id) });
}

export async function createLiveClassController(req: Request, res: Response) {
  const body = sessionBody.parse(req.body);
  res.status(201).json({
    data: await createLiveClass(tenantId(req), userId(req), body),
  });
}

export async function updateLiveClassController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = sessionUpdateBody.parse(req.body);
  res.json({ data: await updateLiveClass(tenantId(req), id, body) });
}

export async function publishLiveClassController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await publishLiveClass(tenantId(req), id) });
}

export async function cancelLiveClassController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await cancelLiveClass(tenantId(req), id) });
}

export async function deleteLiveClassController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteLiveClass(tenantId(req), id) });
}

export async function getStatsController(req: Request, res: Response) {
  res.json({ data: await getLiveClassesStats(tenantId(req), userId(req)) });
}

export async function getSettingsController(req: Request, res: Response) {
  res.json({ data: await getLiveClassesModuleSettings(tenantId(req)) });
}

export async function updateSettingsController(req: Request, res: Response) {
  const body = settingsBody.parse(req.body);
  res.json({
    data: await updateLiveClassesModuleSettings(
      tenantId(req),
      body.allowTeachersToCreateLiveClasses,
    ),
  });
}
