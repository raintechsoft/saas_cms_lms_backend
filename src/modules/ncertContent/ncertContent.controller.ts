import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { persistDocumentUpload } from "../../lib/uploads.js";
import {
  archiveNcertResource,
  createNcertResource,
  deleteNcertResource,
  getNcertModuleSettings,
  getNcertResourceById,
  getNcertStats,
  listNcertResources,
  publishNcertResource,
  updateNcertModuleSettings,
  updateNcertResource,
} from "./ncertContent.service.js";

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
  chapter: z.string().optional(),
  category: z.enum(["BOOKS", "EXEMPLAR", "SOLUTIONS", "LAB_MANUAL", "RESOURCE_MAP"]).optional(),
  search: z.string().optional(),
  createdById: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const resourceBody = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(20000).nullable().optional(),
  chapter: z.string().trim().max(300).nullable().optional(),
  category: z.enum(["BOOKS", "EXEMPLAR", "SOLUTIONS", "LAB_MANUAL", "RESOURCE_MAP"]).optional(),
  resourceType: z.enum(["LINK", "FILE"]).optional(),
  resourceUrl: z.string().trim().max(2000).nullable().optional(),
  fileName: z.string().trim().max(500).nullable().optional(),
  subjectId: z.string().min(1).nullable().optional(),
  classId: z.string().min(1).nullable().optional(),
});

const resourceUpdateBody = resourceBody.partial();

const settingsBody = z.object({
  allowTeachersToCreateNcertResources: z.boolean(),
});

export async function listNcertResourcesController(req: Request, res: Response) {
  res.json({ data: await listNcertResources(tenantId(req), listQuery.parse(req.query)) });
}

export async function getNcertResourceController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getNcertResourceById(tenantId(req), id) });
}

export async function createNcertResourceController(req: Request, res: Response) {
  const body = resourceBody.parse(req.body);
  res.status(201).json({
    data: await createNcertResource(tenantId(req), userId(req), body),
  });
}

export async function updateNcertResourceController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = resourceUpdateBody.parse(req.body);
  res.json({ data: await updateNcertResource(tenantId(req), id, body) });
}

export async function publishNcertResourceController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await publishNcertResource(tenantId(req), id) });
}

export async function archiveNcertResourceController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await archiveNcertResource(tenantId(req), id) });
}

export async function deleteNcertResourceController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteNcertResource(tenantId(req), id) });
}

export async function getStatsController(req: Request, res: Response) {
  res.json({ data: await getNcertStats(tenantId(req), userId(req)) });
}

export async function getSettingsController(req: Request, res: Response) {
  res.json({ data: await getNcertModuleSettings(tenantId(req)) });
}

export async function updateSettingsController(req: Request, res: Response) {
  const body = settingsBody.parse(req.body);
  res.json({
    data: await updateNcertModuleSettings(tenantId(req), body.allowTeachersToCreateNcertResources),
  });
}

export async function uploadNcertFileController(req: Request, res: Response) {
  const file = req.file;
  if (!file) throw new AppError(400, "File is required", "FILE_REQUIRED");
  const url = await persistDocumentUpload(file);
  res.status(201).json({
    data: {
      resourceUrl: url,
      fileName: file.originalname,
      resourceType: "FILE" as const,
    },
  });
}
