import { DocumentTemplateType, type Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  createDocumentTemplate,
  generateDocument,
  getGeneratedDocument,
  listDocumentTemplates,
  listGeneratedDocuments,
  updateDocumentTemplate,
} from "./documents.service.js";

const idParams = z.object({ id: z.string().min(1) });
const typeQuery = z.object({ type: z.nativeEnum(DocumentTemplateType).optional() });
const templateBody = z.object({
  type: z.nativeEnum(DocumentTemplateType),
  name: z.string().trim().min(1).max(100),
  backgroundUrl: z
    .string()
    .max(3_000_000)
    .nullable()
    .optional()
    .refine(
      (value) =>
        value == null ||
        value === "" ||
        /^https?:\/\//i.test(value) ||
        value.startsWith("data:image/"),
      { message: "Background must be an image URL or uploaded image" },
    ),
  width: z.coerce.number().int().min(100).max(5000),
  height: z.coerce.number().int().min(100).max(5000),
  config: z.record(z.string(), z.unknown()),
});
const templateUpdateBody = templateBody.omit({ type: true }).partial().extend({
  isActive: z.boolean().optional(),
});
const generateBody = z.object({
  templateId: z.string().min(1),
  studentId: z.string().min(1).optional(),
  staffId: z.string().min(1).optional(),
  examId: z.string().min(1).optional(),
  barcodeValue: z.string().trim().max(200).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});
const generatedQuery = z.object({
  type: z.nativeEnum(DocumentTemplateType).optional(),
  studentId: z.string().min(1).optional(),
  staffId: z.string().min(1).optional(),
});

export async function listDocumentTemplatesController(req: Request, res: Response) {
  const { type } = typeQuery.parse(req.query);
  res.json({ data: await listDocumentTemplates(req.auth!.tenantId!, type) });
}

export async function createDocumentTemplateController(req: Request, res: Response) {
  const body = templateBody.parse(req.body);
  res.status(201).json({
    data: await createDocumentTemplate(req.auth!.tenantId!, {
      ...body,
      config: body.config as Prisma.InputJsonValue,
    }),
  });
}

export async function updateDocumentTemplateController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = templateUpdateBody.parse(req.body);
  res.json({
    data: await updateDocumentTemplate(req.auth!.tenantId!, id, {
      ...body,
      config: body.config as Prisma.InputJsonValue | undefined,
    }),
  });
}

export async function generateDocumentController(req: Request, res: Response) {
  const body = generateBody.parse(req.body);
  res.status(201).json({
    data: await generateDocument(req.auth!.tenantId!, req.auth!.userId, {
      ...body,
      payload: body.payload as Prisma.InputJsonValue | undefined,
    }),
  });
}

export async function listGeneratedDocumentsController(req: Request, res: Response) {
  res.json({
    data: await listGeneratedDocuments(
      req.auth!.tenantId!,
      generatedQuery.parse(req.query),
    ),
  });
}

export async function getGeneratedDocumentController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getGeneratedDocument(req.auth!.tenantId!, id) });
}
