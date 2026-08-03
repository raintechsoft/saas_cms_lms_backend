import {
  EnrollmentStatus,
  StudentStatus,
  SubjectDeliveryType,
  SubjectType,
  TenantType,
  UserStatus,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { ensureTenantRoles } from "../../lib/tenant-bootstrap.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import { listSubjectGroups } from "./academics-extensions.service.js";

export async function getAcademicSetup(tenantId: string, sessionId?: string) {
  await ensureTenantRoles(tenantId);
  const currentSession = sessionId
    ? await prisma.academicSession.findFirst({
        where: tenantScope(tenantId, { id: sessionId }),
      })
    : await prisma.academicSession.findFirst({
        where: tenantScope(tenantId, { isCurrent: true }),
      });

  const [sessions, classes, sections, subjects, teachers, classSections, teacherRole, electiveCategories, subjectGroups] =
    await Promise.all([
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
        include: { electiveCategory: { select: { id: true, name: true, maxSelect: true } } },
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
                  subject: {
                    include: { electiveCategory: { select: { id: true, name: true, maxSelect: true } } },
                  },
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
      prisma.electiveCategory.findMany({
        where: tenantScope(tenantId, {}),
        include: {
          academicClass: { select: { id: true, name: true } },
          _count: { select: { subjects: true } },
        },
        orderBy: { name: "asc" },
      }),
      listSubjectGroups(tenantId),
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
    electiveCategories,
    subjectGroups,
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
  input: {
    name: string;
    code?: string | null;
    sortOrder?: number;
    inTime?: string | null;
    halfDayTime?: string | null;
    outTime?: string | null;
  },
) {
  const existing = await prisma.academicClass.findFirst({
    where: tenantScope(tenantId, { name: input.name.trim() }),
  });
  if (existing) {
    throw new AppError(409, `Class "${input.name.trim()}" already exists`, "CLASS_EXISTS");
  }
  return prisma.academicClass.create({
    data: {
      tenantId,
      name: input.name.trim(),
      code: input.code,
      sortOrder: input.sortOrder,
      inTime: input.inTime?.trim() || null,
      halfDayTime: input.halfDayTime?.trim() || null,
      outTime: input.outTime?.trim() || null,
    },
  });
}

export async function updateClass(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    code?: string | null;
    sortOrder?: number;
    inTime?: string | null;
    halfDayTime?: string | null;
    outTime?: string | null;
  },
) {
  await requireRecord("academicClass", tenantId, id, "Class");
  return prisma.academicClass.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.inTime !== undefined ? { inTime: input.inTime?.trim() || null } : {}),
      ...(input.halfDayTime !== undefined ? { halfDayTime: input.halfDayTime?.trim() || null } : {}),
      ...(input.outTime !== undefined ? { outTime: input.outTime?.trim() || null } : {}),
    },
  });
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

export async function createSubject(
  tenantId: string,
  input: {
    name: string;
    code?: string | null;
    type?: SubjectType;
    deliveryType?: SubjectDeliveryType;
    electiveCategoryId?: string | null;
  },
) {
  const type = input.type ?? SubjectType.CORE;
  const electiveCategoryId =
    type === SubjectType.ELECTIVE ? input.electiveCategoryId ?? null : null;
  if (electiveCategoryId) {
    const category = await prisma.electiveCategory.findFirst({
      where: tenantScope(tenantId, { id: electiveCategoryId }),
      select: { id: true },
    });
    if (!category) throw new AppError(400, "Elective category is invalid", "INVALID_ELECTIVE_CATEGORY");
  }
  return prisma.subject.create({
    data: {
      tenantId,
      name: input.name,
      code: input.code,
      type,
      deliveryType: input.deliveryType ?? SubjectDeliveryType.THEORY,
      electiveCategoryId,
    },
    include: { electiveCategory: { select: { id: true, name: true, maxSelect: true } } },
  });
}

export async function updateSubject(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    code?: string | null;
    type?: SubjectType;
    deliveryType?: SubjectDeliveryType;
    electiveCategoryId?: string | null;
  },
) {
  await requireRecord("subject", tenantId, id, "Subject");
  const nextType = input.type;
  let electiveCategoryId = input.electiveCategoryId;
  if (nextType === SubjectType.CORE) electiveCategoryId = null;
  if (electiveCategoryId) {
    const category = await prisma.electiveCategory.findFirst({
      where: tenantScope(tenantId, { id: electiveCategoryId }),
      select: { id: true },
    });
    if (!category) throw new AppError(400, "Elective category is invalid", "INVALID_ELECTIVE_CATEGORY");
  }
  return prisma.subject.update({
    where: { id },
    data: {
      name: input.name,
      code: input.code,
      type: input.type,
      deliveryType: input.deliveryType,
      ...(input.electiveCategoryId !== undefined || nextType === SubjectType.CORE
        ? { electiveCategoryId }
        : {}),
    },
    include: { electiveCategory: { select: { id: true, name: true, maxSelect: true } } },
  });
}

export async function createElectiveCategory(
  tenantId: string,
  input: {
    name: string;
    description?: string | null;
    classId?: string | null;
    maxSelect?: number;
  },
) {
  const name = input.name.trim();
  if (input.classId) {
    const academicClass = await prisma.academicClass.findFirst({
      where: tenantScope(tenantId, { id: input.classId }),
      select: { id: true },
    });
    if (!academicClass) throw new AppError(400, "Class is invalid", "INVALID_CLASS");
  }
  const existing = await prisma.electiveCategory.findFirst({
    where: tenantScope(tenantId, { name }),
  });
  if (existing) {
    throw new AppError(409, `Elective category "${name}" already exists`, "ELECTIVE_CATEGORY_EXISTS");
  }
  return prisma.electiveCategory.create({
    data: {
      tenantId,
      name,
      description: input.description?.trim() || null,
      classId: input.classId || null,
      maxSelect: Math.max(1, Math.min(10, Math.trunc(input.maxSelect ?? 1))),
    },
    include: {
      academicClass: { select: { id: true, name: true } },
      _count: { select: { subjects: true } },
    },
  });
}

export async function updateElectiveCategory(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    description?: string | null;
    classId?: string | null;
    maxSelect?: number;
  },
) {
  const existing = await prisma.electiveCategory.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!existing) throw new AppError(404, "Elective category not found", "ELECTIVE_CATEGORY_NOT_FOUND");
  if (input.classId) {
    const academicClass = await prisma.academicClass.findFirst({
      where: tenantScope(tenantId, { id: input.classId }),
      select: { id: true },
    });
    if (!academicClass) throw new AppError(400, "Class is invalid", "INVALID_CLASS");
  }
  return prisma.electiveCategory.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      description: input.description === undefined ? undefined : input.description?.trim() || null,
      classId: input.classId === undefined ? undefined : input.classId || null,
      maxSelect:
        input.maxSelect === undefined
          ? undefined
          : Math.max(1, Math.min(10, Math.trunc(input.maxSelect))),
    },
    include: {
      academicClass: { select: { id: true, name: true } },
      _count: { select: { subjects: true } },
    },
  });
}

export async function deleteElectiveCategory(tenantId: string, id: string) {
  const result = await prisma.electiveCategory.deleteMany({
    where: tenantScope(tenantId, { id }),
  });
  if (!result.count) throw new AppError(404, "Elective category not found", "ELECTIVE_CATEGORY_NOT_FOUND");
}

export async function getElectiveAssignmentBoard(tenantId: string, classSectionId: string) {
  const classSection = await prisma.classSection.findFirst({
    where: tenantScope(tenantId, { id: classSectionId }),
    include: {
      academicClass: true,
      section: true,
      subjects: {
        include: {
          subject: {
            include: { electiveCategory: { select: { id: true, name: true, maxSelect: true } } },
          },
        },
      },
    },
  });
  if (!classSection) throw new AppError(404, "Class section not found", "CLASS_SECTION_NOT_FOUND");

  const electiveSubjects = classSection.subjects
    .map((row) => row.subject)
    .filter((subject) => subject.type === SubjectType.ELECTIVE);

  const enrollments = await prisma.studentEnrollment.findMany({
    where: tenantScope(tenantId, {
      classSectionId,
      status: EnrollmentStatus.ACTIVE,
      student: { status: StudentStatus.ACTIVE },
    }),
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      electiveAssignments: {
        select: { id: true, subjectId: true, electiveCategoryId: true },
      },
    },
    orderBy: [{ student: { firstName: "asc" } }, { student: { lastName: "asc" } }],
  });

  return {
    classSection: {
      id: classSection.id,
      academicClass: classSection.academicClass,
      section: classSection.section,
    },
    electiveSubjects,
    students: enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      student: enrollment.student,
      selectedSubjectIds: enrollment.electiveAssignments.map((item) => item.subjectId),
    })),
  };
}

export async function saveStudentElectives(
  tenantId: string,
  input: {
    classSectionId: string;
    items: Array<{ studentEnrollmentId: string; subjectIds: string[] }>;
  },
) {
  const classSection = await prisma.classSection.findFirst({
    where: tenantScope(tenantId, { id: input.classSectionId }),
    include: {
      subjects: {
        include: {
          subject: {
            select: {
              id: true,
              type: true,
              electiveCategoryId: true,
              electiveCategory: { select: { id: true, maxSelect: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!classSection) throw new AppError(404, "Class section not found", "CLASS_SECTION_NOT_FOUND");

  const electiveById = new Map(
    classSection.subjects
      .map((row) => row.subject)
      .filter((subject) => subject.type === SubjectType.ELECTIVE)
      .map((subject) => [subject.id, subject] as const),
  );

  return prisma.$transaction(async (tx) => {
    let updated = 0;
    for (const item of input.items) {
      const enrollment = await tx.studentEnrollment.findFirst({
        where: tenantScope(tenantId, {
          id: item.studentEnrollmentId,
          classSectionId: input.classSectionId,
          status: EnrollmentStatus.ACTIVE,
        }),
        select: { id: true },
      });
      if (!enrollment) {
        throw new AppError(404, "Student enrollment not found", "ENROLLMENT_NOT_FOUND");
      }

      const uniqueSubjectIds = [...new Set(item.subjectIds)];
      for (const subjectId of uniqueSubjectIds) {
        if (!electiveById.has(subjectId)) {
          throw new AppError(
            400,
            "Only elective subjects assigned to this class section can be selected",
            "INVALID_ELECTIVE_SUBJECT",
          );
        }
      }

      const byCategory = new Map<string, number>();
      for (const subjectId of uniqueSubjectIds) {
        const subject = electiveById.get(subjectId)!;
        const categoryId = subject.electiveCategoryId ?? "__none__";
        byCategory.set(categoryId, (byCategory.get(categoryId) ?? 0) + 1);
        const maxSelect = subject.electiveCategory?.maxSelect ?? 99;
        if ((byCategory.get(categoryId) ?? 0) > maxSelect) {
          throw new AppError(
            400,
            `Too many subjects selected for category "${subject.electiveCategory?.name ?? "Uncategorized"}" (max ${maxSelect})`,
            "ELECTIVE_MAX_EXCEEDED",
          );
        }
      }

      await tx.studentElectiveAssignment.deleteMany({
        where: tenantScope(tenantId, { studentEnrollmentId: enrollment.id }),
      });
      if (uniqueSubjectIds.length) {
        await tx.studentElectiveAssignment.createMany({
          data: uniqueSubjectIds.map((subjectId) => {
            const subject = electiveById.get(subjectId)!;
            return {
              tenantId,
              studentEnrollmentId: enrollment.id,
              subjectId,
              electiveCategoryId: subject.electiveCategoryId,
            };
          }),
        });
      }
      updated += 1;
    }
    return { updated, classSectionId: input.classSectionId };
  });
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
  if (resource === "classes") {
    const linked = await prisma.classSection.count({ where: tenantScope(tenantId, { classId: id }) });
    if (linked) {
      throw new AppError(409, "Class has linked class sections and cannot be deleted", "CLASS_IN_USE");
    }
  }
  if (resource === "sections") {
    const linked = await prisma.classSection.count({ where: tenantScope(tenantId, { sectionId: id }) });
    if (linked) {
      throw new AppError(409, "Section has linked class sections and cannot be deleted", "SECTION_IN_USE");
    }
  }
  if (resource === "subjects") {
    const [assignments, electives, groupItems] = await Promise.all([
      prisma.classSubject.count({ where: tenantScope(tenantId, { subjectId: id }) }),
      prisma.studentElectiveAssignment.count({ where: tenantScope(tenantId, { subjectId: id }) }),
      prisma.subjectGroupItem.count({
        where: { classSubject: { tenantId, subjectId: id } },
      }),
    ]);
    if (assignments || electives || groupItems) {
      throw new AppError(409, "Subject is in use and cannot be deleted", "SUBJECT_IN_USE");
    }
  }
  if (resource === "class-sections") {
    const [enrollments, timetable] = await Promise.all([
      prisma.studentEnrollment.count({ where: tenantScope(tenantId, { classSectionId: id }) }),
      prisma.timetableEntry.count({ where: tenantScope(tenantId, { classSectionId: id }) }),
    ]);
    if (enrollments || timetable) {
      throw new AppError(409, "Class section has enrollments or timetable entries", "CLASS_SECTION_IN_USE");
    }
  }
  if (resource === "subject-assignments") {
    const [timetable, groupItems] = await Promise.all([
      prisma.timetableEntry.count({ where: tenantScope(tenantId, { classSubjectId: id }) }),
      prisma.subjectGroupItem.count({ where: { classSubjectId: id } }),
    ]);
    if (timetable || groupItems) {
      throw new AppError(409, "Subject assignment is used by timetable or subject groups", "SUBJECT_ASSIGNMENT_IN_USE");
    }
  }

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

export async function promoteStudents(
  tenantId: string,
  actorUserId: string | null | undefined,
  input: {
    fromClassSectionId: string;
    promoteSessionId: string;
    passContinueClassId: string;
    passContinueSectionId: string;
    items: Array<{
      studentEnrollmentId: string;
      result: "PASS" | "FAIL";
      action: "CONTINUE" | "LEAVE" | "SKIP";
    }>;
  },
) {
  await ensureTenantRoles(tenantId);

  // Actor is currently only used for future audit/logging.
  void actorUserId;

  return prisma.$transaction(async (tx) => {
    const [fromClassSection, promoteSession, tenant, passTarget] = await Promise.all([
      tx.classSection.findFirst({
        where: tenantScope(tenantId, { id: input.fromClassSectionId }),
        select: { id: true, classId: true, sectionId: true, academicSessionId: true },
      }),
      tx.academicSession.findFirst({
        where: tenantScope(tenantId, { id: input.promoteSessionId }),
        select: { id: true, name: true },
      }),
      tx.tenant.findUnique({
        where: { id: tenantId },
        select: { type: true },
      }),
      tx.classSection.findFirst({
        where: tenantScope(tenantId, {
          academicSessionId: input.promoteSessionId,
          classId: input.passContinueClassId,
          sectionId: input.passContinueSectionId,
        }),
        select: { id: true },
      }),
    ]);

    if (!fromClassSection) throw new AppError(404, "Source class section not found", "FROM_CLASS_SECTION_NOT_FOUND");
    if (!promoteSession) throw new AppError(404, "Promote session not found", "PROMOTE_SESSION_NOT_FOUND");
    if (!tenant) throw new AppError(404, "Tenant not found", "TENANT_NOT_FOUND");
    if (!passTarget) throw new AppError(404, "Pass target class section not found for selected class/section", "PASS_TARGET_NOT_FOUND");

    // Fail target stays in the same class-section (same classId + sectionId) as the source.
    const failTargetResolved = await tx.classSection.findFirst({
      where: tenantScope(tenantId, {
        academicSessionId: promoteSession.id,
        classId: fromClassSection.classId,
        sectionId: fromClassSection.sectionId,
      }),
      select: { id: true },
    });
    if (!failTargetResolved) {
      throw new AppError(
        404,
        "Fail target class section not found (next session must have same class-section created)",
        "FAIL_TARGET_NOT_FOUND",
      );
    }

    let promotedCount = 0;
    let alumniCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const item of input.items) {
      if (item.action === "SKIP") {
        skippedCount += 1;
        continue;
      }

      const enrollment = await tx.studentEnrollment.findFirst({
        where: tenantScope(tenantId, { id: item.studentEnrollmentId, classSectionId: input.fromClassSectionId }),
        select: { id: true, studentId: true, classSectionId: true },
      });

      if (!enrollment) {
        throw new AppError(404, "Student enrollment not found", "ENROLLMENT_NOT_FOUND");
      }

      if (item.action === "LEAVE") {
        await tx.student.update({
          where: { id: enrollment.studentId },
          data: { status: StudentStatus.ALUMNI },
        });
        await tx.studentEnrollment.update({
          where: { id: enrollment.id },
          data: { status: EnrollmentStatus.WITHDRAWN },
        });
        alumniCount += 1;
        continue;
      }

      // CONTINUE
      await tx.studentEnrollment.update({
        where: { id: enrollment.id },
        data: { status: EnrollmentStatus.PROMOTED, rollNumber: null },
      });

      const targetClassSectionId =
        item.result === "PASS" ? passTarget.id : failTargetResolved.id;

      // Non-coaching centers must not create multiple active enrollments in same session.
      if (tenant.type !== TenantType.COACHING_CENTER) {
        const existingActive = await tx.studentEnrollment.findFirst({
          where: tenantScope(tenantId, {
            studentId: enrollment.studentId,
            academicSessionId: promoteSession.id,
            status: EnrollmentStatus.ACTIVE,
          }),
          select: { id: true, classSectionId: true },
        });
        if (existingActive && existingActive.classSectionId !== targetClassSectionId) {
          throw new AppError(
            409,
            "Only coaching centers can enroll a student in multiple classes per session",
            "MULTI_CLASS_NOT_ALLOWED",
          );
        }
      }

      const existingTarget = await tx.studentEnrollment.findFirst({
        where: tenantScope(tenantId, {
          studentId: enrollment.studentId,
          academicSessionId: promoteSession.id,
          classSectionId: targetClassSectionId,
        }),
        select: { id: true, status: true },
      });

      if (existingTarget) {
        await tx.studentEnrollment.update({
          where: { id: existingTarget.id },
          data: { status: EnrollmentStatus.ACTIVE, rollNumber: null },
        });
      } else {
        await tx.studentEnrollment.create({
          data: {
            tenantId,
            studentId: enrollment.studentId,
            academicSessionId: promoteSession.id,
            classSectionId: targetClassSectionId,
            status: EnrollmentStatus.ACTIVE,
            rollNumber: null,
          },
        });
      }

      promotedCount += 1;
    }

    // If you want partial success handling later, we can switch from throw-on-first-error to best-effort.
    void errors;

    return {
      promoteSessionId: promoteSession.id,
      fromClassSectionId: fromClassSection.id,
      total: input.items.length,
      promoted: promotedCount,
      alumni: alumniCount,
      skipped: skippedCount,
    };
  });
}

/** Move ACTIVE enrollments between class sections in the same session (typically same class, different section). */
export async function bulkUpdateStudentSections(
  tenantId: string,
  input: {
    fromClassSectionId: string;
    toClassSectionId: string;
    items: Array<{
      studentEnrollmentId: string;
      rollNumber?: string | null;
    }>;
  },
) {
  if (input.fromClassSectionId === input.toClassSectionId) {
    throw new AppError(400, "Source and target class sections must be different", "SAME_CLASS_SECTION");
  }

  return prisma.$transaction(async (tx) => {
    const [fromClassSection, toClassSection, tenant] = await Promise.all([
      tx.classSection.findFirst({
        where: tenantScope(tenantId, { id: input.fromClassSectionId }),
        select: {
          id: true,
          classId: true,
          sectionId: true,
          academicSessionId: true,
          academicClass: { select: { name: true } },
          section: { select: { name: true } },
        },
      }),
      tx.classSection.findFirst({
        where: tenantScope(tenantId, { id: input.toClassSectionId }),
        select: {
          id: true,
          classId: true,
          sectionId: true,
          academicSessionId: true,
          academicClass: { select: { name: true } },
          section: { select: { name: true } },
        },
      }),
      tx.tenant.findUnique({
        where: { id: tenantId },
        select: { type: true },
      }),
    ]);

    if (!fromClassSection) throw new AppError(404, "Source class section not found", "FROM_CLASS_SECTION_NOT_FOUND");
    if (!toClassSection) throw new AppError(404, "Target class section not found", "TO_CLASS_SECTION_NOT_FOUND");
    if (!tenant) throw new AppError(404, "Tenant not found", "TENANT_NOT_FOUND");

    if (fromClassSection.academicSessionId !== toClassSection.academicSessionId) {
      throw new AppError(
        400,
        "Source and target must be in the same academic session (use Promote for next session)",
        "SESSION_MISMATCH",
      );
    }

    if (fromClassSection.classId !== toClassSection.classId) {
      throw new AppError(
        400,
        "Bulk section update only moves students within the same class. Use Promote to change class.",
        "CLASS_MISMATCH",
      );
    }

    let moved = 0;

    for (const item of input.items) {
      const enrollment = await tx.studentEnrollment.findFirst({
        where: tenantScope(tenantId, {
          id: item.studentEnrollmentId,
          classSectionId: fromClassSection.id,
          status: EnrollmentStatus.ACTIVE,
        }),
        select: {
          id: true,
          studentId: true,
          academicSessionId: true,
          rollNumber: true,
        },
      });

      if (!enrollment) {
        throw new AppError(404, "Active student enrollment not found in source section", "ENROLLMENT_NOT_FOUND");
      }

      const existingTarget = await tx.studentEnrollment.findFirst({
        where: tenantScope(tenantId, {
          studentId: enrollment.studentId,
          academicSessionId: enrollment.academicSessionId,
          classSectionId: toClassSection.id,
        }),
        select: { id: true, status: true },
      });

      if (existingTarget) {
        throw new AppError(
          409,
          "Student already has an enrollment in the target section",
          "TARGET_ENROLLMENT_EXISTS",
        );
      }

      // Non-coaching: block if another ACTIVE enrollment already exists outside source (shouldn't for same class move).
      if (tenant.type !== TenantType.COACHING_CENTER) {
        const otherActive = await tx.studentEnrollment.findFirst({
          where: tenantScope(tenantId, {
            studentId: enrollment.studentId,
            academicSessionId: enrollment.academicSessionId,
            status: EnrollmentStatus.ACTIVE,
            NOT: { id: enrollment.id },
          }),
          select: { id: true },
        });
        if (otherActive) {
          throw new AppError(
            409,
            "Only coaching centers can enroll a student in multiple classes per session",
            "MULTI_CLASS_NOT_ALLOWED",
          );
        }
      }

      const nextRoll =
        item.rollNumber === undefined ? enrollment.rollNumber : item.rollNumber === "" ? null : item.rollNumber;

      await tx.studentEnrollment.update({
        where: { id: enrollment.id },
        data: {
          classSectionId: toClassSection.id,
          rollNumber: nextRoll,
        },
      });

      // Keep denormalized attendance section in sync with the enrollment.
      await tx.attendanceRecord.updateMany({
        where: tenantScope(tenantId, { studentEnrollmentId: enrollment.id }),
        data: { classSectionId: toClassSection.id },
      });

      moved += 1;
    }

    return {
      fromClassSectionId: fromClassSection.id,
      toClassSectionId: toClassSection.id,
      fromLabel: `${fromClassSection.academicClass.name} · ${fromClassSection.section.name}`,
      toLabel: `${toClassSection.academicClass.name} · ${toClassSection.section.name}`,
      total: input.items.length,
      moved,
    };
  });
}
