import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import {
  archiveLessonPlan,
  createLessonPlan,
  deleteLessonPlan,
  getLessonPlanById,
  getLessonPlanningModuleSettings,
  getLessonPlanningStats,
  listLessonPlans,
  publishLessonPlan,
  updateLessonPlan,
  updateLessonPlanningModuleSettings,
} from "./lessonPlanning.service.js";

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
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  subjectId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  search: z.string().optional(),
  createdById: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const planBody = z.object({
  title: z.string().trim().min(1).max(300),
  topic: z.string().trim().max(300).nullable().optional(),
  objectives: z.string().trim().max(20000).nullable().optional(),
  materials: z.string().trim().max(20000).nullable().optional(),
  activities: z.string().trim().max(20000).nullable().optional(),
  assessmentNotes: z.string().trim().max(20000).nullable().optional(),
  homework: z.string().trim().max(20000).nullable().optional(),
  subjectId: z.string().min(1).nullable().optional(),
  classId: z.string().min(1).nullable().optional(),
  plannedDate: z.string().trim().max(32).nullable().optional(),
  durationMinutes: z.coerce.number().int().min(1).max(600).nullable().optional(),
});

const planUpdateBody = planBody.partial();

const settingsBody = z.object({
  allowTeachersToCreateLessonPlans: z.boolean(),
});

export async function listLessonPlansController(req: Request, res: Response) {
  res.json({ data: await listLessonPlans(tenantId(req), listQuery.parse(req.query)) });
}

export async function getLessonPlanController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getLessonPlanById(tenantId(req), id) });
}

export async function createLessonPlanController(req: Request, res: Response) {
  const body = planBody.parse(req.body);
  res.status(201).json({
    data: await createLessonPlan(tenantId(req), userId(req), body),
  });
}

export async function updateLessonPlanController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = planUpdateBody.parse(req.body);
  res.json({ data: await updateLessonPlan(tenantId(req), id, body) });
}

export async function publishLessonPlanController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await publishLessonPlan(tenantId(req), id) });
}

export async function archiveLessonPlanController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await archiveLessonPlan(tenantId(req), id) });
}

export async function deleteLessonPlanController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteLessonPlan(tenantId(req), id) });
}

export async function getStatsController(req: Request, res: Response) {
  res.json({ data: await getLessonPlanningStats(tenantId(req), userId(req)) });
}

export async function getSettingsController(req: Request, res: Response) {
  res.json({ data: await getLessonPlanningModuleSettings(tenantId(req)) });
}

export async function updateSettingsController(req: Request, res: Response) {
  const body = settingsBody.parse(req.body);
  res.json({
    data: await updateLessonPlanningModuleSettings(
      tenantId(req),
      body.allowTeachersToCreateLessonPlans,
    ),
  });
}
