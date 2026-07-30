import { SubjectType } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  assignSubject,
  bulkUpdateStudentSections,
  createClass,
  createClassSection,
  createElectiveCategory,
  createSection,
  createSession,
  createSubject,
  deleteElectiveCategory,
  deleteScopedRecord,
  getAcademicSetup,
  getElectiveAssignmentBoard,
  promoteStudents,
  saveStudentElectives,
  setCurrentSession,
  updateClass,
  updateClassSection,
  updateElectiveCategory,
  updateSection,
  updateSubject,
} from "./academics.service.js";

const idParams = z.object({ id: z.string().min(1) });
const setupQuery = z.object({ sessionId: z.string().min(1).optional() });
const sessionBody = z.object({
  name: z.string().trim().min(3).max(50),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.boolean().default(false),
});
const classBody = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(30).nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});
const sectionBody = z.object({ name: z.string().trim().min(1).max(100) });
const subjectBody = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(30).nullable().optional(),
  type: z.nativeEnum(SubjectType).default(SubjectType.CORE),
  electiveCategoryId: z
    .preprocess((value) => (value === "" || value === undefined ? null : value), z.string().min(1).nullable())
    .optional(),
});
const classSectionBody = z.object({
  academicSessionId: z.string().min(1),
  classId: z.string().min(1),
  sectionId: z.string().min(1),
  classTeacherId: z
    .preprocess((value) => (value === "" || value === undefined ? null : value), z.string().min(1).nullable())
    .optional(),
});
const teacherBody = z.object({
  classTeacherId: z
    .preprocess((value) => (value === "" || value === undefined ? null : value), z.string().min(1).nullable())
    .optional(),
});
const subjectAssignmentBody = z.object({
  classSectionId: z.string().min(1),
  subjectId: z.string().min(1),
  teacherId: z
    .preprocess((value) => (value === "" || value === undefined ? null : value), z.string().min(1).nullable())
    .optional(),
});
const deleteParams = z.object({
  resource: z.enum([
    "classes",
    "sections",
    "subjects",
    "class-sections",
    "subject-assignments",
  ]),
  id: z.string().min(1),
});

const electiveCategoryBody = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).nullable().optional(),
  classId: z
    .preprocess((value) => (value === "" || value === undefined ? null : value), z.string().min(1).nullable())
    .optional(),
  maxSelect: z.number().int().min(1).max(10).default(1),
});

const electiveBoardQuery = z.object({
  classSectionId: z.string().min(1),
});

const saveElectivesBody = z.object({
  classSectionId: z.string().min(1),
  items: z
    .array(
      z.object({
        studentEnrollmentId: z.string().min(1),
        subjectIds: z.array(z.string().min(1)).max(20),
      }),
    )
    .min(1),
});

const promotionBody = z.object({
  fromClassSectionId: z.string().min(1),
  promoteSessionId: z.string().min(1),
  passContinueClassId: z.string().min(1),
  passContinueSectionId: z.string().min(1),
  items: z
    .array(
      z.object({
        studentEnrollmentId: z.string().min(1),
        result: z.enum(["PASS", "FAIL"]),
        action: z.enum(["CONTINUE", "LEAVE"]),
      }),
    )
    .min(1),
});

const bulkSectionBody = z.object({
  fromClassSectionId: z.string().min(1),
  toClassSectionId: z.string().min(1),
  items: z
    .array(
      z.object({
        studentEnrollmentId: z.string().min(1),
        rollNumber: z.string().trim().max(30).nullable().optional(),
      }),
    )
    .min(1),
});

export async function getAcademicSetupController(req: Request, res: Response) {
  const { sessionId } = setupQuery.parse(req.query);
  res.json({ data: await getAcademicSetup(req.auth!.tenantId!, sessionId) });
}

export async function createSessionController(req: Request, res: Response) {
  const data = await createSession(req.auth!.tenantId!, sessionBody.parse(req.body));
  res.status(201).json({ data });
}

export async function setCurrentSessionController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await setCurrentSession(req.auth!.tenantId!, id) });
}

export async function createClassController(req: Request, res: Response) {
  res.status(201).json({
    data: await createClass(req.auth!.tenantId!, classBody.parse(req.body)),
  });
}

export async function updateClassController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await updateClass(req.auth!.tenantId!, id, classBody.partial().parse(req.body)) });
}

export async function createSectionController(req: Request, res: Response) {
  res.status(201).json({
    data: await createSection(req.auth!.tenantId!, sectionBody.parse(req.body)),
  });
}

export async function updateSectionController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await updateSection(req.auth!.tenantId!, id, sectionBody.parse(req.body)) });
}

export async function createSubjectController(req: Request, res: Response) {
  res.status(201).json({
    data: await createSubject(req.auth!.tenantId!, subjectBody.parse(req.body)),
  });
}

export async function updateSubjectController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateSubject(req.auth!.tenantId!, id, subjectBody.partial().parse(req.body)),
  });
}

export async function createClassSectionController(req: Request, res: Response) {
  res.status(201).json({
    data: await createClassSection(req.auth!.tenantId!, classSectionBody.parse(req.body)),
  });
}

export async function updateClassSectionController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateClassSection(req.auth!.tenantId!, id, teacherBody.parse(req.body)),
  });
}

export async function assignSubjectController(req: Request, res: Response) {
  res.status(201).json({
    data: await assignSubject(req.auth!.tenantId!, subjectAssignmentBody.parse(req.body)),
  });
}

export async function deleteAcademicRecordController(req: Request, res: Response) {
  const { resource, id } = deleteParams.parse(req.params);
  await deleteScopedRecord(req.auth!.tenantId!, resource, id);
  res.status(204).send();
}

export async function promoteStudentsController(req: Request, res: Response) {
  const result = await promoteStudents(
    req.auth!.tenantId!,
    req.auth!.userId,
    promotionBody.parse(req.body),
  );
  res.json({ data: result });
}

export async function bulkUpdateStudentSectionsController(req: Request, res: Response) {
  const result = await bulkUpdateStudentSections(req.auth!.tenantId!, bulkSectionBody.parse(req.body));
  res.json({ data: result });
}

export async function createElectiveCategoryController(req: Request, res: Response) {
  res.status(201).json({
    data: await createElectiveCategory(req.auth!.tenantId!, electiveCategoryBody.parse(req.body)),
  });
}

export async function updateElectiveCategoryController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateElectiveCategory(
      req.auth!.tenantId!,
      id,
      electiveCategoryBody.partial().parse(req.body),
    ),
  });
}

export async function deleteElectiveCategoryController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteElectiveCategory(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function getElectiveAssignmentBoardController(req: Request, res: Response) {
  const { classSectionId } = electiveBoardQuery.parse(req.query);
  res.json({
    data: await getElectiveAssignmentBoard(req.auth!.tenantId!, classSectionId),
  });
}

export async function saveStudentElectivesController(req: Request, res: Response) {
  res.json({
    data: await saveStudentElectives(req.auth!.tenantId!, saveElectivesBody.parse(req.body)),
  });
}
