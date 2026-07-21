import { UserStatus, type SubjectType } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { ensureTenantRoles } from "../../lib/tenant-bootstrap.js";
import { tenantScope } from "../../lib/tenant-scope.js";

export async function getAcademicSetup(tenantId: string, sessionId?: string) {
  await ensureTenantRoles(tenantId);
  const currentSession = sessionId
    ? await prisma.academicSession.findFirst({
        where: tenantScope(tenantId, { id: sessionId }),
      })
    : await prisma.academicSession.findFirst({
        where: tenantScope(tenantId, { isCurrent: true }),
      });

  const [sessions, classes, sections, subjects, teachers, classSections, teacherRole] = await Promise.all([
    prisma.academicSession.findMany({
      where: tenantScope(tenantId, {}),
      orderBy: { startDate: "desc" },
    }),
    prisma.academicClass.findMany({
      where: tenantScope(tenantId, {}),
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.section.findMany({
      where: tenantScope(tenantId, {}),
      orderBy: { name: "asc" },
    }),
    prisma.subject.findMany({
      where: tenantScope(tenantId, {}),
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: tenantScope(tenantId, {
        status: UserStatus.ACTIVE,
        roles: { some: { role: { code: "TEACHER" } } },
      }),
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    currentSession
      ? prisma.classSection.findMany({
          where: tenantScope(tenantId, { academicSessionId: currentSession.id }),
          include: {
            academicClass: true,
            section: true,
            classTeacher: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            subjects: {
              include: {
                subject: true,
                teacher: {
                  select: { id: true, firstName: true, lastName: true, email: true },
                },
              },
            },
            _count: { select: { enrollments: true } },
          },
          orderBy: [
            { academicClass: { sortOrder: "asc" } },
            { section: { name: "asc" } },
          ],
        })
      : Promise.resolve([]),
    prisma.role.findFirst({
      where: tenantScope(tenantId, { code: "TEACHER" }),
      select: { id: true },
    }),
  ]);

  return {
    currentSession,
    sessions,
    classes,
    sections,
    subjects,
    teachers,
    classSections,
    teacherRoleId: teacherRole?.id ?? null,
  };
}

export async function createSession(
  tenantId: string,
  input: { name: string; startDate: Date; endDate: Date; isCurrent: boolean },
) {
  if (input.endDate <= input.startDate) {
    throw new AppError(400, "Session end date must be after start date", "INVALID_DATES");
  }
  return prisma.$transaction(async (tx) => {
    if (input.isCurrent) {
      await tx.academicSession.updateMany({
        where: { tenantId, isCurrent: true },
        data: { isCurrent: false },
      });
    }
    return tx.academicSession.create({ data: { tenantId, ...input } });
  });
}

export async function setCurrentSession(tenantId: string, sessionId: string) {
  const session = await prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { id: sessionId }),
  });
  if (!session) throw new AppError(404, "Academic session not found", "SESSION_NOT_FOUND");
  return prisma.$transaction(async (tx) => {
    await tx.academicSession.updateMany({
      where: { tenantId, isCurrent: true },
      data: { isCurrent: false },
    });
    return tx.academicSession.update({
      where: { id: sessionId },
      data: { isCurrent: true },
    });
  });
}

export async function createClass(
  tenantId: string,
  input: { name: string; code?: string | null; sortOrder?: number },
) {
  const existing = await prisma.academicClass.findFirst({
    where: tenantScope(tenantId, { name: input.name.trim() }),
  });
  if (existing) {
    throw new AppError(409, `Class "${input.name.trim()}" already exists`, "CLASS_EXISTS");
  }
  return prisma.academicClass.create({ data: { tenantId, ...input } });
}

export async function updateClass(
  tenantId: string,
  id: string,
  input: { name?: string; code?: string | null; sortOrder?: number },
) {
  await requireRecord("academicClass", tenantId, id, "Class");
  return prisma.academicClass.update({ where: { id }, data: input });
}

export async function createSection(tenantId: string, input: { name: string }) {
  const name = input.name.trim();
  const existing = await prisma.section.findFirst({
    where: tenantScope(tenantId, { name }),
  });
  if (existing) {
    throw new AppError(409, `Section "${name}" already exists`, "SECTION_EXISTS");
  }
  return prisma.section.create({ data: { tenantId, name } });
}

export async function updateSection(tenantId: string, id: string, input: { name: string }) {
  await requireRecord("section", tenantId, id, "Section");
  return prisma.section.update({ where: { id }, data: input });
}

export function createSubject(
  tenantId: string,
  input: { name: string; code?: string | null; type?: SubjectType },
) {
  return prisma.subject.create({ data: { tenantId, ...input } });
}

export async function updateSubject(
  tenantId: string,
  id: string,
  input: { name?: string; code?: string | null; type?: SubjectType },
) {
  await requireRecord("subject", tenantId, id, "Subject");
  return prisma.subject.update({ where: { id }, data: input });
}

type ScopedModel = "academicClass" | "section" | "subject";

async function requireRecord(model: ScopedModel, tenantId: string, id: string, label: string) {
  const where = tenantScope(tenantId, { id });
  const record =
    model === "academicClass"
      ? await prisma.academicClass.findFirst({ where })
      : model === "section"
        ? await prisma.section.findFirst({ where })
        : await prisma.subject.findFirst({ where });
  if (!record) throw new AppError(404, `${label} not found`, "RECORD_NOT_FOUND");
}

async function requireTenantTeacher(tenantId: string, userId: string | null | undefined) {
  if (!userId) return;
  const user = await prisma.user.findFirst({
    where: tenantScope(tenantId, {
      id: userId,
      status: UserStatus.ACTIVE,
      roles: { some: { role: { code: "TEACHER" } } },
    }),
  });
  if (!user) {
    throw new AppError(
      400,
      "Assigned teacher must be an active tenant teacher",
      "INVALID_TEACHER",
    );
  }
}

export async function createClassSection(
  tenantId: string,
  input: {
    academicSessionId: string;
    classId: string;
    sectionId: string;
    classTeacherId?: string | null;
  },
) {
  const [session, academicClass, section] = await Promise.all([
    prisma.academicSession.findFirst({
      where: tenantScope(tenantId, { id: input.academicSessionId }),
    }),
    prisma.academicClass.findFirst({ where: tenantScope(tenantId, { id: input.classId }) }),
    prisma.section.findFirst({ where: tenantScope(tenantId, { id: input.sectionId }) }),
  ]);
  if (!session || !academicClass || !section) {
    throw new AppError(400, "Session, class, or section is invalid", "INVALID_ACADEMIC_SETUP");
  }
  await requireTenantTeacher(tenantId, input.classTeacherId);

  const existing = await prisma.classSection.findFirst({
    where: tenantScope(tenantId, {
      academicSessionId: input.academicSessionId,
      classId: input.classId,
      sectionId: input.sectionId,
    }),
    include: { academicClass: true, section: true },
  });
  if (existing) {
    throw new AppError(
      409,
      `Class section "${existing.academicClass.name} · ${existing.section.name}" already exists for this session`,
      "CLASS_SECTION_EXISTS",
    );
  }

  return prisma.classSection.create({
    data: { tenantId, ...input },
    include: { academicClass: true, section: true, classTeacher: true },
  });
}

export async function updateClassSection(
  tenantId: string,
  id: string,
  input: { classTeacherId?: string | null },
) {
  const record = await prisma.classSection.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!record) throw new AppError(404, "Class section not found", "CLASS_SECTION_NOT_FOUND");
  await requireTenantTeacher(tenantId, input.classTeacherId);
  return prisma.classSection.update({
    where: { id },
    data: input,
    include: { academicClass: true, section: true, classTeacher: true },
  });
}

export async function assignSubject(
  tenantId: string,
  input: { classSectionId: string; subjectId: string; teacherId?: string | null },
) {
  const [classSection, subject] = await Promise.all([
    prisma.classSection.findFirst({
      where: tenantScope(tenantId, { id: input.classSectionId }),
    }),
    prisma.subject.findFirst({ where: tenantScope(tenantId, { id: input.subjectId }) }),
  ]);
  if (!classSection || !subject) {
    throw new AppError(400, "Class section or subject is invalid", "INVALID_SUBJECT_ASSIGNMENT");
  }
  await requireTenantTeacher(tenantId, input.teacherId);
  return prisma.classSubject.upsert({
    where: {
      tenantId_classSectionId_subjectId: {
        tenantId,
        classSectionId: input.classSectionId,
        subjectId: input.subjectId,
      },
    },
    create: { tenantId, ...input },
    update: { teacherId: input.teacherId },
    include: { subject: true, teacher: true },
  });
}

export async function deleteScopedRecord(
  tenantId: string,
  resource: "classes" | "sections" | "subjects" | "class-sections" | "subject-assignments",
  id: string,
) {
  const delegates = {
    classes: prisma.academicClass,
    sections: prisma.section,
    subjects: prisma.subject,
    "class-sections": prisma.classSection,
    "subject-assignments": prisma.classSubject,
  } as const;
  const result = await (delegates[resource] as typeof prisma.academicClass).deleteMany({
    where: tenantScope(tenantId, { id }),
  });
  if (!result.count) throw new AppError(404, "Record not found", "RECORD_NOT_FOUND");
}
