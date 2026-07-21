import {
  CustomFieldTarget,
  CustomFieldType,
  ErpSettingCategory,
  type Prisma,
} from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  createConfigurationBackup,
  createCustomField,
  createDocumentFolder,
  createHoliday,
  createPaymentMethod,
  createStudentDocument,
  deleteCustomField,
  deleteHoliday,
  deletePaymentMethod,
  deleteStudentDocument,
  getErpSetup,
  restoreConfigurationBackup,
  updateCustomField,
  updateIntegrationSetting,
  updatePaymentMethod,
  upsertLanguage,
  upsertModuleSetting,
  upsertProfileRight,
  upsertShortcut,
  upsertSystemField,
} from "./erp.service.js";

const idParams = z.object({ id: z.string().min(1) });
const keyParams = z.object({ key: z.string().trim().min(1).max(100) });
const categoryParams = z.object({ category: z.nativeEnum(ErpSettingCategory) });
const jsonObject = z.record(z.string(), z.unknown());
const integrationBody = z.object({
  provider: z.string().trim().max(100).nullable().optional(),
  isEnabled: z.boolean(),
  config: jsonObject,
  secrets: z.record(z.string(), z.string().max(2000)).optional(),
});
const paymentBody = z.object({
  code: z.string().trim().min(1).max(50).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(100),
  instructions: z.string().trim().max(5000).nullable().optional(),
  config: jsonObject.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
});
const paymentUpdateBody = paymentBody.omit({ code: true }).partial();
const moduleBody = z.object({
  adminEnabled: z.boolean(),
  studentEnabled: z.boolean(),
  parentEnabled: z.boolean(),
});
const languageBody = z.object({
  code: z.string().trim().min(2).max(10).transform((value) => value.toLowerCase()),
  name: z.string().trim().min(1).max(100),
  isEnabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});
const customFieldBody = z.object({
  target: z.nativeEnum(CustomFieldTarget),
  key: z.string().trim().regex(/^[a-z][a-z0-9_]*$/).max(100),
  label: z.string().trim().min(1).max(100),
  type: z.nativeEnum(CustomFieldType),
  options: z.array(z.string().max(100)).optional(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
});
const customFieldUpdateBody = customFieldBody.omit({ target: true, key: true, type: true }).partial();
const systemFieldBody = z.object({
  target: z.nativeEnum(CustomFieldTarget),
  label: z.string().trim().min(1).max(100),
  isEnabled: z.boolean(),
  isRequired: z.boolean(),
});
const shortcutBody = z.object({
  shortcut: z.string().trim().min(1).max(50),
  isEnabled: z.boolean(),
});
const profileRightBody = z.object({
  studentVisible: z.boolean(),
  parentVisible: z.boolean(),
  studentEditable: z.boolean(),
  parentEditable: z.boolean(),
});
const holidayBody = z.object({
  academicSessionId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(200),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  description: z.string().trim().max(5000).nullable().optional(),
});
const folderBody = z.object({
  name: z.string().trim().min(1).max(100),
  parentId: z.string().min(1).nullable().optional(),
});
const studentDocumentBody = z.object({
  studentId: z.string().min(1),
  folderId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  fileUrl: z.string().url().max(2000),
  mimeType: z.string().trim().max(100).nullable().optional(),
  sizeBytes: z.coerce.number().int().min(0).nullable().optional(),
});
const backupBody = z.object({ name: z.string().trim().min(1).max(200) });

export async function getErpSetupController(req: Request, res: Response) {
  res.json({ data: await getErpSetup(req.auth!.tenantId!) });
}

export async function updateIntegrationController(req: Request, res: Response) {
  const { category } = categoryParams.parse(req.params);
  const body = integrationBody.parse(req.body);
  res.json({
    data: await updateIntegrationSetting(req.auth!.tenantId!, category, {
      ...body,
      config: body.config as Prisma.InputJsonValue,
    }),
  });
}

export async function createPaymentMethodController(req: Request, res: Response) {
  const body = paymentBody.parse(req.body);
  res.status(201).json({
    data: await createPaymentMethod(req.auth!.tenantId!, {
      ...body,
      config: body.config as Prisma.InputJsonValue | undefined,
    }),
  });
}

export async function updatePaymentMethodController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = paymentUpdateBody.parse(req.body);
  res.json({
    data: await updatePaymentMethod(req.auth!.tenantId!, id, {
      ...body,
      config: body.config as Prisma.InputJsonValue | undefined,
    }),
  });
}

export async function deletePaymentMethodController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deletePaymentMethod(req.auth!.tenantId!, id) });
}

export async function upsertModuleController(req: Request, res: Response) {
  const { key } = keyParams.parse(req.params);
  res.json({
    data: await upsertModuleSetting(req.auth!.tenantId!, key, moduleBody.parse(req.body)),
  });
}

export async function upsertLanguageController(req: Request, res: Response) {
  res.json({
    data: await upsertLanguage(req.auth!.tenantId!, languageBody.parse(req.body)),
  });
}

export async function createCustomFieldController(req: Request, res: Response) {
  const body = customFieldBody.parse(req.body);
  res.status(201).json({
    data: await createCustomField(req.auth!.tenantId!, {
      ...body,
      options: body.options as Prisma.InputJsonValue | undefined,
    }),
  });
}

export async function updateCustomFieldController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = customFieldUpdateBody.parse(req.body);
  res.json({
    data: await updateCustomField(req.auth!.tenantId!, id, {
      ...body,
      options: body.options as Prisma.InputJsonValue | undefined,
    }),
  });
}

export async function deleteCustomFieldController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteCustomField(req.auth!.tenantId!, id) });
}

export async function upsertSystemFieldController(req: Request, res: Response) {
  const { key } = keyParams.parse(req.params);
  res.json({
    data: await upsertSystemField(
      req.auth!.tenantId!,
      key,
      systemFieldBody.parse(req.body),
    ),
  });
}

export async function upsertShortcutController(req: Request, res: Response) {
  const { key } = keyParams.parse(req.params);
  res.json({
    data: await upsertShortcut(req.auth!.tenantId!, key, shortcutBody.parse(req.body)),
  });
}

export async function upsertProfileRightController(req: Request, res: Response) {
  const { key } = keyParams.parse(req.params);
  res.json({
    data: await upsertProfileRight(
      req.auth!.tenantId!,
      key,
      profileRightBody.parse(req.body),
    ),
  });
}

export async function createHolidayController(req: Request, res: Response) {
  res.status(201).json({
    data: await createHoliday(req.auth!.tenantId!, holidayBody.parse(req.body)),
  });
}

export async function deleteHolidayController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteHoliday(req.auth!.tenantId!, id) });
}

export async function createDocumentFolderController(req: Request, res: Response) {
  res.status(201).json({
    data: await createDocumentFolder(req.auth!.tenantId!, folderBody.parse(req.body)),
  });
}

export async function createStudentDocumentController(req: Request, res: Response) {
  res.status(201).json({
    data: await createStudentDocument(
      req.auth!.tenantId!,
      req.auth!.userId,
      studentDocumentBody.parse(req.body),
    ),
  });
}

export async function deleteStudentDocumentController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteStudentDocument(req.auth!.tenantId!, id) });
}

export async function createConfigurationBackupController(
  req: Request,
  res: Response,
) {
  const { name } = backupBody.parse(req.body);
  res.status(201).json({
    data: await createConfigurationBackup(
      req.auth!.tenantId!,
      req.auth!.userId,
      name,
    ),
  });
}

export async function restoreConfigurationBackupController(
  req: Request,
  res: Response,
) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await restoreConfigurationBackup(
      req.auth!.tenantId!,
      req.auth!.userId,
      id,
    ),
  });
}
