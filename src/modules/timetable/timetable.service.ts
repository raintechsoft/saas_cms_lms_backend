import { EnrollmentStatus, UserStatus, type Weekday } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

async function validateEntry(
  tenantId: string,
  input: {
    academicSessionId: string;
    classSectionId: string;
    classSubjectId: string;
    teacherId?: string | null;
    weekday: Weekday;
    startTime: string;
    endTime: string;
  },
  excludeId?: string,
) {
  if (input.endTime <= input.startTime) {
    throw new AppError(400, "End time must be after start time", "INVALID_TIME_RANGE");
  }
  const classSubject = await prisma.classSubject.findFirst({
    where: tenantScope(tenantId, {
      id: input.classSubjectId,
      classSectionId: input.classSectionId,
    }),
    include: { classSection: true },
  });
  if (
    !classSubject ||
    classSubject.classSection.academicSessionId !== input.academicSessionId
  ) {
    throw new AppError(
      400,
      "Class subject and academic session are invalid",
      "INVALID_CLASS_SUBJECT",
    );
  }
  const teacherId = input.teacherId ?? classSubject.teacherId;
  if (teacherId) {
    const teacher = await prisma.user.findFirst({
      where: tenantScope(tenantId, {
        id: teacherId,
        status: UserStatus.ACTIVE,
        roles: { some: { role: { code: "TEACHER" } } },
      }),
    });
    if (!teacher) throw new AppError(400, "Teacher is invalid", "INVALID_TEACHER");
  }
  const overlapWhere = {
    weekday: input.weekday,
    startTime: { lt: input.endTime },
    endTime: { gt: input.startTime },
    ...(excludeId ? { id: { not: excludeId } } : {}),
  };
  const [classConflict, teacherConflict] = await Promise.all([
    prisma.timetableEntry.findFirst({
      where: tenantScope(tenantId, {
        academicSessionId: input.academicSessionId,
        classSectionId: input.classSectionId,
        ...overlapWhere,
      }),
    }),
    teacherId
      ? prisma.timetableEntry.findFirst({
          where: tenantScope(tenantId, {
            academicSessionId: input.academicSessionId,
            teacherId,
            ...overlapWhere,
          }),
        })
      : null,
  ]);
  if (classConflict) {
    throw new AppError(409, "Class already has a period at this time", "CLASS_TIMETABLE_CONFLICT");
  }
  if (teacherConflict) {
    throw new AppError(409, "Teacher already has a period at this time", "TEACHER_TIMETABLE_CONFLICT");
  }
  return { classSubject, teacherId };
}

const entryInclude = {
  academicSession: true,
  classSection: { include: { academicClass: true, section: true } },
  classSubject: { include: { subject: true } },
  teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

export async function getTimetableSetup(
  tenantId: string,
  query: { sessionId?: string; classSectionId?: string; teacherId?: string },
  viewer?: { userId: string; roles: string[] },
) {
  const currentSession = await prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { isCurrent: true }),
  });
  const sessionId = query.sessionId ?? currentSession?.id;
  const studentClassSectionIds = viewer?.roles.includes("STUDENT")
    ? (
        await prisma.studentEnrollment.findMany({
          where: tenantScope(tenantId, {
            status: EnrollmentStatus.ACTIVE,
            student: { userId: viewer.userId },
            ...(sessionId ? { academicSessionId: sessionId } : {}),
          }),
          select: { classSectionId: true },
        })
      ).map(({ classSectionId }) => classSectionId)
    : null;
  const classSectionFilter = studentClassSectionIds
    ? { id: { in: studentClassSectionIds } }
    : {};
  const entryClassSectionFilter = studentClassSectionIds
    ? { classSectionId: { in: studentClassSectionIds } }
    : query.classSectionId
      ? { classSectionId: query.classSectionId }
      : {};
  const [sessions, classSections, teachers, entries] = await Promise.all([
    prisma.academicSession.findMany({
      where: tenantScope(tenantId, {}),
      orderBy: { startDate: "desc" },
    }),
    prisma.classSection.findMany({
      where: tenantScope(tenantId, {
        ...(sessionId ? { academicSessionId: sessionId } : {}),
        ...classSectionFilter,
      }),
      include: {
        academicClass: true,
        section: true,
        subjects: { include: { subject: true, teacher: true } },
      },
      orderBy: [{ academicClass: { sortOrder: "asc" } }, { section: { name: "asc" } }],
    }),
    prisma.user.findMany({
      where: tenantScope(tenantId, {
        status: UserStatus.ACTIVE,
        roles: { some: { role: { code: "TEACHER" } } },
      }),
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.timetableEntry.findMany({
      where: tenantScope(tenantId, {
        ...(sessionId ? { academicSessionId: sessionId } : {}),
        ...entryClassSectionFilter,
        ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      }),
      include: entryInclude,
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    }),
  ]);
  return { currentSession, sessions, classSections, teachers, entries };
}

export async function createTimetableEntry(
  tenantId: string,
  input: {
    academicSessionId: string;
    classSectionId: string;
    classSubjectId: string;
    teacherId?: string | null;
    weekday: Weekday;
    startTime: string;
    endTime: string;
    room?: string | null;
  },
) {
  const { teacherId } = await validateEntry(tenantId, input);
  return prisma.timetableEntry.create({
    data: { tenantId, ...input, teacherId },
    include: entryInclude,
  });
}

export async function updateTimetableEntry(
  tenantId: string,
  id: string,
  input: {
    academicSessionId: string;
    classSectionId: string;
    classSubjectId: string;
    teacherId?: string | null;
    weekday: Weekday;
    startTime: string;
    endTime: string;
    room?: string | null;
  },
) {
  const existing = await prisma.timetableEntry.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!existing) throw new AppError(404, "Timetable entry not found", "TIMETABLE_NOT_FOUND");
  const { teacherId } = await validateEntry(tenantId, input, id);
  return prisma.timetableEntry.update({
    where: { id },
    data: { ...input, teacherId },
    include: entryInclude,
  });
}

export async function deleteTimetableEntry(tenantId: string, id: string) {
  const deleted = await prisma.timetableEntry.deleteMany({
    where: tenantScope(tenantId, { id }),
  });
  if (!deleted.count) throw new AppError(404, "Timetable entry not found", "TIMETABLE_NOT_FOUND");
  return { deleted: true };
}

export async function getFreePeriodReport(
  tenantId: string,
  query: { sessionId: string; weekday: Weekday; startTime: string; endTime: string },
) {
  const classSections = await prisma.classSection.findMany({
    where: tenantScope(tenantId, { academicSessionId: query.sessionId }),
    include: { academicClass: true, section: true },
    orderBy: [{ academicClass: { sortOrder: "asc" } }, { section: { name: "asc" } }],
  });
  const occupied = await prisma.timetableEntry.findMany({
    where: tenantScope(tenantId, {
      academicSessionId: query.sessionId,
      weekday: query.weekday,
      startTime: { lt: query.endTime },
      endTime: { gt: query.startTime },
    }),
    select: { classSectionId: true },
  });
  const occupiedIds = new Set(occupied.map(({ classSectionId }) => classSectionId));
  return classSections.filter(({ id }) => !occupiedIds.has(id));
}
