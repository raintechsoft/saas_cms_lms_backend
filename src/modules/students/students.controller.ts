import { AdmissionType, Gender, OnlineAdmissionStatus, StudentStatus } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import {
  addEnrollment,
  bulkUploadStudentPhotos,
  createStudent,
  createStudentMaster,
  deleteStudentMaster,
  deleteStudents,
  detectSiblings,
  getStudentDetail,
  getStudentSetup,
  importStudentsCsv,
  linkSiblings,
  listStudents,
  updateStudent,
} from "./students.service.js";
import {
  getStudentExams,
  getStudentPortalAccounts,
  getStudentSubjects,
  getStudentTimeline,
  resetStudentPortalPassword,
} from "./students-360.service.js";
import {
  getPortalLoginReminderSettings,
  listAppDownloadStatus,
  sendInactivePortalLoginReminders,
  updatePortalLoginReminderSettings,
} from "./app-download-status.service.js";
import {
  deleteStudentDocumentWithReason,
  listStudentDocumentFolders,
  listStudentDocumentsBrowser,
  uploadStudentDocumentFile,
} from "./student-documents.service.js";
import {
  acceptOnlineAdmission,
  listOnlineAdmissions,
  rejectOnlineAdmission,
} from "./admissions.service.js";

const nullableText = (max = 255) => z.string().trim().max(max).nullable().optional();
const idParams = z.object({ id: z.string().min(1) });

/** Accepts absolute URLs, relative upload paths, empty → null. */
const nullablePhotoUrl = z
  .union([
    z.literal(""),
    z.null(),
    z.string().trim().url(),
    z
      .string()
      .trim()
      .regex(/^\/uploads\/.+/i, "Invalid photo path"),
  ])
  .optional()
  .transform((value) => (value === "" || value == null ? null : value));

const studentBody = z.object({
  admissionNumber: z.string().trim().min(1).max(50).regex(/^[^/\\]+$/).optional(),
  firstName: z.string().trim().min(1).max(100),
  lastName: nullableText(100),
  gender: z.nativeEnum(Gender).nullable().optional(),
  dateOfBirth: z.coerce.date().nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  houseId: z.string().min(1).nullable().optional(),
  religion: nullableText(100),
  caste: nullableText(100),
  mobile: nullableText(30),
  email: z.string().email().nullable().optional().or(z.literal("").transform(() => null)),
  admissionDate: z.coerce.date(),
  photoUrl: nullablePhotoUrl,
  bloodGroup: nullableText(10),
  height: z.number().positive().max(300).nullable().optional(),
  weight: z.number().positive().max(500).nullable().optional(),
  currentAddress: nullableText(1000),
  permanentAddress: nullableText(1000),
  fatherName: nullableText(100),
  fatherPhone: nullableText(30),
  fatherEmail: z.string().email().nullable().optional().or(z.literal("").transform(() => null)),
  fatherOccupation: nullableText(100),
  motherName: nullableText(100),
  motherPhone: nullableText(30),
  motherEmail: z.string().email().nullable().optional().or(z.literal("").transform(() => null)),
  motherOccupation: nullableText(100),
  guardianName: nullableText(100),
  guardianRelation: nullableText(100),
  guardianPhone: nullableText(30),
  guardianEmail: z.string().email().nullable().optional().or(z.literal("").transform(() => null)),
  guardianOccupation: nullableText(100),
  nationality: nullableText(100),
  admissionType: z.nativeEnum(AdmissionType).optional(),
  rteEnabled: z.boolean().optional(),
  rteSchemeName: nullableText(150),
  rteCertificateNo: nullableText(100),
  transportOptIn: z.boolean().optional(),
  transportRoute: nullableText(150),
  hostelOptIn: z.boolean().optional(),
  hostelRoom: nullableText(100),
  additionalNotes: nullableText(2000),
  classSectionId: z.string().min(1),
  rollNumber: nullableText(30),
}).strict();
const updateStudentBody = studentBody
  .omit({ classSectionId: true, rollNumber: true })
  .partial()
  .extend({
    status: z.nativeEnum(StudentStatus).optional(),
    disabledReason: nullableText(500),
  });
const listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  classSectionId: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
});
const enrollmentBody = z.object({
  classSectionId: z.string().min(1),
  rollNumber: nullableText(30),
});
const masterParams = z.object({
  resource: z.enum(["categories", "houses", "disable-reasons"]),
  id: z.string().min(1).optional(),
});
const masterBody = z.object({ name: z.string().trim().min(1).max(100) });
const idsBody = z.object({ ids: z.array(z.string().min(1)).min(1).max(200) });
const siblingsBody = z.object({ studentIds: z.array(z.string().min(1)).min(2).max(20) });
const importBody = z.object({ csv: z.string().min(10).max(500_000) });
const admissionListQuery = z.object({
  status: z.nativeEnum(OnlineAdmissionStatus).optional(),
});
const reviewBody = z.object({
  note: nullableText(1000),
  classSectionId: z.string().min(1).optional(),
});

export async function getStudentSetupController(req: Request, res: Response) {
  res.json({ data: await getStudentSetup(req.auth!.tenantId!) });
}

export async function listStudentsController(req: Request, res: Response) {
  res.json({
    data: await listStudents(req.auth!.tenantId!, listQuery.parse(req.query)),
  });
}

export async function getStudentDetailController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getStudentDetail(req.auth!.tenantId!, id) });
}

export async function createStudentController(req: Request, res: Response) {
  const data = await createStudent(req.auth!.tenantId!, studentBody.parse(req.body));
  res.status(201).json({ data });
}

export async function updateStudentController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateStudent(req.auth!.tenantId!, id, updateStudentBody.parse(req.body)),
  });
}

export async function deleteStudentsController(req: Request, res: Response) {
  res.json({
    data: await deleteStudents(req.auth!.tenantId!, idsBody.parse(req.body).ids),
  });
}

export async function bulkUploadStudentPhotosController(req: Request, res: Response) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const classSectionId =
    typeof req.body?.classSectionId === "string" && req.body.classSectionId.trim()
      ? req.body.classSectionId.trim()
      : null;
  res.status(201).json({
    data: await bulkUploadStudentPhotos(req.auth!.tenantId!, files, { classSectionId }),
  });
}

export async function importStudentsController(req: Request, res: Response) {
  res.json({
    data: await importStudentsCsv(req.auth!.tenantId!, importBody.parse(req.body).csv),
  });
}

export async function linkSiblingsController(req: Request, res: Response) {
  res.json({
    data: await linkSiblings(req.auth!.tenantId!, siblingsBody.parse(req.body).studentIds),
  });
}

export async function detectSiblingsController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await detectSiblings(req.auth!.tenantId!, id) });
}

export async function addEnrollmentController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const data = await addEnrollment(req.auth!.tenantId!, id, enrollmentBody.parse(req.body));
  res.status(201).json({ data });
}

export async function createStudentMasterController(req: Request, res: Response) {
  const { resource } = masterParams.parse(req.params);
  const { name } = masterBody.parse(req.body);
  res.status(201).json({
    data: await createStudentMaster(req.auth!.tenantId!, resource, name),
  });
}

export async function deleteStudentMasterController(req: Request, res: Response) {
  const { resource, id } = masterParams.parse(req.params);
  if (!id) {
    res.status(400).json({ error: { code: "ID_REQUIRED", message: "Master id required" } });
    return;
  }
  await deleteStudentMaster(req.auth!.tenantId!, resource, id);
  res.status(204).send();
}

export async function listOnlineAdmissionsController(req: Request, res: Response) {
  res.json({
    data: await listOnlineAdmissions(req.auth!.tenantId!, admissionListQuery.parse(req.query).status),
  });
}

export async function acceptOnlineAdmissionController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = reviewBody.parse(req.body);
  res.json({
    data: await acceptOnlineAdmission(req.auth!.tenantId!, id, req.auth!.userId, body),
  });
}

export async function rejectOnlineAdmissionController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = reviewBody.parse(req.body);
  res.json({
    data: await rejectOnlineAdmission(req.auth!.tenantId!, id, req.auth!.userId, body.note),
  });
}

export async function getStudentExamsController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getStudentExams(req.auth!.tenantId!, id) });
}

export async function getStudentSubjectsController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getStudentSubjects(req.auth!.tenantId!, id) });
}

export async function getStudentTimelineController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getStudentTimeline(req.auth!.tenantId!, id) });
}

export async function getStudentPortalAccountsController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getStudentPortalAccounts(req.auth!.tenantId!, id) });
}

const portalPasswordBody = z.object({
  role: z.enum(["STUDENT", "PARENT"]),
  guardianUserId: z.string().min(1).nullable().optional(),
  sendEmail: z.boolean().optional(),
});

export async function resetStudentPortalPasswordController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await resetStudentPortalPassword(
      req.auth!.tenantId!,
      id,
      portalPasswordBody.parse(req.body),
    ),
  });
}

const appDownloadQuery = z.object({
  status: z.enum(["ALL", "ACTIVE", "INACTIVE", "NO_ACCOUNT"]).optional(),
  classSectionId: z.string().min(1).optional(),
  search: z.string().trim().max(100).optional(),
});

const reminderSettingsBody = z.object({
  enabled: z.boolean(),
  sendSms: z.boolean(),
  sendEmail: z.boolean(),
  intervalDays: z.coerce.number().int().min(1).max(90),
});

const remindBody = z.object({
  studentId: z.string().min(1).optional(),
});

export async function listAppDownloadStatusController(req: Request, res: Response) {
  res.json({
    data: await listAppDownloadStatus(req.auth!.tenantId!, appDownloadQuery.parse(req.query)),
  });
}

export async function getPortalLoginReminderSettingsController(req: Request, res: Response) {
  res.json({ data: await getPortalLoginReminderSettings(req.auth!.tenantId!) });
}

export async function updatePortalLoginReminderSettingsController(req: Request, res: Response) {
  res.json({
    data: await updatePortalLoginReminderSettings(
      req.auth!.tenantId!,
      reminderSettingsBody.parse(req.body),
    ),
  });
}

export async function sendPortalLoginRemindersController(req: Request, res: Response) {
  const body = remindBody.parse(req.body ?? {});
  res.json({
    data: await sendInactivePortalLoginReminders(req.auth!.tenantId!, req.auth!.userId, body),
  });
}

const documentBrowserQuery = z.object({
  folderId: z.string().min(1).optional(),
  classSectionId: z.string().min(1).optional(),
  search: z.string().trim().max(100).optional(),
  studentId: z.string().min(1).optional(),
});

const documentDeleteBody = z.object({
  reason: z.string().trim().min(3).max(500),
});

export async function listStudentDocumentFoldersController(req: Request, res: Response) {
  res.json({ data: await listStudentDocumentFolders(req.auth!.tenantId!) });
}

export async function listStudentDocumentsBrowserController(req: Request, res: Response) {
  res.json({
    data: await listStudentDocumentsBrowser(
      req.auth!.tenantId!,
      documentBrowserQuery.parse(req.query),
    ),
  });
}

export async function uploadStudentDocumentController(req: Request, res: Response) {
  const file = req.file;
  if (!file) throw new AppError(400, "Document file is required", "FILE_REQUIRED");
  const body = z
    .object({
      studentId: z.string().min(1),
      folderId: z.string().min(1),
      name: z.string().trim().max(200).optional(),
    })
    .parse(req.body);
  res.status(201).json({
    data: await uploadStudentDocumentFile(req.auth!.tenantId!, req.auth!.userId, {
      ...body,
      file,
    }),
  });
}

export async function deleteStudentDocumentManagedController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = documentDeleteBody.parse(req.body ?? {});
  res.json({
    data: await deleteStudentDocumentWithReason(
      req.auth!.tenantId!,
      req.auth!.userId,
      id,
      body.reason,
    ),
  });
}
