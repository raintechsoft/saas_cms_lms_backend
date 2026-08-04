import {
  DocumentTemplateType,
  EnrollmentStatus,
  ExamStatus,
  PassStatus,
  type ExamResultType,
  type Prisma,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

const examInclude = {
  examGroup: { include: { academicSession: true } },
  schedules: {
    include: {
      classSection: { include: { academicClass: true, section: true } },
      classSubject: { include: { subject: true } },
      components: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
    },
    orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
  },
  aspects: { orderBy: [{ name: "asc" }] },
  _count: { select: { students: true } },
} satisfies Prisma.ExamInclude;

async function requireExam(tenantId: string, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: tenantScope(tenantId, { id: examId }),
    include: examInclude,
  });
  if (!exam) throw new AppError(404, "Exam not found", "EXAM_NOT_FOUND");
  return exam;
}

function validateDateRange(startDate: Date, endDate: Date) {
  if (endDate < startDate) {
    throw new AppError(400, "End date must be on or after start date", "INVALID_DATE_RANGE");
  }
}

function scheduleMaximumMarks(schedule: {
  maximumMarks: { toString(): string } | number;
  components?: Array<{ maximumMarks: { toString(): string } | number }>;
}) {
  const components = schedule.components ?? [];
  if (components.length > 0) {
    return components.reduce((sum, component) => sum + Number(component.maximumMarks), 0);
  }
  return Number(schedule.maximumMarks);
}

function findGradeByPercent<T extends { minPercent: { toString(): string } | number; maxPercent: { toString(): string } | number }>(
  grades: T[],
  percentage: number,
) {
  return grades.find(
    (item) => percentage >= Number(item.minPercent) && percentage <= Number(item.maxPercent),
  );
}

function computeGpa(
  subjects: Array<{ gradePoint: number | null; creditHours: number | null }>,
) {
  let weighted = 0;
  let creditSum = 0;
  const points: number[] = [];
  for (const subject of subjects) {
    if (subject.gradePoint == null) continue;
    points.push(subject.gradePoint);
    const credits = subject.creditHours != null ? Number(subject.creditHours) : 0;
    if (credits > 0) {
      weighted += subject.gradePoint * credits;
      creditSum += credits;
    }
  }
  if (creditSum > 0) return Number((weighted / creditSum).toFixed(2));
  if (points.length > 0) {
    return Number((points.reduce((sum, point) => sum + point, 0) / points.length).toFixed(2));
  }
  return null;
}

type SubjectLinkRow = {
  id: string;
  subjectIds: unknown;
  mergeType: string;
  bifurcationColumns: number;
};

type MarkSubjectRow = {
  name: string;
  subjectIds: string[];
  obtainedMarks: number;
  maximumMarks: number;
  percentage: number;
  isAbsent: boolean;
  creditHours: number | null;
  gradePoint: number | null;
  linked: boolean;
  mergeType?: string;
  bifurcationColumns?: number;
  parts?: Array<{
    name: string;
    subjectId: string;
    obtainedMarks: number;
    maximumMarks: number;
    isAbsent: boolean;
  }>;
};

function buildSubjectRows(
  marks: Array<{
    marksObtained: { toString(): string } | number;
    isAbsent: boolean;
    schedule: {
      maximumMarks: { toString(): string } | number;
      creditHours?: { toString(): string } | number | null;
      components?: Array<{ maximumMarks: { toString(): string } | number }>;
      classSubject: { subject: { id: string; name: string } };
    };
  }>,
  subjectLinks: SubjectLinkRow[],
  grades: Array<{
    minPercent: { toString(): string } | number;
    maxPercent: { toString(): string } | number;
    gradePoint?: { toString(): string } | number | null;
  }>,
  isGpa: boolean,
): MarkSubjectRow[] {
  const markRows = marks.map((mark) => {
    const maximumMarks = scheduleMaximumMarks(mark.schedule);
    const obtainedMarks = Number(mark.marksObtained);
    const percentage = maximumMarks ? (obtainedMarks / maximumMarks) * 100 : 0;
    const grade = findGradeByPercent(grades, percentage);
    const creditHours =
      mark.schedule.creditHours != null && mark.schedule.creditHours !== undefined
        ? Number(mark.schedule.creditHours)
        : null;
    return {
      subjectId: mark.schedule.classSubject.subject.id,
      name: mark.schedule.classSubject.subject.name,
      obtainedMarks,
      maximumMarks,
      percentage,
      isAbsent: mark.isAbsent,
      creditHours,
      gradePoint:
        isGpa && grade?.gradePoint != null
          ? Number(grade.gradePoint)
          : grade?.gradePoint != null
            ? Number(grade.gradePoint)
            : null,
    };
  });

  const used = new Set<string>();
  const subjects: MarkSubjectRow[] = [];

  for (const link of subjectLinks) {
    const linkIds = Array.isArray(link.subjectIds)
      ? (link.subjectIds as string[])
      : [];
    const matched = markRows.filter((row) => linkIds.includes(row.subjectId));
    if (matched.length < 2) continue;
    matched.forEach((row) => used.add(row.subjectId));
    const parts = matched.map((row) => ({
      name: row.name,
      subjectId: row.subjectId,
      obtainedMarks: row.obtainedMarks,
      maximumMarks: row.maximumMarks,
      isAbsent: row.isAbsent,
    }));
    const mergeType = link.mergeType === "AVERAGE" ? "AVERAGE" : "MERGE";
    let obtainedMarks: number;
    let maximumMarks: number;
    if (mergeType === "AVERAGE") {
      obtainedMarks =
        matched.reduce((sum, row) => sum + row.obtainedMarks, 0) / matched.length;
      maximumMarks =
        matched.reduce((sum, row) => sum + row.maximumMarks, 0) / matched.length;
    } else {
      obtainedMarks = matched.reduce((sum, row) => sum + row.obtainedMarks, 0);
      maximumMarks = matched.reduce((sum, row) => sum + row.maximumMarks, 0);
    }
    const percentage = maximumMarks ? (obtainedMarks / maximumMarks) * 100 : 0;
    const grade = findGradeByPercent(grades, percentage);
    const creditHoursValues = matched
      .map((row) => row.creditHours)
      .filter((value): value is number => value != null && value > 0);
    subjects.push({
      name: matched.map((row) => row.name).join(" + "),
      subjectIds: matched.map((row) => row.subjectId),
      obtainedMarks: Number(obtainedMarks.toFixed(2)),
      maximumMarks: Number(maximumMarks.toFixed(2)),
      percentage: Number(percentage.toFixed(2)),
      isAbsent: matched.every((row) => row.isAbsent),
      creditHours:
        creditHoursValues.length > 0
          ? Number(
              (
                creditHoursValues.reduce((sum, value) => sum + value, 0) /
                (mergeType === "AVERAGE" ? creditHoursValues.length : 1)
              ).toFixed(2),
            )
          : null,
      gradePoint: grade?.gradePoint != null ? Number(grade.gradePoint) : null,
      linked: true,
      mergeType,
      bifurcationColumns: link.bifurcationColumns,
      parts,
    });
  }

  for (const row of markRows) {
    if (used.has(row.subjectId)) continue;
    subjects.push({
      name: row.name,
      subjectIds: [row.subjectId],
      obtainedMarks: row.obtainedMarks,
      maximumMarks: row.maximumMarks,
      percentage: Number(row.percentage.toFixed(2)),
      isAbsent: row.isAbsent,
      creditHours: row.creditHours,
      gradePoint: row.gradePoint,
      linked: false,
    });
  }

  return subjects;
}

export async function getExamSetup(tenantId: string) {
  const currentSession = await prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { isCurrent: true }),
  });
  const [sessions, grades, groups, classSections, templates, subjectLinks, links] =
    await Promise.all([
      prisma.academicSession.findMany({
        where: tenantScope(tenantId, {}),
        orderBy: { startDate: "desc" },
      }),
      prisma.examGrade.findMany({
        where: tenantScope(tenantId, {}),
        orderBy: [{ resultType: "asc" }, { minPercent: "desc" }],
      }),
      prisma.examGroup.findMany({
        where: tenantScope(tenantId, {}),
        include: {
          academicSession: true,
          exams: { include: examInclude, orderBy: { startDate: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.classSection.findMany({
        where: tenantScope(
          tenantId,
          currentSession ? { academicSessionId: currentSession.id } : {},
        ),
        include: {
          academicClass: true,
          section: true,
          subjects: { include: { subject: true } },
        },
        orderBy: [{ academicClass: { sortOrder: "asc" } }, { section: { name: "asc" } }],
      }),
      prisma.documentTemplate.findMany({
        where: tenantScope(tenantId, {
          type: {
            in: [DocumentTemplateType.ADMIT_CARD, DocumentTemplateType.MARKSHEET],
          },
        }),
        orderBy: { name: "asc" },
      }),
      prisma.examSubjectLink.findMany({
        where: tenantScope(tenantId, {}),
        orderBy: { updatedAt: "desc" },
      }),
      prisma.examLink.findMany({
        where: tenantScope(tenantId, {}),
        orderBy: { updatedAt: "desc" },
      }),
    ]);
  return {
    currentSession,
    sessions,
    grades,
    groups,
    classSections,
    templates,
    subjectLinks,
    links,
  };
}

export async function createExamGrade(
  tenantId: string,
  input: {
    resultType: ExamResultType;
    name: string;
    minPercent: number;
    maxPercent: number;
    gradePoint?: number | null;
    passStatus: PassStatus;
    description?: string | null;
  },
) {
  if (input.minPercent > input.maxPercent) {
    throw new AppError(400, "Minimum percentage cannot exceed maximum", "INVALID_GRADE_RANGE");
  }
  const overlap = await prisma.examGrade.findFirst({
    where: tenantScope(tenantId, {
      resultType: input.resultType,
      minPercent: { lte: input.maxPercent },
      maxPercent: { gte: input.minPercent },
    }),
  });
  if (overlap) throw new AppError(409, "Grade range overlaps an existing grade", "GRADE_OVERLAP");
  return prisma.examGrade.create({ data: { tenantId, ...input } });
}

export async function createExamGroup(
  tenantId: string,
  input: {
    academicSessionId: string;
    name: string;
    resultType: ExamResultType;
    description?: string | null;
  },
) {
  const session = await prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { id: input.academicSessionId }),
  });
  if (!session) throw new AppError(400, "Academic session is invalid", "INVALID_SESSION");
  return prisma.examGroup.create({ data: { tenantId, ...input } });
}

export async function createExam(
  tenantId: string,
  input: {
    examGroupId: string;
    name: string;
    startDate: Date;
    endDate: Date;
    description?: string | null;
  },
) {
  validateDateRange(input.startDate, input.endDate);
  const group = await prisma.examGroup.findFirst({
    where: tenantScope(tenantId, { id: input.examGroupId }),
    include: { academicSession: true },
  });
  if (!group) throw new AppError(400, "Exam group is invalid", "INVALID_EXAM_GROUP");
  if (
    input.startDate < group.academicSession.startDate ||
    input.endDate > group.academicSession.endDate
  ) {
    throw new AppError(400, "Exam dates must be within the academic session", "DATE_OUTSIDE_SESSION");
  }
  return prisma.exam.create({ data: { tenantId, ...input } });
}

export async function createExamSchedule(
  tenantId: string,
  examId: string,
  input: {
    classSectionId: string;
    classSubjectId: string;
    examDate: Date;
    startTime: string;
    endTime: string;
    room?: string | null;
    maximumMarks: number;
    minimumMarks: number;
    creditHours?: number | null;
  },
) {
  const exam = await requireExam(tenantId, examId);
  if (exam.status === ExamStatus.PUBLISHED) {
    throw new AppError(409, "Published exam cannot be changed", "EXAM_PUBLISHED");
  }
  if (input.examDate < exam.startDate || input.examDate > exam.endDate) {
    throw new AppError(400, "Schedule date must be within exam dates", "INVALID_SCHEDULE_DATE");
  }
  if (input.minimumMarks > input.maximumMarks) {
    throw new AppError(400, "Minimum marks cannot exceed maximum marks", "INVALID_MARKS_RANGE");
  }
  const classSubject = await prisma.classSubject.findFirst({
    where: tenantScope(tenantId, {
      id: input.classSubjectId,
      classSectionId: input.classSectionId,
    }),
    include: { classSection: true },
  });
  if (!classSubject) {
    throw new AppError(400, "Subject is not linked to this class section", "INVALID_CLASS_SUBJECT");
  }
  if (classSubject.classSection.academicSessionId !== exam.examGroup.academicSessionId) {
    throw new AppError(
      400,
      "Class section and exam must use the same academic session",
      "SESSION_MISMATCH",
    );
  }
  return prisma.examSchedule.create({
    data: { tenantId, examId, ...input },
    include: {
      classSection: { include: { academicClass: true, section: true } },
      classSubject: { include: { subject: true } },
    },
  });
}

export async function addMarkComponent(
  tenantId: string,
  scheduleId: string,
  input: { name: string; maximumMarks: number },
) {
  const schedule = await prisma.examSchedule.findFirst({
    where: tenantScope(tenantId, { id: scheduleId }),
    include: { exam: true, components: true },
  });
  if (!schedule) throw new AppError(404, "Exam schedule not found", "SCHEDULE_NOT_FOUND");
  if (schedule.exam.status === ExamStatus.PUBLISHED) {
    throw new AppError(409, "Published exam cannot be changed", "EXAM_PUBLISHED");
  }
  const total = schedule.components.reduce(
    (sum, component) => sum + Number(component.maximumMarks),
    input.maximumMarks,
  );
  const created = await prisma.examMarkComponent.create({
    data: {
      tenantId,
      scheduleId,
      name: input.name,
      maximumMarks: input.maximumMarks,
      sortOrder: schedule.components.length + 1,
    },
  });
  if (total > Number(schedule.maximumMarks)) {
    await prisma.examSchedule.update({
      where: { id: scheduleId },
      data: { maximumMarks: total },
    });
  }
  return created;
}

export async function updateMarkComponent(
  tenantId: string,
  componentId: string,
  input: { name?: string; maximumMarks?: number; sortOrder?: number },
) {
  const component = await prisma.examMarkComponent.findFirst({
    where: tenantScope(tenantId, { id: componentId }),
    include: { schedule: { include: { exam: true, components: true } } },
  });
  if (!component) throw new AppError(404, "Mark field not found", "COMPONENT_NOT_FOUND");
  if (component.schedule.exam.status === ExamStatus.PUBLISHED) {
    throw new AppError(409, "Published exam cannot be changed", "EXAM_PUBLISHED");
  }
  if (input.maximumMarks !== undefined) {
    const others = component.schedule.components
      .filter((item) => item.id !== componentId)
      .reduce((sum, item) => sum + Number(item.maximumMarks), 0);
    const nextTotal = others + input.maximumMarks;
    if (nextTotal > Number(component.schedule.maximumMarks)) {
      await prisma.examSchedule.update({
        where: { id: component.scheduleId },
        data: { maximumMarks: nextTotal },
      });
    }
  }
  return prisma.examMarkComponent.update({
    where: { id: componentId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.maximumMarks !== undefined ? { maximumMarks: input.maximumMarks } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
}

export async function deleteMarkComponent(tenantId: string, componentId: string) {
  const component = await prisma.examMarkComponent.findFirst({
    where: tenantScope(tenantId, { id: componentId }),
    include: { schedule: { include: { exam: true } } },
  });
  if (!component) throw new AppError(404, "Mark field not found", "COMPONENT_NOT_FOUND");
  if (component.schedule.exam.status === ExamStatus.PUBLISHED) {
    throw new AppError(409, "Published exam cannot be changed", "EXAM_PUBLISHED");
  }
  await prisma.examMarkComponent.delete({ where: { id: componentId } });
}

export async function reorderMarkComponents(
  tenantId: string,
  scheduleId: string,
  orderedIds: string[],
) {
  const schedule = await prisma.examSchedule.findFirst({
    where: tenantScope(tenantId, { id: scheduleId }),
    include: { exam: true, components: true },
  });
  if (!schedule) throw new AppError(404, "Exam schedule not found", "SCHEDULE_NOT_FOUND");
  if (schedule.exam.status === ExamStatus.PUBLISHED) {
    throw new AppError(409, "Published exam cannot be changed", "EXAM_PUBLISHED");
  }
  const existing = new Set(schedule.components.map((item) => item.id));
  if (orderedIds.length !== existing.size || orderedIds.some((id) => !existing.has(id))) {
    throw new AppError(400, "Component order is invalid", "INVALID_COMPONENT_ORDER");
  }
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.examMarkComponent.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    ),
  );
  return prisma.examMarkComponent.findMany({
    where: tenantScope(tenantId, { scheduleId }),
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function assignExamStudents(
  tenantId: string,
  examId: string,
  input: { classSectionId: string; enrollmentIds?: string[] },
) {
  const exam = await requireExam(tenantId, examId);
  if (exam.status === ExamStatus.PUBLISHED) {
    throw new AppError(409, "Published exam cannot be changed", "EXAM_PUBLISHED");
  }
  const hasSchedule = exam.schedules.some(
    (schedule) => schedule.classSectionId === input.classSectionId,
  );
  if (!hasSchedule) {
    throw new AppError(400, "Create a schedule for this class first", "SCHEDULE_REQUIRED");
  }
  const enrollments = await prisma.studentEnrollment.findMany({
    where: tenantScope(tenantId, {
      classSectionId: input.classSectionId,
      academicSessionId: exam.examGroup.academicSessionId,
      status: EnrollmentStatus.ACTIVE,
      ...(input.enrollmentIds?.length ? { id: { in: input.enrollmentIds } } : {}),
    }),
    select: { id: true, rollNumber: true },
  });
  if (input.enrollmentIds?.length && enrollments.length !== new Set(input.enrollmentIds).size) {
    throw new AppError(400, "One or more enrolments are invalid", "INVALID_ENROLLMENT");
  }
  await prisma.examStudent.createMany({
    data: enrollments.map((enrollment) => ({
      tenantId,
      examId,
      studentEnrollmentId: enrollment.id,
      rollNumber: enrollment.rollNumber,
    })),
    skipDuplicates: true,
  });
  return prisma.examStudent.findMany({
    where: tenantScope(tenantId, { examId }),
    include: { studentEnrollment: { include: { student: true, classSection: true } } },
    orderBy: [{ rollNumber: "asc" }],
  });
}

export async function listExamStudents(
  tenantId: string,
  examId: string,
  classSectionId?: string,
) {
  await requireExam(tenantId, examId);
  return prisma.examStudent.findMany({
    where: tenantScope(tenantId, {
      examId,
      ...(classSectionId
        ? { studentEnrollment: { classSectionId } }
        : {}),
    }),
    include: {
      studentEnrollment: {
        include: {
          student: true,
          classSection: { include: { academicClass: true, section: true } },
        },
      },
    },
    orderBy: [{ rollNumber: "asc" }],
  });
}

export async function saveExamMarks(
  tenantId: string,
  scheduleId: string,
  entries: Array<{
    examStudentId: string;
    marksObtained: number;
    isAbsent?: boolean;
    remarks?: string | null;
    componentScores?: Array<{ componentId: string; marks: number }>;
  }>,
) {
  const schedule = await prisma.examSchedule.findFirst({
    where: tenantScope(tenantId, { id: scheduleId }),
    include: { exam: true, components: true },
  });
  if (!schedule) throw new AppError(404, "Exam schedule not found", "SCHEDULE_NOT_FOUND");
  if (schedule.exam.status === ExamStatus.PUBLISHED) {
    throw new AppError(409, "Published exam marks cannot be changed", "EXAM_PUBLISHED");
  }
  const studentIds = [...new Set(entries.map((entry) => entry.examStudentId))];
  if (studentIds.length !== entries.length) {
    throw new AppError(400, "Duplicate student mark entry", "DUPLICATE_MARK_ENTRY");
  }
  const students = await prisma.examStudent.findMany({
    where: tenantScope(tenantId, { id: { in: studentIds }, examId: schedule.examId }),
    include: { studentEnrollment: true },
  });
  if (
    students.length !== entries.length ||
    students.some(
      (student) => student.studentEnrollment.classSectionId !== schedule.classSectionId,
    )
  ) {
    throw new AppError(400, "One or more exam students are invalid", "INVALID_EXAM_STUDENT");
  }
  const componentById = new Map(
    schedule.components.map((component) => [component.id, Number(component.maximumMarks)]),
  );
  for (const entry of entries) {
    if (!entry.isAbsent && entry.marksObtained > Number(schedule.maximumMarks)) {
      throw new AppError(400, "Marks cannot exceed maximum marks", "MARKS_EXCEEDED");
    }
    for (const score of entry.componentScores ?? []) {
      const maximum = componentById.get(score.componentId);
      if (maximum === undefined || score.marks > maximum) {
        throw new AppError(400, "A component score is invalid", "INVALID_COMPONENT_SCORE");
      }
    }
  }
  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      const mark = await tx.examMark.upsert({
        where: {
          tenantId_scheduleId_examStudentId: {
            tenantId,
            scheduleId,
            examStudentId: entry.examStudentId,
          },
        },
        create: {
          tenantId,
          scheduleId,
          examStudentId: entry.examStudentId,
          marksObtained: entry.isAbsent ? 0 : entry.marksObtained,
          isAbsent: entry.isAbsent ?? false,
          remarks: entry.remarks,
        },
        update: {
          marksObtained: entry.isAbsent ? 0 : entry.marksObtained,
          isAbsent: entry.isAbsent ?? false,
          remarks: entry.remarks,
        },
      });
      for (const score of entry.componentScores ?? []) {
        await tx.examMarkComponentScore.upsert({
          where: {
            tenantId_examMarkId_componentId: {
              tenantId,
              examMarkId: mark.id,
              componentId: score.componentId,
            },
          },
          create: {
            tenantId,
            examMarkId: mark.id,
            componentId: score.componentId,
            marks: score.marks,
          },
          update: { marks: score.marks },
        });
      }
    }
  });
  return getScheduleRoster(tenantId, scheduleId);
}

export async function getScheduleRoster(tenantId: string, scheduleId: string) {
  const schedule = await prisma.examSchedule.findFirst({
    where: tenantScope(tenantId, { id: scheduleId }),
  });
  if (!schedule) throw new AppError(404, "Exam schedule not found", "SCHEDULE_NOT_FOUND");
  return prisma.examStudent.findMany({
    where: tenantScope(tenantId, {
      examId: schedule.examId,
      studentEnrollment: { classSectionId: schedule.classSectionId },
    }),
    include: {
      studentEnrollment: { include: { student: true } },
      marks: {
        where: { scheduleId },
        include: { componentScores: { include: { component: true } } },
      },
      aspectValues: true,
    },
    orderBy: [{ rollNumber: "asc" }],
  });
}

export async function createExamAspect(
  tenantId: string,
  examId: string,
  input: { name: string; maximumValue: number; fieldType?: string },
) {
  const exam = await requireExam(tenantId, examId);
  if (exam.status === ExamStatus.PUBLISHED) {
    throw new AppError(409, "Published exam cannot be changed", "EXAM_PUBLISHED");
  }
  const fieldType = (input.fieldType ?? "BEHAVIOR").toUpperCase();
  if (!["BEHAVIOR", "SKILL", "COMMENT"].includes(fieldType)) {
    throw new AppError(400, "Invalid aspect field type", "INVALID_ASPECT_FIELD_TYPE");
  }
  const maximumValue = fieldType === "COMMENT" ? 1 : input.maximumValue;
  return prisma.examAspectField.create({
    data: {
      tenantId,
      examId,
      name: input.name,
      fieldType,
      maximumValue,
    },
  });
}

export async function updateExamAspect(
  tenantId: string,
  aspectId: string,
  input: { name?: string; maximumValue?: number; fieldType?: string },
) {
  const field = await prisma.examAspectField.findFirst({
    where: tenantScope(tenantId, { id: aspectId }),
    include: { exam: true },
  });
  if (!field) throw new AppError(404, "Aspect field not found", "ASPECT_NOT_FOUND");
  if (field.exam.status === ExamStatus.PUBLISHED) {
    throw new AppError(409, "Published exam cannot be changed", "EXAM_PUBLISHED");
  }
  const fieldType = input.fieldType ? input.fieldType.toUpperCase() : undefined;
  if (fieldType && !["BEHAVIOR", "SKILL", "COMMENT"].includes(fieldType)) {
    throw new AppError(400, "Invalid aspect field type", "INVALID_ASPECT_FIELD_TYPE");
  }
  return prisma.examAspectField.update({
    where: { id: aspectId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(fieldType ? { fieldType } : {}),
      ...(input.maximumValue !== undefined
        ? { maximumValue: fieldType === "COMMENT" || field.fieldType === "COMMENT" ? 1 : input.maximumValue }
        : fieldType === "COMMENT"
          ? { maximumValue: 1 }
          : {}),
    },
  });
}

export async function deleteExamAspect(tenantId: string, aspectId: string) {
  const field = await prisma.examAspectField.findFirst({
    where: tenantScope(tenantId, { id: aspectId }),
    include: { exam: true },
  });
  if (!field) throw new AppError(404, "Aspect field not found", "ASPECT_NOT_FOUND");
  if (field.exam.status === ExamStatus.PUBLISHED) {
    throw new AppError(409, "Published exam cannot be changed", "EXAM_PUBLISHED");
  }
  await prisma.examAspectField.delete({ where: { id: aspectId } });
}

export async function listExamSubjectLinks(tenantId: string) {
  return prisma.examSubjectLink.findMany({
    where: tenantScope(tenantId, {}),
    orderBy: { updatedAt: "desc" },
  });
}

export async function saveExamSubjectLink(
  tenantId: string,
  input: {
    id?: string;
    subjectIds: string[];
    mergeType: "MERGE" | "AVERAGE";
    bifurcationColumns: number;
  },
) {
  if (input.subjectIds.length < 2) {
    throw new AppError(400, "Select at least two subjects to link", "SUBJECT_LINK_TOO_FEW");
  }
  if (input.id) {
    const existing = await prisma.examSubjectLink.findFirst({
      where: tenantScope(tenantId, { id: input.id }),
    });
    if (!existing) throw new AppError(404, "Subject link not found", "SUBJECT_LINK_NOT_FOUND");
    return prisma.examSubjectLink.update({
      where: { id: input.id },
      data: {
        subjectIds: input.subjectIds,
        mergeType: input.mergeType,
        bifurcationColumns: input.bifurcationColumns,
      },
    });
  }
  return prisma.examSubjectLink.create({
    data: {
      tenantId,
      subjectIds: input.subjectIds,
      mergeType: input.mergeType,
      bifurcationColumns: input.bifurcationColumns,
    },
  });
}

export async function deleteExamSubjectLink(tenantId: string, id: string) {
  const existing = await prisma.examSubjectLink.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!existing) throw new AppError(404, "Subject link not found", "SUBJECT_LINK_NOT_FOUND");
  await prisma.examSubjectLink.delete({ where: { id } });
}

export async function saveAspectValues(
  tenantId: string,
  aspectFieldId: string,
  entries: Array<{ examStudentId: string; value: number; remarks?: string | null }>,
) {
  const field = await prisma.examAspectField.findFirst({
    where: tenantScope(tenantId, { id: aspectFieldId }),
    include: { exam: true },
  });
  if (!field) throw new AppError(404, "Aspect field not found", "ASPECT_NOT_FOUND");
  if (field.exam.status === ExamStatus.PUBLISHED) {
    throw new AppError(409, "Published exam cannot be changed", "EXAM_PUBLISHED");
  }
  if (entries.some(({ value }) => value > Number(field.maximumValue))) {
    throw new AppError(400, "Aspect value exceeds maximum", "ASPECT_VALUE_EXCEEDED");
  }
  const studentIds = [...new Set(entries.map(({ examStudentId }) => examStudentId))];
  if (studentIds.length !== entries.length) {
    throw new AppError(400, "Duplicate student aspect entry", "DUPLICATE_ASPECT_ENTRY");
  }
  const validStudents = await prisma.examStudent.count({
    where: tenantScope(tenantId, {
      id: { in: studentIds },
      examId: field.examId,
    }),
  });
  if (validStudents !== studentIds.length) {
    throw new AppError(400, "One or more exam students are invalid", "INVALID_EXAM_STUDENT");
  }
  await prisma.$transaction(
    entries.map((entry) =>
      prisma.examAspectValue.upsert({
        where: {
          tenantId_aspectFieldId_examStudentId: {
            tenantId,
            aspectFieldId,
            examStudentId: entry.examStudentId,
          },
        },
        create: { tenantId, aspectFieldId, ...entry },
        update: { value: entry.value, remarks: entry.remarks },
      }),
    ),
  );
  return prisma.examAspectValue.findMany({
    where: tenantScope(tenantId, { aspectFieldId }),
  });
}

export async function publishExam(tenantId: string, examId: string) {
  const exam = await requireExam(tenantId, examId);
  if (!exam.schedules.length || !exam._count.students) {
    throw new AppError(400, "Schedules and assigned students are required", "EXAM_INCOMPLETE");
  }
  const students = await prisma.examStudent.findMany({
    where: tenantScope(tenantId, { examId }),
    include: { studentEnrollment: true },
  });
  const expected = exam.schedules.reduce(
    (count, schedule) =>
      count +
      students.filter(
        (student) => student.studentEnrollment.classSectionId === schedule.classSectionId,
      ).length,
    0,
  );
  const marks = await prisma.examMark.count({
    where: tenantScope(tenantId, { schedule: { examId } }),
  });
  if (marks !== expected) {
    throw new AppError(400, `Marks are incomplete (${marks}/${expected})`, "MARKS_INCOMPLETE");
  }
  return prisma.exam.update({
    where: { id: examId },
    data: { status: ExamStatus.PUBLISHED, publishedAt: new Date() },
  });
}

export async function unpublishExam(tenantId: string, examId: string) {
  const exam = await requireExam(tenantId, examId);
  if (exam.status === ExamStatus.DRAFT) return exam;
  if ((exam.status as string) === "ARCHIVED") {
    throw new AppError(400, "Archived exams cannot be unpublished", "EXAM_ARCHIVED");
  }
  return prisma.exam.update({
    where: { id: examId },
    data: { status: ExamStatus.DRAFT, publishedAt: null },
  });
}

export async function getExamResults(tenantId: string, examId: string) {
  const exam = await requireExam(tenantId, examId);
  const isGpa = exam.examGroup.resultType === "GPA";
  const [students, grades, subjectLinks] = await Promise.all([
    prisma.examStudent.findMany({
      where: tenantScope(tenantId, { examId }),
      include: {
        studentEnrollment: {
          include: {
            student: true,
            classSection: { include: { academicClass: true, section: true } },
          },
        },
        marks: {
          include: {
            schedule: {
              include: {
                classSubject: { include: { subject: true } },
                components: true,
              },
            },
          },
        },
        aspectValues: { include: { aspectField: true } },
      },
    }),
    prisma.examGrade.findMany({
      where: tenantScope(tenantId, { resultType: exam.examGroup.resultType }),
      orderBy: { minPercent: "desc" },
    }),
    prisma.examSubjectLink.findMany({
      where: tenantScope(tenantId, {}),
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const results = students.map((student) => {
    const maximumMarks = student.marks.reduce(
      (sum, mark) => sum + scheduleMaximumMarks(mark.schedule),
      0,
    );
    const obtainedMarks = student.marks.reduce(
      (sum, mark) => sum + Number(mark.marksObtained),
      0,
    );
    const percentage = maximumMarks ? (obtainedMarks / maximumMarks) * 100 : 0;
    const grade = findGradeByPercent(grades, percentage);
    const subjectFailed = student.marks.some(
      (mark) => mark.isAbsent || Number(mark.marksObtained) < Number(mark.schedule.minimumMarks),
    );
    const subjects = buildSubjectRows(student.marks, subjectLinks, grades, isGpa);
    const gpa = isGpa
      ? computeGpa(
          subjects.map((subject) => ({
            gradePoint: subject.gradePoint,
            creditHours: subject.creditHours,
          })),
        )
      : null;
    return {
      examStudentId: student.id,
      student: student.studentEnrollment.student,
      classSection: student.studentEnrollment.classSection,
      rollNumber: student.rollNumber,
      showOnPortal: student.showOnPortal,
      marks: student.marks,
      subjects,
      aspects: student.aspectValues,
      maximumMarks,
      obtainedMarks,
      percentage: Number(percentage.toFixed(2)),
      grade: grade?.name ?? null,
      gradePoint: grade?.gradePoint ? Number(grade.gradePoint) : null,
      gpa,
      passStatus:
        subjectFailed || grade?.passStatus === PassStatus.FAIL ? PassStatus.FAIL : PassStatus.PASS,
    };
  });
  const sortKey = isGpa ? "gpa" : "obtainedMarks";
  results.sort((a, b) => {
    if (sortKey === "gpa") {
      return (b.gpa ?? 0) - (a.gpa ?? 0);
    }
    return b.obtainedMarks - a.obtainedMarks;
  });
  let lastScore: number | null = null;
  let rank = 0;
  return {
    exam,
    published: exam.status === ExamStatus.PUBLISHED,
    results: results.map((result, index) => {
      const score = isGpa ? (result.gpa ?? 0) : result.obtainedMarks;
      if (score !== lastScore) rank = index + 1;
      lastScore = score;
      return { ...result, rank };
    }),
  };
}

function mergeExamReports(
  examResults: Awaited<ReturnType<typeof getExamResults>>[],
  grades: Array<{
    name: string;
    minPercent: { toString(): string } | number;
    maxPercent: { toString(): string } | number;
    gradePoint?: { toString(): string } | number | null;
    passStatus: PassStatus;
  }>,
  resultType: ExamResultType,
) {
  const isGpa = resultType === "GPA";
  const combined = new Map<
    string,
    {
      student: (typeof examResults)[number]["results"][number]["student"];
      classSection: (typeof examResults)[number]["results"][number]["classSection"];
      rollNumber: string | null;
      showOnPortal: boolean;
      maximumMarks: number;
      obtainedMarks: number;
      failed: boolean;
      gpaParts: Array<{ gpa: number | null; creditHours: number }>;
      subjects: MarkSubjectRow[];
      exams: Array<{
        examId: string;
        examName: string;
        maximumMarks: number;
        obtainedMarks: number;
        percentage: number;
        gpa: number | null;
        passStatus: PassStatus;
      }>;
    }
  >();
  for (const report of examResults) {
    for (const result of report.results) {
      const current = combined.get(result.student.id) ?? {
        student: result.student,
        classSection: result.classSection,
        rollNumber: result.rollNumber,
        showOnPortal: result.showOnPortal,
        maximumMarks: 0,
        obtainedMarks: 0,
        failed: false,
        gpaParts: [] as Array<{ gpa: number | null; creditHours: number }>,
        subjects: [] as MarkSubjectRow[],
        exams: [] as Array<{
          examId: string;
          examName: string;
          maximumMarks: number;
          obtainedMarks: number;
          percentage: number;
          gpa: number | null;
          passStatus: PassStatus;
        }>,
      };
      current.maximumMarks += result.maximumMarks;
      current.obtainedMarks += result.obtainedMarks;
      current.failed ||= result.passStatus === PassStatus.FAIL;
      current.showOnPortal &&= result.showOnPortal;
      const creditHours = result.subjects.reduce(
        (sum, subject) => sum + (subject.creditHours && subject.creditHours > 0 ? subject.creditHours : 0),
        0,
      );
      current.gpaParts.push({ gpa: result.gpa, creditHours });
      current.subjects.push(...result.subjects);
      current.exams.push({
        examId: report.exam.id,
        examName: report.exam.name,
        maximumMarks: result.maximumMarks,
        obtainedMarks: result.obtainedMarks,
        percentage: result.percentage,
        gpa: result.gpa,
        passStatus: result.passStatus,
      });
      combined.set(result.student.id, current);
    }
  }
  const results = [...combined.values()].map((result) => {
    const percentage = result.maximumMarks
      ? (result.obtainedMarks / result.maximumMarks) * 100
      : 0;
    const grade = findGradeByPercent(grades, percentage);
    let gpa: number | null = null;
    if (isGpa) {
      const fromSubjects = computeGpa(
        result.subjects.map((subject) => ({
          gradePoint: subject.gradePoint,
          creditHours: subject.creditHours,
        })),
      );
      if (fromSubjects != null) {
        gpa = fromSubjects;
      } else {
        let weighted = 0;
        let creditSum = 0;
        const plain: number[] = [];
        for (const part of result.gpaParts) {
          if (part.gpa == null) continue;
          plain.push(part.gpa);
          if (part.creditHours > 0) {
            weighted += part.gpa * part.creditHours;
            creditSum += part.creditHours;
          }
        }
        if (creditSum > 0) gpa = Number((weighted / creditSum).toFixed(2));
        else if (plain.length > 0) {
          gpa = Number((plain.reduce((sum, value) => sum + value, 0) / plain.length).toFixed(2));
        }
      }
    }
    return {
      student: result.student,
      classSection: result.classSection,
      rollNumber: result.rollNumber,
      showOnPortal: result.showOnPortal,
      maximumMarks: result.maximumMarks,
      obtainedMarks: result.obtainedMarks,
      subjects: result.subjects,
      exams: result.exams,
      examStudentId: result.student.id,
      percentage: Number(percentage.toFixed(2)),
      grade: grade?.name ?? null,
      gradePoint: grade?.gradePoint ? Number(grade.gradePoint) : null,
      gpa,
      passStatus:
        result.failed || grade?.passStatus === PassStatus.FAIL
          ? PassStatus.FAIL
          : PassStatus.PASS,
    };
  });
  results.sort((a, b) => {
    if (isGpa) return (b.gpa ?? 0) - (a.gpa ?? 0);
    return b.obtainedMarks - a.obtainedMarks;
  });
  let rank = 0;
  let lastScore: number | null = null;
  return results.map((result, index) => {
    const score = isGpa ? (result.gpa ?? 0) : result.obtainedMarks;
    if (score !== lastScore) rank = index + 1;
    lastScore = score;
    return { ...result, rank };
  });
}

export async function getExamGroupResults(tenantId: string, groupId: string) {
  const group = await prisma.examGroup.findFirst({
    where: tenantScope(tenantId, { id: groupId }),
    include: {
      academicSession: true,
      exams: { orderBy: { startDate: "asc" } },
    },
  });
  if (!group) throw new AppError(404, "Exam group not found", "EXAM_GROUP_NOT_FOUND");
  const [examResults, grades] = await Promise.all([
    Promise.all(group.exams.map((exam) => getExamResults(tenantId, exam.id))),
    prisma.examGrade.findMany({
      where: tenantScope(tenantId, { resultType: group.resultType }),
      orderBy: { minPercent: "desc" },
    }),
  ]);
  return {
    group,
    published:
      group.exams.length > 0 &&
      group.exams.every((exam) => exam.status === ExamStatus.PUBLISHED),
    results: mergeExamReports(examResults, grades, group.resultType),
  };
}

export async function listExamLinks(tenantId: string) {
  return prisma.examLink.findMany({
    where: tenantScope(tenantId, {}),
    orderBy: { updatedAt: "desc" },
  });
}

export async function createExamLink(
  tenantId: string,
  input: { name: string; resultType: ExamResultType; examIds: string[] },
) {
  if (input.examIds.length < 2) {
    throw new AppError(400, "Select at least two exams to link", "EXAM_LINK_TOO_FEW");
  }
  const uniqueIds = [...new Set(input.examIds)];
  if (uniqueIds.length !== input.examIds.length) {
    throw new AppError(400, "Exam link cannot contain duplicate exams", "EXAM_LINK_DUPLICATE");
  }
  const exams = await prisma.exam.findMany({
    where: tenantScope(tenantId, { id: { in: input.examIds } }),
    include: { examGroup: { include: { academicSession: true } } },
  });
  if (exams.length !== input.examIds.length) {
    throw new AppError(400, "One or more exams were not found", "EXAM_LINK_INVALID");
  }
  const ordered = input.examIds.map((id) => {
    const exam = exams.find((item) => item.id === id);
    if (!exam) throw new AppError(400, "One or more exams were not found", "EXAM_LINK_INVALID");
    return exam;
  });
  if (input.resultType === "SCHOOL_GRADING") {
    const sessionIds = new Set(ordered.map((exam) => exam.examGroup.academicSessionId));
    if (sessionIds.size > 1) {
      throw new AppError(
        400,
        "School grading links require exams in the same academic session",
        "EXAM_LINK_SESSION_MISMATCH",
      );
    }
  }
  const finalExamId = input.examIds[input.examIds.length - 1]!;
  return prisma.examLink.create({
    data: {
      tenantId,
      name: input.name,
      resultType: input.resultType,
      finalExamId,
      examIds: input.examIds,
    },
  });
}

export async function deleteExamLink(tenantId: string, id: string) {
  const existing = await prisma.examLink.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!existing) throw new AppError(404, "Exam link not found", "EXAM_LINK_NOT_FOUND");
  await prisma.examLink.delete({ where: { id } });
}

export async function getExamLinkResults(tenantId: string, linkId: string) {
  const link = await prisma.examLink.findFirst({
    where: tenantScope(tenantId, { id: linkId }),
  });
  if (!link) throw new AppError(404, "Exam link not found", "EXAM_LINK_NOT_FOUND");
  const examIds = Array.isArray(link.examIds) ? (link.examIds as string[]) : [];
  if (examIds.length === 0) {
    throw new AppError(400, "Exam link has no exams", "EXAM_LINK_EMPTY");
  }
  const [examResults, grades] = await Promise.all([
    Promise.all(examIds.map((examId) => getExamResults(tenantId, examId))),
    prisma.examGrade.findMany({
      where: tenantScope(tenantId, { resultType: link.resultType }),
      orderBy: { minPercent: "desc" },
    }),
  ]);
  const ordered = examIds
    .map((examId) => examResults.find((report) => report.exam.id === examId))
    .filter((report): report is NonNullable<typeof report> => Boolean(report));
  return {
    link,
    published: ordered.every((report) => report.published),
    results: mergeExamReports(ordered, grades, link.resultType),
  };
}

export async function updateExamStudentPortalVisibility(
  tenantId: string,
  examStudentId: string,
  showOnPortal: boolean,
) {
  const existing = await prisma.examStudent.findFirst({
    where: tenantScope(tenantId, { id: examStudentId }),
  });
  if (!existing) throw new AppError(404, "Exam student not found", "EXAM_STUDENT_NOT_FOUND");
  return prisma.examStudent.update({
    where: { id: examStudentId },
    data: { showOnPortal },
  });
}

export async function updateExamGrade(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    minPercent?: number;
    maxPercent?: number;
    gradePoint?: number | null;
    passStatus?: PassStatus;
    description?: string | null;
  },
) {
  const existing = await prisma.examGrade.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!existing) throw new AppError(404, "Grade not found", "GRADE_NOT_FOUND");
  const minPercent = input.minPercent ?? Number(existing.minPercent);
  const maxPercent = input.maxPercent ?? Number(existing.maxPercent);
  if (minPercent > maxPercent) {
    throw new AppError(400, "Minimum percentage cannot exceed maximum", "INVALID_GRADE_RANGE");
  }
  const overlap = await prisma.examGrade.findFirst({
    where: tenantScope(tenantId, {
      id: { not: id },
      resultType: existing.resultType,
      minPercent: { lte: maxPercent },
      maxPercent: { gte: minPercent },
    }),
  });
  if (overlap) throw new AppError(409, "Grade range overlaps an existing grade", "GRADE_OVERLAP");
  return prisma.examGrade.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.minPercent !== undefined ? { minPercent: input.minPercent } : {}),
      ...(input.maxPercent !== undefined ? { maxPercent: input.maxPercent } : {}),
      ...(input.gradePoint !== undefined ? { gradePoint: input.gradePoint } : {}),
      ...(input.passStatus !== undefined ? { passStatus: input.passStatus } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
  });
}

export async function deleteExamGrade(tenantId: string, id: string) {
  const result = await prisma.examGrade.deleteMany({ where: tenantScope(tenantId, { id }) });
  if (!result.count) throw new AppError(404, "Grade not found", "GRADE_NOT_FOUND");
}

export async function updateExamGroup(
  tenantId: string,
  id: string,
  input: { name?: string; description?: string | null; resultType?: ExamResultType },
) {
  const existing = await prisma.examGroup.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!existing) throw new AppError(404, "Exam group not found", "EXAM_GROUP_NOT_FOUND");
  return prisma.examGroup.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.resultType !== undefined ? { resultType: input.resultType } : {}),
    },
  });
}

export async function deleteExamGroup(tenantId: string, id: string) {
  const group = await prisma.examGroup.findFirst({
    where: tenantScope(tenantId, { id }),
    include: { _count: { select: { exams: true } } },
  });
  if (!group) throw new AppError(404, "Exam group not found", "EXAM_GROUP_NOT_FOUND");
  if (group._count.exams > 0) {
    throw new AppError(409, "Remove or archive exams in this group first", "EXAM_GROUP_IN_USE");
  }
  await prisma.examGroup.delete({ where: { id } });
}

export async function updateExam(
  tenantId: string,
  id: string,
  input: { name?: string; startDate?: Date; endDate?: Date; description?: string | null },
) {
  const exam = await requireExam(tenantId, id);
  if ((exam.status as string) === "ARCHIVED") {
    throw new AppError(400, "Archived exams cannot be edited", "EXAM_ARCHIVED");
  }
  const startDate = input.startDate ?? exam.startDate;
  const endDate = input.endDate ?? exam.endDate;
  validateDateRange(startDate, endDate);
  return prisma.exam.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
    include: examInclude,
  });
}

export async function archiveExam(tenantId: string, id: string) {
  const exam = await requireExam(tenantId, id);
  if ((exam.status as string) === "ARCHIVED") return exam;
  return prisma.exam.update({
    where: { id },
    data: { status: "ARCHIVED" as ExamStatus },
    include: examInclude,
  });
}

export async function deleteExam(tenantId: string, id: string) {
  const exam = await requireExam(tenantId, id);
  if (exam.status === ExamStatus.PUBLISHED) {
    throw new AppError(409, "Archive published exams instead of deleting", "EXAM_PUBLISHED");
  }
  await prisma.exam.delete({ where: { id } });
}

export async function updateExamSchedule(
  tenantId: string,
  scheduleId: string,
  input: {
    examDate?: Date;
    startTime?: string;
    endTime?: string;
    room?: string | null;
    maximumMarks?: number;
    minimumMarks?: number;
    creditHours?: number | null;
  },
) {
  const schedule = await prisma.examSchedule.findFirst({
    where: tenantScope(tenantId, { id: scheduleId }),
    include: { exam: true },
  });
  if (!schedule) throw new AppError(404, "Schedule not found", "SCHEDULE_NOT_FOUND");
  if (schedule.exam.status !== ExamStatus.DRAFT) {
    throw new AppError(400, "Only draft exam schedules can be edited", "EXAM_NOT_DRAFT");
  }
  return prisma.examSchedule.update({
    where: { id: scheduleId },
    data: {
      ...(input.examDate !== undefined ? { examDate: input.examDate } : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
      ...(input.room !== undefined ? { room: input.room } : {}),
      ...(input.maximumMarks !== undefined ? { maximumMarks: input.maximumMarks } : {}),
      ...(input.minimumMarks !== undefined ? { minimumMarks: input.minimumMarks } : {}),
      ...(input.creditHours !== undefined ? { creditHours: input.creditHours } : {}),
    },
  });
}

export async function deleteExamSchedule(tenantId: string, scheduleId: string) {
  const schedule = await prisma.examSchedule.findFirst({
    where: tenantScope(tenantId, { id: scheduleId }),
    include: { exam: true },
  });
  if (!schedule) throw new AppError(404, "Schedule not found", "SCHEDULE_NOT_FOUND");
  if (schedule.exam.status !== ExamStatus.DRAFT) {
    throw new AppError(400, "Only draft exam schedules can be deleted", "EXAM_NOT_DRAFT");
  }
  await prisma.examSchedule.delete({ where: { id: scheduleId } });
}
