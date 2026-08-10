import type { Request, Response } from "express";
import { z } from "zod";
import {
  deleteModuleSetup,
  getModulesSetup,
  toggleModuleSetup,
  upsertModuleSetup,
} from "./modules-settings.service.js";

const keyParams = z.object({ key: z.string().min(1) });

const moduleBody = z.object({
  moduleKey: z.string().trim().max(40).optional(),
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  groupKey: z.enum(["CORE", "CMS", "LMS", "SYSTEM", "WEBSITE"]).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isConfigured: z.boolean().optional(),
  adminEnabled: z.boolean().optional(),
  studentEnabled: z.boolean().optional(),
  parentEnabled: z.boolean().optional(),
});

const toggleBody = z.object({
  adminEnabled: z.boolean().optional(),
});

export async function getModulesSetupController(req: Request, res: Response) {
  res.json({ data: await getModulesSetup(req.auth!.tenantId!) });
}

export async function upsertModuleSetupController(req: Request, res: Response) {
  const { key } = keyParams.parse(req.params);
  res.json({
    data: await upsertModuleSetup(req.auth!.tenantId!, key, moduleBody.parse(req.body)),
  });
}

export async function createModuleSetupController(req: Request, res: Response) {
  const body = moduleBody.parse(req.body);
  res.status(201).json({
    data: await upsertModuleSetup(req.auth!.tenantId!, body.moduleKey || body.label, body),
  });
}

export async function toggleModuleSetupController(req: Request, res: Response) {
  const { key } = keyParams.parse(req.params);
  const body = toggleBody.parse(req.body ?? {});
  res.json({
    data: await toggleModuleSetup(req.auth!.tenantId!, key, body.adminEnabled),
  });
}

export async function deleteModuleSetupController(req: Request, res: Response) {
  const { key } = keyParams.parse(req.params);
  res.json({ data: await deleteModuleSetup(req.auth!.tenantId!, key) });
}
