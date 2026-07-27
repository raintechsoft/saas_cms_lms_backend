import { AdmissionType, Gender, OnlineAdmissionStatus, StudentStatus } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  addEnrollment,
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
  acceptOnlineAdmission,
  listOnlineAdmissions,
  rejectOnlineAdmission,
} from "./admissions.service.js";

const nullableText = (max = 255) => z.string().trim().max(max).nullable().optional();
const idParams = z.object({ id: z.string().min(1) });
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
  photoUrl: z.string().url().nullable().optional().or(z.literal("").transform(() => null)),
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
