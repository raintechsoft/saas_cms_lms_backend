import { ScholarStatus, ScholarshipType, StudentStatus, SubjectDeliveryType, SubjectType } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  applyAcademicBulkUpdate,
  createClassWithSections,
  createSchoolScholar,
  createSubjectGroup,
  deleteSchoolScholar,
  deleteSubjectGroup,
  getAcademicReportCatalog,
  getPromoteBoard,
  listSchoolScholars,
  listSubjectGroups,
  runAcademicReport,
  updateSchoolScholar,
  updateSubjectGroup,
} from "./academics-extensions.service.js";
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
import {
  createTimetableEntry,
  deleteTimetableEntry,
  getTimetableSetup,
  updateTimetableEntry,
} from "../timetable/timetable.service.js";

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
  academicSessionId: z.string().min(1).optional(),
  sectionIds: z.array(z.string().min(1)).max(50).optional(),
  inTime: z.string().trim().max(10).nullable().optional(),
  halfDayTime: z.string().trim().max(10).nullable().optional(),
  outTime: z.string().trim().max(10).nullable().optional(),
  classTeacherId: z
    .preprocess((value) => (value === "" || value === undefined ? null : value), z.string().min(1).nullable())
    .optional(),
});
const sectionBody = z.object({ name: z.string().trim().min(1).max(100) });
const subjectBody = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(30).nullable().optional(),
  type: z.nativeEnum(SubjectType).default(SubjectType.CORE),
  deliveryType: z.nativeEnum(SubjectDeliveryType).default(SubjectDeliveryType.THEORY),
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
        action: z.enum(["CONTINUE", "LEAVE", "SKIP"]),
      }),
    )
    .min(1),
});

const promoteBoardQuery = z.object({
  fromClassSectionId: z.string().min(1),
  promoteSessionId: z.string().min(1),
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

const subjectGroupBody = z.object({
  classSectionId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).nullable().optional(),
  classSubjectIds: z.array(z.string().min(1)).max(50).optional(),
});

const subjectGroupUpdateBody = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  classSubjectIds: z.array(z.string().min(1)).max(50).optional(),
});

const subjectGroupQuery = z.object({
  classSectionId: z.string().min(1).optional(),
});

const scholarQuery = z.object({
  sessionId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  classSectionId: z.string().min(1).optional(),
  status: z.nativeEnum(ScholarStatus).optional(),
  scholarshipType: z.nativeEnum(ScholarshipType).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const scholarBody = z.object({
  studentId: z.string().min(1),
  academicSessionId: z.string().min(1),
  scholarshipType: z.nativeEnum(ScholarshipType),
  scholarshipName: z.string().trim().min(1).max(150),
  amount: z.number().min(0),
  finalPercent: z.number().min(0).max(100).nullable().optional(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date(),
  status: z.nativeEnum(ScholarStatus).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  feeDiscountId: z
    .preprocess((value) => (value === "" || value === undefined ? null : value), z.string().min(1).nullable())
    .optional(),
});

const scholarUpdateBody = scholarBody
  .omit({ studentId: true, academicSessionId: true })
  .partial();

const STUDENT_DETAIL_FIELDS = [
  "religion",
  "caste",
  "mobile",
  "email",
  "bloodGroup",
  "nationality",
  "currentAddress",
  "permanentAddress",
  "fatherName",
  "fatherPhone",
  "fatherOccupation",
  "motherName",
  "motherPhone",
  "motherOccupation",
  "guardianName",
  "guardianPhone",
  "guardianRelation",
  "transportRoute",
  "hostelRoom",
  "additionalNotes",
] as const;

const bulkUpdateBody = z.object({
  updateType: z.enum([
    "SECTION_MOVE",
    "STATUS",
    "SESSION_CLASS",
    "SUBJECT_ASSIGN",
    "CONCESSION",
    "STUDENT_DETAILS",
  ]),
  summary: z.string().trim().max(500).optional(),
  sectionMove: bulkSectionBody.optional(),
  statusUpdate: z
    .object({
      studentIds: z.array(z.string().min(1)).min(1).max(500),
      status: z.nativeEnum(StudentStatus),
      disabledReason: z.string().trim().max(500).nullable().optional(),
    })
    .optional(),
  sessionClassUpdate: z
    .object({
      academicSessionId: z.string().min(1),
      classSectionId: z.string().min(1),
      studentEnrollmentIds: z.array(z.string().min(1)).min(1).max(500),
    })
    .optional(),
  subjectAssign: z
    .object({
      classSectionId: z.string().min(1),
      subjectId: z.string().min(1),
      teacherId: z
        .preprocess((value) => (value === "" || value === undefined ? null : value), z.string().min(1).nullable())
        .optional(),
      mode: z.enum(["ASSIGN", "UNASSIGN"]).default("ASSIGN"),
    })
    .optional(),
  concessionUpdate: z
    .object({
      studentIds: z.array(z.string().min(1)).min(1).max(500),
      feeDiscountId: z.string().min(1).nullable(),
      academicSessionId: z.string().min(1),
    })
    .optional(),
  studentDetailsUpdate: z
    .object({
      studentIds: z.array(z.string().min(1)).min(1).max(500),
      field: z.enum(STUDENT_DETAIL_FIELDS),
      value: z.string().trim().max(2000).nullable(),
    })
    .optional(),
});

const academicReportQuery = z.object({
  reportKey: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  classSectionId: z.string().min(1).optional(),
  examId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  weekday: z
    .enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"])
    .optional(),
  startTime: z.string().trim().max(10).optional(),
  endTime: z.string().trim().max(10).optional(),
  format: z.enum(["json", "csv"]).default("json"),
});

const timetableSetupQuery = z.object({
  sessionId: z.string().min(1).optional(),
  classSectionId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional(),
});

const timetableEntryBody = z.object({
  academicSessionId: z.string().min(1),
  classSectionId: z.string().min(1),
  classSubjectId: z.string().min(1),
  teacherId: z.string().min(1).nullable().optional(),
  weekday: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().trim().max(50).nullable().optional(),
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
  const body = classBody.parse(req.body);
  if (body.sectionIds?.length && body.academicSessionId) {
    res.status(201).json({
      data: await createClassWithSections(req.auth!.tenantId!, body),
    });
    return;
  }
  res.status(201).json({
    data: await createClass(req.auth!.tenantId!, body),
  });
}

export async function updateClassController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateClass(
      req.auth!.tenantId!,
      id,
      classBody
        .pick({
          name: true,
          code: true,
          sortOrder: true,
          inTime: true,
          halfDayTime: true,
          outTime: true,
        })
        .partial()
        .parse(req.body),
    ),
  });
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

export async function getPromoteBoardController(req: Request, res: Response) {
  const query = promoteBoardQuery.parse(req.query);
  res.json({
    data: await getPromoteBoard(req.auth!.tenantId!, query.fromClassSectionId, query.promoteSessionId),
  });
}

export async function bulkUpdateStudentSectionsController(req: Request, res: Response) {
  const result = await bulkUpdateStudentSections(req.auth!.tenantId!, bulkSectionBody.parse(req.body));
  res.json({ data: result });
}

export async function applyAcademicBulkUpdateController(req: Request, res: Response) {
  const result = await applyAcademicBulkUpdate(
    req.auth!.tenantId!,
    req.auth!.userId,
    bulkUpdateBody.parse(req.body),
  );
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

export async function listSubjectGroupsController(req: Request, res: Response) {
  const { classSectionId } = subjectGroupQuery.parse(req.query);
  res.json({ data: await listSubjectGroups(req.auth!.tenantId!, classSectionId) });
}

export async function createSubjectGroupController(req: Request, res: Response) {
  res.status(201).json({
    data: await createSubjectGroup(req.auth!.tenantId!, subjectGroupBody.parse(req.body)),
  });
}

export async function updateSubjectGroupController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateSubjectGroup(req.auth!.tenantId!, id, subjectGroupUpdateBody.parse(req.body)),
  });
}

export async function deleteSubjectGroupController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteSubjectGroup(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function listSchoolScholarsController(req: Request, res: Response) {
  res.json({ data: await listSchoolScholars(req.auth!.tenantId!, scholarQuery.parse(req.query)) });
}

export async function createSchoolScholarController(req: Request, res: Response) {
  res.status(201).json({
    data: await createSchoolScholar(req.auth!.tenantId!, scholarBody.parse(req.body)),
  });
}

export async function updateSchoolScholarController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateSchoolScholar(req.auth!.tenantId!, id, scholarUpdateBody.parse(req.body)),
  });
}

export async function deleteSchoolScholarController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteSchoolScholar(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function getAcademicReportCatalogController(_req: Request, res: Response) {
  res.json({ data: await getAcademicReportCatalog() });
}

export async function runAcademicReportController(req: Request, res: Response) {
  const query = academicReportQuery.parse(req.query);
  const data = await runAcademicReport(req.auth!.tenantId!, query);
  if (data.format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${data.filename}"`);
    res.send(data.csv);
    return;
  }
  res.json({ data });
}

export async function getAcademicsTimetableSetupController(req: Request, res: Response) {
  res.json({
    data: await getTimetableSetup(
      req.auth!.tenantId!,
      timetableSetupQuery.parse(req.query),
      { userId: req.auth!.userId, roles: req.auth!.roles },
    ),
  });
}

export async function createAcademicsTimetableEntryController(req: Request, res: Response) {
  res.status(201).json({
    data: await createTimetableEntry(req.auth!.tenantId!, timetableEntryBody.parse(req.body)),
  });
}

export async function updateAcademicsTimetableEntryController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateTimetableEntry(req.auth!.tenantId!, id, timetableEntryBody.parse(req.body)),
  });
}

export async function deleteAcademicsTimetableEntryController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteTimetableEntry(req.auth!.tenantId!, id) });
}
