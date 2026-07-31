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

export async function getExamSetup(tenantId: string) {
  const currentSession = await prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { isCurrent: true }),
  });
  const [sessions, grades, groups, classSections, templates, subjectLinks] = await Promise.all([
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
  ]);
  return { currentSession, sessions, grades, groups, classSections, templates, subjectLinks };
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
  input: { examGroupId: string; name: string; startDate: Date; endDate: Date },
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
  const [students, grades] = await Promise.all([
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
  ]);
  const results = students.map((student) => {
    const maximumMarks = student.marks.reduce((sum, mark) => {
      const components = mark.schedule.components ?? [];
      if (components.length > 0) {
        return (
          sum +
          components.reduce(
            (componentSum, component) => componentSum + Number(component.maximumMarks),
            0,
          )
        );
      }
      return sum + Number(mark.schedule.maximumMarks);
    }, 0);
    const obtainedMarks = student.marks.reduce(
      (sum, mark) => sum + Number(mark.marksObtained),
      0,
    );
    const percentage = maximumMarks ? (obtainedMarks / maximumMarks) * 100 : 0;
    const grade = grades.find(
      (item) => percentage >= Number(item.minPercent) && percentage <= Number(item.maxPercent),
    );
    const subjectFailed = student.marks.some(
      (mark) => mark.isAbsent || Number(mark.marksObtained) < Number(mark.schedule.minimumMarks),
    );
    return {
      examStudentId: student.id,
      student: student.studentEnrollment.student,
      classSection: student.studentEnrollment.classSection,
      rollNumber: student.rollNumber,
      marks: student.marks,
      aspects: student.aspectValues,
      maximumMarks,
      obtainedMarks,
      percentage: Number(percentage.toFixed(2)),
      grade: grade?.name ?? null,
      gradePoint: grade?.gradePoint ? Number(grade.gradePoint) : null,
      passStatus:
        subjectFailed || grade?.passStatus === PassStatus.FAIL ? PassStatus.FAIL : PassStatus.PASS,
    };
  });
  results.sort((a, b) => b.obtainedMarks - a.obtainedMarks);
  let lastScore: number | null = null;
  let rank = 0;
  return {
    exam,
    published: exam.status === ExamStatus.PUBLISHED,
    results: results.map((result, index) => {
      if (result.obtainedMarks !== lastScore) rank = index + 1;
      lastScore = result.obtainedMarks;
      return { ...result, rank };
    }),
  };
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
  const combined = new Map<string, {
    student: (typeof examResults)[number]["results"][number]["student"];
    classSection: (typeof examResults)[number]["results"][number]["classSection"];
    rollNumber: string | null;
    maximumMarks: number;
    obtainedMarks: number;
    failed: boolean;
    exams: Array<{
      examId: string;
      examName: string;
      maximumMarks: number;
      obtainedMarks: number;
      percentage: number;
      passStatus: PassStatus;
    }>;
  }>();
  for (const report of examResults) {
    for (const result of report.results) {
      const current = combined.get(result.student.id) ?? {
        student: result.student,
        classSection: result.classSection,
        rollNumber: result.rollNumber,
        maximumMarks: 0,
        obtainedMarks: 0,
        failed: false,
        exams: [],
      };
      current.maximumMarks += result.maximumMarks;
      current.obtainedMarks += result.obtainedMarks;
      current.failed ||= result.passStatus === PassStatus.FAIL;
      current.exams.push({
        examId: report.exam.id,
        examName: report.exam.name,
        maximumMarks: result.maximumMarks,
        obtainedMarks: result.obtainedMarks,
        percentage: result.percentage,
        passStatus: result.passStatus,
      });
      combined.set(result.student.id, current);
    }
  }
  const results = [...combined.values()].map((result) => {
    const percentage = result.maximumMarks
      ? (result.obtainedMarks / result.maximumMarks) * 100
      : 0;
    const grade = grades.find(
      (item) => percentage >= Number(item.minPercent) && percentage <= Number(item.maxPercent),
    );
    return {
      ...result,
      examStudentId: result.student.id,
      percentage: Number(percentage.toFixed(2)),
      grade: grade?.name ?? null,
      gradePoint: grade?.gradePoint ? Number(grade.gradePoint) : null,
      passStatus:
        result.failed || grade?.passStatus === PassStatus.FAIL
          ? PassStatus.FAIL
          : PassStatus.PASS,
    };
  });
  results.sort((a, b) => b.obtainedMarks - a.obtainedMarks);
  let rank = 0;
  let lastScore: number | null = null;
  return {
    group,
    published: group.exams.length > 0 &&
      group.exams.every((exam) => exam.status === ExamStatus.PUBLISHED),
    results: results.map((result, index) => {
      if (result.obtainedMarks !== lastScore) rank = index + 1;
      lastScore = result.obtainedMarks;
      return { ...result, rank };
    }),
  };
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
  input: { name?: string; startDate?: Date; endDate?: Date },
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
