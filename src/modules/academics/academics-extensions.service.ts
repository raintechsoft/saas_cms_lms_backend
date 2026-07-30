import {
  EnrollmentStatus,
  Prisma,
  ScholarStatus,
  ScholarshipType,
  StudentStatus,
  SubjectDeliveryType,
  SubjectType,
  TenantType,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

const scholarInclude = {
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      admissionNumber: true,
      status: true,
      enrollments: {
        select: {
          id: true,
          status: true,
          academicSessionId: true,
          classSection: {
            select: {
              id: true,
              academicClass: { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { enrolledAt: "desc" as const },
      },
    },
  },
  academicSession: { select: { id: true, name: true } },
  feeDiscount: { select: { id: true, name: true, type: true, value: true } },
} as const;

function money(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value ?? 0);
}

export async function listSubjectGroups(tenantId: string, classSectionId?: string) {
  return prisma.subjectGroup.findMany({
    where: tenantScope(tenantId, classSectionId ? { classSectionId } : {}),
    include: {
      classSection: {
        include: {
          academicClass: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      },
      items: {
        include: {
          classSubject: {
            include: {
              subject: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  type: true,
                  deliveryType: true,
                },
              },
              teacher: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function createSubjectGroup(
  tenantId: string,
  input: {
    classSectionId: string;
    name: string;
    description?: string | null;
    classSubjectIds?: string[];
  },
) {
  const classSection = await prisma.classSection.findFirst({
    where: tenantScope(tenantId, { id: input.classSectionId }),
    select: { id: true },
  });
  if (!classSection) throw new AppError(404, "Class section not found", "CLASS_SECTION_NOT_FOUND");

  const name = input.name.trim();
  const existing = await prisma.subjectGroup.findFirst({
    where: tenantScope(tenantId, { classSectionId: input.classSectionId, name }),
  });
  if (existing) throw new AppError(409, `Subject group "${name}" already exists`, "SUBJECT_GROUP_EXISTS");

  const classSubjectIds = [...new Set(input.classSubjectIds ?? [])];
  if (classSubjectIds.length) {
    const validCount = await prisma.classSubject.count({
      where: tenantScope(tenantId, {
        id: { in: classSubjectIds },
        classSectionId: input.classSectionId,
      }),
    });
    if (validCount !== classSubjectIds.length) {
      throw new AppError(400, "One or more subjects are invalid for this class section", "INVALID_CLASS_SUBJECTS");
    }
  }

  return prisma.subjectGroup.create({
    data: {
      tenantId,
      classSectionId: input.classSectionId,
      name,
      description: input.description?.trim() || null,
      items: classSubjectIds.length
        ? { create: classSubjectIds.map((classSubjectId) => ({ classSubjectId })) }
        : undefined,
    },
    include: {
      items: {
        include: {
          classSubject: {
            include: { subject: true, teacher: { select: { id: true, firstName: true, lastName: true } } },
          },
        },
      },
    },
  });
}

export async function updateSubjectGroup(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    description?: string | null;
    classSubjectIds?: string[];
  },
) {
  const group = await prisma.subjectGroup.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!group) throw new AppError(404, "Subject group not found", "SUBJECT_GROUP_NOT_FOUND");

  if (input.classSubjectIds) {
    const classSubjectIds = [...new Set(input.classSubjectIds)];
    const validCount = await prisma.classSubject.count({
      where: tenantScope(tenantId, {
        id: { in: classSubjectIds },
        classSectionId: group.classSectionId,
      }),
    });
    if (validCount !== classSubjectIds.length) {
      throw new AppError(400, "One or more subjects are invalid for this class section", "INVALID_CLASS_SUBJECTS");
    }
  }

  return prisma.$transaction(async (tx) => {
    if (input.classSubjectIds) {
      await tx.subjectGroupItem.deleteMany({ where: { subjectGroupId: id } });
      if (input.classSubjectIds.length) {
        await tx.subjectGroupItem.createMany({
          data: [...new Set(input.classSubjectIds)].map((classSubjectId) => ({
            subjectGroupId: id,
            classSubjectId,
          })),
        });
      }
    }
    return tx.subjectGroup.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        description: input.description === undefined ? undefined : input.description?.trim() || null,
      },
      include: {
        items: {
          include: {
            classSubject: {
              include: { subject: true, teacher: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
    });
  });
}

export async function deleteSubjectGroup(tenantId: string, id: string) {
  const result = await prisma.subjectGroup.deleteMany({
    where: tenantScope(tenantId, { id }),
  });
  if (!result.count) throw new AppError(404, "Subject group not found", "SUBJECT_GROUP_NOT_FOUND");
}

export async function listSchoolScholars(
  tenantId: string,
  query: {
    sessionId?: string;
    classId?: string;
    classSectionId?: string;
    status?: ScholarStatus;
    scholarshipType?: ScholarshipType;
    search?: string;
    page?: number;
    limit?: number;
  },
) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const search = query.search?.trim();

  const enrollmentMatch =
    query.classSectionId || query.classId
      ? {
          student: {
            enrollments: {
              some: {
                ...(query.sessionId ? { academicSessionId: query.sessionId } : {}),
                ...(query.classSectionId
                  ? { classSectionId: query.classSectionId }
                  : { classSection: { classId: query.classId } }),
              },
            },
          },
        }
      : {};

  const commonFilters = {
    ...(query.sessionId ? { academicSessionId: query.sessionId } : {}),
    ...enrollmentMatch,
    ...(search
      ? {
          OR: [
            { scholarshipName: { contains: search, mode: "insensitive" as const } },
            { student: { firstName: { contains: search, mode: "insensitive" as const } } },
            { student: { lastName: { contains: search, mode: "insensitive" as const } } },
            { student: { admissionNumber: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const where = tenantScope(tenantId, {
    ...commonFilters,
    ...(query.status ? { status: query.status } : {}),
    ...(query.scholarshipType ? { scholarshipType: query.scholarshipType } : {}),
  });
  const statsWhere = tenantScope(tenantId, commonFilters);

  const [
    total,
    rows,
    activeCount,
    expiredCount,
    revokedCount,
    amountAgg,
    totalScholars,
    meritCount,
    needCount,
    governmentCount,
  ] = await Promise.all([
    prisma.schoolScholar.count({ where }),
    prisma.schoolScholar.findMany({
      where,
      include: scholarInclude,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.schoolScholar.count({ where: tenantScope(tenantId, { status: ScholarStatus.ACTIVE }) }),
    prisma.schoolScholar.count({ where: tenantScope(tenantId, { status: ScholarStatus.EXPIRED }) }),
    prisma.schoolScholar.count({ where: tenantScope(tenantId, { status: ScholarStatus.REVOKED }) }),
    prisma.schoolScholar.aggregate({
      where: tenantScope(tenantId, { status: ScholarStatus.ACTIVE }),
      _sum: { amount: true },
    }),
    prisma.schoolScholar.count({ where: statsWhere }),
    prisma.schoolScholar.count({
      where: { ...statsWhere, scholarshipType: ScholarshipType.MERIT },
    }),
    prisma.schoolScholar.count({
      where: { ...statsWhere, scholarshipType: ScholarshipType.NEED },
    }),
    prisma.schoolScholar.count({
      where: { ...statsWhere, scholarshipType: ScholarshipType.GOVERNMENT },
    }),
  ]);

  return {
    items: rows,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    stats: {
      active: activeCount,
      expired: expiredCount,
      revoked: revokedCount,
      totalAwardAmount: money(amountAgg._sum.amount),
      total: totalScholars,
      merit: meritCount,
      need: needCount,
      government: governmentCount,
    },
  };
}

export async function createSchoolScholar(
  tenantId: string,
  input: {
    studentId: string;
    academicSessionId: string;
    scholarshipType: ScholarshipType;
    scholarshipName: string;
    amount: number;
    validFrom: Date;
    validTo: Date;
    status?: ScholarStatus;
    note?: string | null;
    feeDiscountId?: string | null;
  },
) {
  if (input.validTo < input.validFrom) {
    throw new AppError(400, "Valid-to date must be on or after valid-from", "INVALID_DATES");
  }
  if (input.amount < 0) throw new AppError(400, "Amount cannot be negative", "INVALID_AMOUNT");

  const [student, session] = await Promise.all([
    prisma.student.findFirst({ where: tenantScope(tenantId, { id: input.studentId }), select: { id: true } }),
    prisma.academicSession.findFirst({
      where: tenantScope(tenantId, { id: input.academicSessionId }),
      select: { id: true },
    }),
  ]);
  if (!student) throw new AppError(404, "Student not found", "STUDENT_NOT_FOUND");
  if (!session) throw new AppError(404, "Academic session not found", "SESSION_NOT_FOUND");

  if (input.feeDiscountId) {
    const discount = await prisma.feeDiscount.findFirst({
      where: tenantScope(tenantId, { id: input.feeDiscountId }),
      select: { id: true },
    });
    if (!discount) throw new AppError(400, "Fee discount is invalid", "INVALID_FEE_DISCOUNT");
  }

  return prisma.schoolScholar.create({
    data: {
      tenantId,
      studentId: input.studentId,
      academicSessionId: input.academicSessionId,
      scholarshipType: input.scholarshipType,
      scholarshipName: input.scholarshipName.trim(),
      amount: new Prisma.Decimal(input.amount),
      validFrom: input.validFrom,
      validTo: input.validTo,
      status: input.status ?? ScholarStatus.ACTIVE,
      note: input.note?.trim() || null,
      feeDiscountId: input.feeDiscountId || null,
    },
    include: scholarInclude,
  });
}

export async function updateSchoolScholar(
  tenantId: string,
  id: string,
  input: {
    scholarshipType?: ScholarshipType;
    scholarshipName?: string;
    amount?: number;
    validFrom?: Date;
    validTo?: Date;
    status?: ScholarStatus;
    note?: string | null;
    feeDiscountId?: string | null;
  },
) {
  const existing = await prisma.schoolScholar.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!existing) throw new AppError(404, "School scholar not found", "SCHOLAR_NOT_FOUND");

  const validFrom = input.validFrom ?? existing.validFrom;
  const validTo = input.validTo ?? existing.validTo;
  if (validTo < validFrom) {
    throw new AppError(400, "Valid-to date must be on or after valid-from", "INVALID_DATES");
  }
  if (input.amount !== undefined && input.amount < 0) {
    throw new AppError(400, "Amount cannot be negative", "INVALID_AMOUNT");
  }
  if (input.feeDiscountId) {
    const discount = await prisma.feeDiscount.findFirst({
      where: tenantScope(tenantId, { id: input.feeDiscountId }),
      select: { id: true },
    });
    if (!discount) throw new AppError(400, "Fee discount is invalid", "INVALID_FEE_DISCOUNT");
  }

  return prisma.schoolScholar.update({
    where: { id },
    data: {
      scholarshipType: input.scholarshipType,
      scholarshipName: input.scholarshipName?.trim(),
      amount: input.amount === undefined ? undefined : new Prisma.Decimal(input.amount),
      validFrom: input.validFrom,
      validTo: input.validTo,
      status: input.status,
      note: input.note === undefined ? undefined : input.note?.trim() || null,
      feeDiscountId: input.feeDiscountId === undefined ? undefined : input.feeDiscountId || null,
    },
    include: scholarInclude,
  });
}

export async function deleteSchoolScholar(tenantId: string, id: string) {
  const result = await prisma.schoolScholar.deleteMany({
    where: tenantScope(tenantId, { id }),
  });
  if (!result.count) throw new AppError(404, "School scholar not found", "SCHOLAR_NOT_FOUND");
}

export async function getPromoteBoard(tenantId: string, fromClassSectionId: string, promoteSessionId: string) {
  const [fromClassSection, promoteSession, tenant] = await Promise.all([
    prisma.classSection.findFirst({
      where: tenantScope(tenantId, { id: fromClassSectionId }),
      include: {
        academicClass: true,
        section: true,
        academicSession: { select: { id: true, name: true } },
      },
    }),
    prisma.academicSession.findFirst({
      where: tenantScope(tenantId, { id: promoteSessionId }),
      select: { id: true, name: true },
    }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { type: true } }),
  ]);
  if (!fromClassSection) throw new AppError(404, "Source class section not found", "FROM_CLASS_SECTION_NOT_FOUND");
  if (!promoteSession) throw new AppError(404, "Promote session not found", "PROMOTE_SESSION_NOT_FOUND");

  const enrollments = await prisma.studentEnrollment.findMany({
    where: tenantScope(tenantId, {
      classSectionId: fromClassSectionId,
      status: EnrollmentStatus.ACTIVE,
      student: { status: StudentStatus.ACTIVE },
    }),
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, admissionNumber: true, status: true },
      },
    },
    orderBy: [{ student: { firstName: "asc" } }, { student: { lastName: "asc" } }],
  });

  const studentIds = enrollments.map((row) => row.studentId);
  const existingNext = studentIds.length
    ? await prisma.studentEnrollment.findMany({
        where: tenantScope(tenantId, {
          academicSessionId: promoteSessionId,
          studentId: { in: studentIds },
          status: EnrollmentStatus.ACTIVE,
        }),
        include: {
          classSection: {
            include: {
              academicClass: { select: { name: true } },
              section: { select: { name: true } },
            },
          },
        },
      })
    : [];

  const nextByStudent = new Map(existingNext.map((row) => [row.studentId, row]));

  return {
    fromClassSection,
    promoteSession,
    multiClassAllowed: tenant?.type === TenantType.COACHING_CENTER,
    students: enrollments.map((enrollment) => {
      const next = nextByStudent.get(enrollment.studentId);
      return {
        enrollmentId: enrollment.id,
        rollNumber: enrollment.rollNumber,
        student: enrollment.student,
        alreadyEnrolledInTargetSession: Boolean(next),
        existingTargetLabel: next
          ? `${next.classSection.academicClass.name} · ${next.classSection.section.name}`
          : null,
      };
    }),
  };
}

export async function applyAcademicBulkUpdate(
  tenantId: string,
  actorId: string,
  input: {
    updateType: "SECTION_MOVE" | "STATUS" | "SESSION_CLASS" | "SUBJECT_ASSIGN" | "CONCESSION";
    summary?: string;
    sectionMove?: {
      fromClassSectionId: string;
      toClassSectionId: string;
      items: Array<{ studentEnrollmentId: string; rollNumber?: string | null }>;
    };
    statusUpdate?: {
      studentIds: string[];
      status: StudentStatus;
      disabledReason?: string | null;
    };
    sessionClassUpdate?: {
      academicSessionId: string;
      classSectionId: string;
      studentEnrollmentIds: string[];
    };
    subjectAssign?: {
      classSectionId: string;
      subjectId: string;
      teacherId?: string | null;
      mode: "ASSIGN" | "UNASSIGN";
    };
    concessionUpdate?: {
      studentIds: string[];
      feeDiscountId: string | null;
      academicSessionId: string;
    };
  },
) {
  const affectedIds: string[] = [];
  let result: Record<string, unknown> = {};

  await prisma.$transaction(async (tx) => {
    if (input.updateType === "SECTION_MOVE") {
      if (!input.sectionMove) throw new AppError(400, "sectionMove payload required", "MISSING_PAYLOAD");
      const { bulkUpdateStudentSections } = await import("./academics.service.js");
      // Use outer transaction-safe path by calling inline logic — re-run through service outside tx is safer.
      result = { deferred: true };
      affectedIds.push(...input.sectionMove.items.map((item) => item.studentEnrollmentId));
    }

    if (input.updateType === "STATUS") {
      if (!input.statusUpdate?.studentIds.length) {
        throw new AppError(400, "statusUpdate.studentIds required", "MISSING_PAYLOAD");
      }
      const allowed: StudentStatus[] = [
        StudentStatus.ACTIVE,
        StudentStatus.ALUMNI,
        StudentStatus.DISABLED,
      ];
      if (!allowed.includes(input.statusUpdate.status)) {
        throw new AppError(400, "Unsupported student status", "INVALID_STATUS");
      }
      const update = await tx.student.updateMany({
        where: tenantScope(tenantId, { id: { in: input.statusUpdate.studentIds } }),
        data: {
          status: input.statusUpdate.status,
          disabledReason:
            input.statusUpdate.status === StudentStatus.ACTIVE
              ? null
              : input.statusUpdate.disabledReason?.trim() || null,
        },
      });
      affectedIds.push(...input.statusUpdate.studentIds);
      result = { updated: update.count };
    }

    if (input.updateType === "SESSION_CLASS") {
      if (!input.sessionClassUpdate?.studentEnrollmentIds.length) {
        throw new AppError(400, "sessionClassUpdate payload required", "MISSING_PAYLOAD");
      }
      const target = await tx.classSection.findFirst({
        where: tenantScope(tenantId, {
          id: input.sessionClassUpdate.classSectionId,
          academicSessionId: input.sessionClassUpdate.academicSessionId,
        }),
        select: { id: true, academicSessionId: true },
      });
      if (!target) throw new AppError(404, "Target class section not found", "CLASS_SECTION_NOT_FOUND");

      for (const enrollmentId of input.sessionClassUpdate.studentEnrollmentIds) {
        const enrollment = await tx.studentEnrollment.findFirst({
          where: tenantScope(tenantId, { id: enrollmentId }),
          select: { id: true, studentId: true, academicSessionId: true },
        });
        if (!enrollment) throw new AppError(404, "Enrollment not found", "ENROLLMENT_NOT_FOUND");

        if (enrollment.academicSessionId === target.academicSessionId) {
          await tx.studentEnrollment.update({
            where: { id: enrollment.id },
            data: { classSectionId: target.id, status: EnrollmentStatus.ACTIVE },
          });
        } else {
          await tx.studentEnrollment.update({
            where: { id: enrollment.id },
            data: { status: EnrollmentStatus.PROMOTED },
          });
          const existing = await tx.studentEnrollment.findFirst({
            where: tenantScope(tenantId, {
              studentId: enrollment.studentId,
              academicSessionId: target.academicSessionId,
              classSectionId: target.id,
            }),
          });
          if (existing) {
            await tx.studentEnrollment.update({
              where: { id: existing.id },
              data: { status: EnrollmentStatus.ACTIVE },
            });
          } else {
            await tx.studentEnrollment.create({
              data: {
                tenantId,
                studentId: enrollment.studentId,
                academicSessionId: target.academicSessionId,
                classSectionId: target.id,
                status: EnrollmentStatus.ACTIVE,
              },
            });
          }
        }
        affectedIds.push(enrollmentId);
      }
      result = { updated: affectedIds.length };
    }

    if (input.updateType === "SUBJECT_ASSIGN") {
      if (!input.subjectAssign) throw new AppError(400, "subjectAssign payload required", "MISSING_PAYLOAD");
      const classSection = await tx.classSection.findFirst({
        where: tenantScope(tenantId, { id: input.subjectAssign.classSectionId }),
        select: { id: true },
      });
      if (!classSection) throw new AppError(404, "Class section not found", "CLASS_SECTION_NOT_FOUND");
      const subject = await tx.subject.findFirst({
        where: tenantScope(tenantId, { id: input.subjectAssign.subjectId }),
        select: { id: true },
      });
      if (!subject) throw new AppError(404, "Subject not found", "SUBJECT_NOT_FOUND");

      if (input.subjectAssign.mode === "UNASSIGN") {
        const deleted = await tx.classSubject.deleteMany({
          where: tenantScope(tenantId, {
            classSectionId: input.subjectAssign.classSectionId,
            subjectId: input.subjectAssign.subjectId,
          }),
        });
        result = { deleted: deleted.count };
      } else {
        const row = await tx.classSubject.upsert({
          where: {
            tenantId_classSectionId_subjectId: {
              tenantId,
              classSectionId: input.subjectAssign.classSectionId,
              subjectId: input.subjectAssign.subjectId,
            },
          },
          create: {
            tenantId,
            classSectionId: input.subjectAssign.classSectionId,
            subjectId: input.subjectAssign.subjectId,
            teacherId: input.subjectAssign.teacherId || null,
          },
          update: { teacherId: input.subjectAssign.teacherId || null },
        });
        affectedIds.push(row.id);
        result = { assigned: row.id };
      }
    }

    if (input.updateType === "CONCESSION") {
      if (!input.concessionUpdate?.studentIds.length) {
        throw new AppError(400, "concessionUpdate payload required", "MISSING_PAYLOAD");
      }
      if (input.concessionUpdate.feeDiscountId) {
        const discount = await tx.feeDiscount.findFirst({
          where: tenantScope(tenantId, { id: input.concessionUpdate.feeDiscountId }),
          select: { id: true },
        });
        if (!discount) throw new AppError(400, "Fee discount is invalid", "INVALID_FEE_DISCOUNT");
      }

      // Apply/clear a fee discount assignment marker on active fee assignments for the session.
      const enrollments = await tx.studentEnrollment.findMany({
        where: tenantScope(tenantId, {
          studentId: { in: input.concessionUpdate.studentIds },
          academicSessionId: input.concessionUpdate.academicSessionId,
          status: EnrollmentStatus.ACTIVE,
        }),
        select: { id: true, studentId: true },
      });
      for (const enrollment of enrollments) {
        await tx.studentFeeAssignment.updateMany({
          where: tenantScope(tenantId, {
            studentEnrollmentId: enrollment.id,
          }),
          data: { discountId: input.concessionUpdate.feeDiscountId },
        });
        affectedIds.push(enrollment.studentId);
      }
      result = { updatedStudents: [...new Set(affectedIds)].length };
    }

    await tx.academicBulkUpdateLog.create({
      data: {
        tenantId,
        actorId,
        updateType: input.updateType,
        summary: input.summary?.trim() || `${input.updateType} applied to ${affectedIds.length || "selected"} records`,
        payload: input as unknown as Prisma.InputJsonValue,
        affectedIds: [...new Set(affectedIds)],
      },
    });
  });

  if (input.updateType === "SECTION_MOVE" && input.sectionMove) {
    const { bulkUpdateStudentSections } = await import("./academics.service.js");
    result = await bulkUpdateStudentSections(tenantId, input.sectionMove);
    await prisma.academicBulkUpdateLog.create({
      data: {
        tenantId,
        actorId,
        updateType: input.updateType,
        summary: input.summary?.trim() || `Moved ${(result as { moved?: number }).moved ?? 0} students`,
        payload: input as unknown as Prisma.InputJsonValue,
        affectedIds: input.sectionMove.items.map((item) => item.studentEnrollmentId),
      },
    });
  }

  return { updateType: input.updateType, result, affectedIds: [...new Set(affectedIds)] };
}

export async function getAcademicReportCatalog() {
  return [
    { key: "students", label: "Students", description: "Active students by class/section" },
    { key: "attendance", label: "Attendance", description: "Attendance summary for session" },
    { key: "marks", label: "Marks / Exam Rank", description: "Exam results when exam selected" },
    { key: "toppers", label: "Toppers", description: "Top ranked exam students" },
    { key: "timetable", label: "Timetable", description: "Class timetable entries" },
    { key: "fees", label: "Due Fees", description: "Due fees snapshot for selected filters" },
    { key: "scholars", label: "School Scholars", description: "Scholarship awards" },
    { key: "promotions", label: "Active Enrollments", description: "Active enrollments for the selected session" },
    { key: "teacher_workload", label: "Teacher Workload", description: "Periods assigned per teacher" },
    { key: "custom", label: "Custom Selection", description: "Combined academic snapshot" },
  ];
}

function reportClassSectionFilter(query: { classSectionId?: string; classId?: string }) {
  if (query.classSectionId) return { classSectionId: query.classSectionId };
  if (query.classId) return { classSection: { classId: query.classId } };
  return {};
}

export async function runAcademicReport(
  tenantId: string,
  query: {
    reportKey: string;
    sessionId?: string;
    classId?: string;
    classSectionId?: string;
    examId?: string;
    from?: Date;
    to?: Date;
    format?: "json" | "csv";
  },
) {
  const session =
    query.sessionId
      ? await prisma.academicSession.findFirst({ where: tenantScope(tenantId, { id: query.sessionId }) })
      : await prisma.academicSession.findFirst({ where: tenantScope(tenantId, { isCurrent: true }) });

  const classSectionFilter = reportClassSectionFilter(query);

  let rows: Array<Record<string, unknown>> = [];
  let columns: string[] = [];

  switch (query.reportKey) {
    case "students": {
      const enrollments = await prisma.studentEnrollment.findMany({
        where: tenantScope(tenantId, {
          ...(session ? { academicSessionId: session.id } : {}),
          ...classSectionFilter,
          status: EnrollmentStatus.ACTIVE,
          student: { status: StudentStatus.ACTIVE },
        }),
        include: {
          student: true,
          classSection: { include: { academicClass: true, section: true } },
        },
        orderBy: [{ student: { firstName: "asc" } }],
      });
      columns = ["admissionNumber", "name", "class", "section", "rollNumber", "status"];
      rows = enrollments.map((row) => ({
        admissionNumber: row.student.admissionNumber,
        name: `${row.student.firstName} ${row.student.lastName ?? ""}`.trim(),
        class: row.classSection.academicClass.name,
        section: row.classSection.section.name,
        rollNumber: row.rollNumber ?? "",
        status: row.student.status,
      }));
      break;
    }
    case "attendance": {
      const records = await prisma.attendanceRecord.findMany({
        where: tenantScope(tenantId, {
          ...(session ? { academicSessionId: session.id } : {}),
          ...classSectionFilter,
          ...(query.from || query.to
            ? {
                attendanceDate: {
                  ...(query.from ? { gte: query.from } : {}),
                  ...(query.to ? { lte: query.to } : {}),
                },
              }
            : {}),
        }),
        include: {
          studentEnrollment: { include: { student: true } },
          classSection: { include: { academicClass: true, section: true } },
        },
        take: 5000,
        orderBy: [{ attendanceDate: "desc" }],
      });
      columns = ["date", "admissionNumber", "name", "class", "section", "status"];
      rows = records.map((row) => ({
        date: row.attendanceDate.toISOString().slice(0, 10),
        admissionNumber: row.studentEnrollment.student.admissionNumber,
        name: `${row.studentEnrollment.student.firstName} ${row.studentEnrollment.student.lastName ?? ""}`.trim(),
        class: row.classSection.academicClass.name,
        section: row.classSection.section.name,
        status: row.status,
      }));
      break;
    }
    case "marks":
    case "toppers": {
      if (!query.examId) throw new AppError(400, "examId is required for marks/toppers", "EXAM_REQUIRED");
      const { getExamResults } = await import("../exams/exams.service.js");
      const report = await getExamResults(tenantId, query.examId);
      const ranked = [...(report.results ?? [])]
        .map((row) => ({
          admissionNumber: row.student?.admissionNumber ?? "",
          name: `${row.student?.firstName ?? ""} ${row.student?.lastName ?? ""}`.trim(),
          total: Number(row.obtainedMarks ?? 0),
          rank: row.rank ?? null,
          percentage: row.percentage ?? null,
        }))
        .sort((a, b) => b.total - a.total);
      columns = ["rank", "admissionNumber", "name", "total", "percentage"];
      rows = (query.reportKey === "toppers" ? ranked.slice(0, 10) : ranked).map((row, index) => ({
        rank: row.rank ?? index + 1,
        admissionNumber: row.admissionNumber,
        name: row.name,
        total: row.total,
        percentage: row.percentage ?? "",
      }));
      break;
    }
    case "timetable": {
      const entries = await prisma.timetableEntry.findMany({
        where: tenantScope(tenantId, {
          ...(session ? { academicSessionId: session.id } : {}),
          ...classSectionFilter,
        }),
        include: {
          classSection: { include: { academicClass: true, section: true } },
          classSubject: { include: { subject: true } },
          teacher: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      });
      columns = ["weekday", "class", "section", "subject", "teacher", "startTime", "endTime", "room"];
      rows = entries.map((row) => ({
        weekday: row.weekday,
        class: row.classSection.academicClass.name,
        section: row.classSection.section.name,
        subject: row.classSubject.subject.name,
        teacher: row.teacher ? `${row.teacher.firstName} ${row.teacher.lastName}` : "",
        startTime: row.startTime,
        endTime: row.endTime,
        room: row.room ?? "",
      }));
      break;
    }
    case "fees": {
      const { runCoreReport } = await import("../reports/reports.service.js");
      const data = await runCoreReport(tenantId, "due_fees", {
        sessionId: session?.id,
        classSectionId: query.classSectionId,
      });
      columns = ["admissionNumber", "name", "dueAmount"];
      rows = (Array.isArray(data.rows) ? data.rows : []).map((row: any) => ({
        admissionNumber: row.admissionNumber ?? row.student?.admissionNumber ?? "",
        name: row.name ?? `${row.student?.firstName ?? ""} ${row.student?.lastName ?? ""}`.trim(),
        dueAmount: row.balance ?? row.dueAmount ?? row.amount ?? 0,
      }));
      break;
    }
    case "scholars": {
      const scholars = await prisma.schoolScholar.findMany({
        where: tenantScope(tenantId, {
          ...(session ? { academicSessionId: session.id } : {}),
          ...(query.classSectionId || query.classId
            ? {
                student: {
                  enrollments: {
                    some: {
                      ...(session ? { academicSessionId: session.id } : {}),
                      ...classSectionFilter,
                    },
                  },
                },
              }
            : {}),
        }),
        include: scholarInclude,
        orderBy: { createdAt: "desc" },
      });
      columns = ["admissionNumber", "name", "scholarshipName", "type", "amount", "status", "validFrom", "validTo"];
      rows = scholars.map((row) => ({
        admissionNumber: row.student.admissionNumber,
        name: `${row.student.firstName} ${row.student.lastName ?? ""}`.trim(),
        scholarshipName: row.scholarshipName,
        type: row.scholarshipType,
        amount: money(row.amount),
        status: row.status,
        validFrom: row.validFrom.toISOString().slice(0, 10),
        validTo: row.validTo.toISOString().slice(0, 10),
      }));
      break;
    }
    case "promotions": {
      const promotions = await prisma.studentEnrollment.findMany({
        where: tenantScope(tenantId, {
          ...(session ? { academicSessionId: session.id } : {}),
          ...classSectionFilter,
          status: EnrollmentStatus.ACTIVE,
        }),
        include: {
          student: true,
          classSection: { include: { academicClass: true, section: true } },
        },
        orderBy: { enrolledAt: "desc" },
        take: 2000,
      });
      columns = ["admissionNumber", "name", "class", "section", "enrolledAt"];
      rows = promotions.map((row) => ({
        admissionNumber: row.student.admissionNumber,
        name: `${row.student.firstName} ${row.student.lastName ?? ""}`.trim(),
        class: row.classSection.academicClass.name,
        section: row.classSection.section.name,
        enrolledAt: row.enrolledAt.toISOString().slice(0, 10),
      }));
      break;
    }
    case "teacher_workload": {
      const entries = await prisma.timetableEntry.findMany({
        where: tenantScope(tenantId, {
          ...(session ? { academicSessionId: session.id } : {}),
          ...classSectionFilter,
        }),
        include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
      });
      const map = new Map<string, { teacher: string; periods: number }>();
      for (const entry of entries) {
        if (!entry.teacher) continue;
        const key = entry.teacher.id;
        const current = map.get(key) ?? {
          teacher: `${entry.teacher.firstName} ${entry.teacher.lastName}`,
          periods: 0,
        };
        current.periods += 1;
        map.set(key, current);
      }
      columns = ["teacher", "periods"];
      rows = [...map.values()].sort((a, b) => b.periods - a.periods);
      break;
    }
    case "custom": {
      const [students, scholars, entries] = await Promise.all([
        prisma.studentEnrollment.count({
          where: tenantScope(tenantId, {
            ...(session ? { academicSessionId: session.id } : {}),
            ...classSectionFilter,
            status: EnrollmentStatus.ACTIVE,
          }),
        }),
        prisma.schoolScholar.count({
          where: tenantScope(tenantId, {
            ...(session ? { academicSessionId: session.id } : {}),
            status: ScholarStatus.ACTIVE,
            ...(query.classSectionId || query.classId
              ? {
                  student: {
                    enrollments: {
                      some: {
                        ...(session ? { academicSessionId: session.id } : {}),
                        ...classSectionFilter,
                      },
                    },
                  },
                }
              : {}),
          }),
        }),
        prisma.timetableEntry.count({
          where: tenantScope(tenantId, {
            ...(session ? { academicSessionId: session.id } : {}),
            ...classSectionFilter,
          }),
        }),
      ]);
      columns = ["metric", "value"];
      rows = [
        { metric: "active_enrollments", value: students },
        { metric: "active_scholars", value: scholars },
        { metric: "timetable_periods", value: entries },
      ];
      break;
    }
    default:
      throw new AppError(404, "Unknown academic report", "REPORT_NOT_FOUND");
  }

  if (query.format === "csv") {
    const escape = (value: unknown) => {
      const text = String(value ?? "");
      if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
      return text;
    };
    const csv = [columns.join(","), ...rows.map((row) => columns.map((col) => escape(row[col])).join(","))].join(
      "\n",
    );
    return { format: "csv" as const, filename: `${query.reportKey}-report.csv`, csv, columns, rows };
  }

  return { format: "json" as const, columns, rows, session };
}

export async function createClassWithSections(
  tenantId: string,
  input: {
    name: string;
    code?: string | null;
    sortOrder?: number;
    academicSessionId?: string;
    sectionIds?: string[];
    classTeacherId?: string | null;
  },
) {
  const { createClass, createClassSection } = await import("./academics.service.js");
  const academicClass = await createClass(tenantId, {
    name: input.name,
    code: input.code,
    sortOrder: input.sortOrder,
  });

  const createdSections = [];
  if (input.academicSessionId && input.sectionIds?.length) {
    for (const sectionId of input.sectionIds) {
      try {
        const classSection = await createClassSection(tenantId, {
          academicSessionId: input.academicSessionId,
          classId: academicClass.id,
          sectionId,
          classTeacherId: input.classTeacherId,
        });
        createdSections.push(classSection);
      } catch (error) {
        if (error instanceof AppError && error.code === "CLASS_SECTION_EXISTS") continue;
        throw error;
      }
    }
  }

  return { academicClass, classSections: createdSections };
}

export type { SubjectDeliveryType, SubjectType };
