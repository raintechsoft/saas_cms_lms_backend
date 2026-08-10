import type { Request, Response } from "express";
import { z } from "zod";
import {
  createStudentDocsFolder,
  getStudentDocsFoldersSetup,
  reorderStudentDocsFolders,
  restoreStudentDocsFolder,
  softDeleteStudentDocsFolder,
  updateStudentDocsFolder,
} from "./student-docs-folders.service.js";

const idParams = z.object({ id: z.string().min(1) });

const folderBody = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
});

const reorderBody = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
});

export async function getStudentDocsFoldersSetupController(req: Request, res: Response) {
  res.json({ data: await getStudentDocsFoldersSetup(req.auth!.tenantId!) });
}

export async function createStudentDocsFolderController(req: Request, res: Response) {
  res.status(201).json({
    data: await createStudentDocsFolder(req.auth!.tenantId!, folderBody.parse(req.body)),
  });
}

export async function updateStudentDocsFolderController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateStudentDocsFolder(
      req.auth!.tenantId!,
      id,
      folderBody.partial().parse(req.body),
    ),
  });
}

export async function deleteStudentDocsFolderController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await softDeleteStudentDocsFolder(req.auth!.tenantId!, id) });
}

export async function restoreStudentDocsFolderController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await restoreStudentDocsFolder(req.auth!.tenantId!, id) });
}

export async function reorderStudentDocsFoldersController(req: Request, res: Response) {
  const body = reorderBody.parse(req.body);
  res.json({
    data: await reorderStudentDocsFolders(req.auth!.tenantId!, body.orderedIds),
  });
}
