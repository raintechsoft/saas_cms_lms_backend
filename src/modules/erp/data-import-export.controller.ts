import type { Request, Response } from "express";
import { z } from "zod";
import {
  buildExportCsv,
  deleteImportJob,
  getDataImportExportSetup,
  runDataExport,
  runDataImport,
} from "./data-import-export.service.js";

const idParams = z.object({ id: z.string().min(1) });
const exportParams = z.object({ key: z.string().min(1) });

const moduleKey = z.enum([
  "students",
  "staff",
  "parents",
  "classes",
  "subjects",
  "fees",
  "attendance",
  "exams",
  "homework",
  "transport",
  "hostel",
  "library",
]);

const runBody = z.object({
  moduleKey,
  fileName: z.string().trim().min(1).max(260),
  hasHeaders: z.boolean().optional(),
  skipBlankRows: z.boolean().optional(),
  duplicateMode: z.enum(["SKIP", "UPDATE", "REPLACE"]).optional(),
  encoding: z.string().trim().max(40).optional(),
  columnMapping: z.record(z.string(), z.string()).optional(),
  previewRows: z.array(z.record(z.string(), z.string())).max(50).optional(),
  totalRows: z.coerce.number().int().min(0).max(100_000).optional(),
});

const runExportBody = z.object({
  moduleKeys: z.array(moduleKey).min(1).max(20),
  format: z.enum(["XLSX", "CSV", "PDF", "JSON"]).optional(),
  fileName: z.string().trim().max(260).optional(),
  includeHeaders: z.boolean().optional(),
  includeRelated: z.boolean().optional(),
  activeOnly: z.boolean().optional(),
  compressZip: z.boolean().optional(),
  encryptPassword: z.boolean().optional(),
  academicSessionId: z.string().trim().nullable().optional(),
  classSectionId: z.string().trim().nullable().optional(),
  statusFilter: z.string().trim().nullable().optional(),
  dateFrom: z.string().trim().nullable().optional(),
  dateTo: z.string().trim().nullable().optional(),
});

export async function getDataImportExportSetupController(req: Request, res: Response) {
  res.json({ data: await getDataImportExportSetup(req.auth!.tenantId!) });
}

export async function runDataImportController(req: Request, res: Response) {
  res.status(201).json({
    data: await runDataImport(req.auth!.tenantId!, req.auth!.userId, runBody.parse(req.body)),
  });
}

export async function deleteImportJobController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteImportJob(req.auth!.tenantId!, id) });
}

export async function exportDataController(req: Request, res: Response) {
  const { key } = exportParams.parse(req.params);
  const file = await buildExportCsv(req.auth!.tenantId!, key);
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
  res.send(file.body);
}

export async function runDataExportController(req: Request, res: Response) {
  const result = await runDataExport(
    req.auth!.tenantId!,
    req.auth!.userId,
    runExportBody.parse(req.body),
  );
  res.status(201).json({ data: result });
}
