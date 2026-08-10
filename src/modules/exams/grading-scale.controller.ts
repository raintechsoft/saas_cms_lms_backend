import type { Request, Response } from "express";
import { z } from "zod";
import {
  assignGradingScaleToClasses,
  createGradingScale,
  createGradingScaleGrade,
  deleteGradingScale,
  deleteGradingScaleGrade,
  getGradingScaleSetup,
  updateGradingScale,
  updateGradingScaleGrade,
} from "./grading-scale.service.js";

const idParams = z.object({ id: z.string().min(1) });
const scaleIdParams = z.object({ scaleId: z.string().min(1) });

const scaleBody = z.object({
  name: z.string().trim().min(1).max(120),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  classIds: z.array(z.string().min(1)).max(200).optional(),
});

const gradeBody = z.object({
  grade: z.string().trim().min(1).max(20),
  gradePoint: z.coerce.number().min(0).max(100),
  fromPercent: z.coerce.number().min(0).max(100),
  toPercent: z.coerce.number().min(0).max(100),
  gradeName: z.string().trim().max(100).nullable().optional(),
  remarks: z.string().trim().max(200).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
});

const assignBody = z.object({
  scaleId: z.string().min(1),
  classIds: z.array(z.string().min(1)).min(1).max(200),
});

export async function getGradingScaleSetupController(req: Request, res: Response) {
  res.json({ data: await getGradingScaleSetup(req.auth!.tenantId!) });
}

export async function createGradingScaleController(req: Request, res: Response) {
  res.status(201).json({
    data: await createGradingScale(req.auth!.tenantId!, scaleBody.parse(req.body)),
  });
}

export async function updateGradingScaleController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateGradingScale(
      req.auth!.tenantId!,
      id,
      scaleBody.partial().parse(req.body),
    ),
  });
}

export async function deleteGradingScaleController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteGradingScale(req.auth!.tenantId!, id) });
}

export async function createGradingScaleGradeController(req: Request, res: Response) {
  const { scaleId } = scaleIdParams.parse(req.params);
  res.status(201).json({
    data: await createGradingScaleGrade(
      req.auth!.tenantId!,
      scaleId,
      gradeBody.parse(req.body),
    ),
  });
}

export async function updateGradingScaleGradeController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateGradingScaleGrade(
      req.auth!.tenantId!,
      id,
      gradeBody.partial().parse(req.body),
    ),
  });
}

export async function deleteGradingScaleGradeController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteGradingScaleGrade(req.auth!.tenantId!, id) });
}

export async function assignGradingScaleToClassesController(req: Request, res: Response) {
  res.json({
    data: await assignGradingScaleToClasses(req.auth!.tenantId!, assignBody.parse(req.body)),
  });
}
