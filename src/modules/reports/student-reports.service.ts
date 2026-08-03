import {
  EnrollmentStatus,
  OnlineAdmissionStatus,
  StudentStatus,
} from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

export type StudentReportKey =
  | "new_admissions"
  | "old_admissions"
  | "active_students"
  | "disabled_students"
  | "alumni_students"
  | "student_history"
  | "student_login_status"
  | "student_profile"
  | "student_gender"
  | "student_birthday"
  | "student_siblings"
  | "student_guardian"
  | "student_teacher"
  | "online_admissions"
  | "at_school_admissions";

export const STUDENT_REPORTS: Array<{
  key: StudentReportKey;
  label: string;
  description: string;
}> = [
  {
    key: "new_admissions",
    label: "New Admissions Report",
    description: "Students admitted within the selected date range",
  },
  {
    key: "old_admissions",
    label: "Old Admissions Report",
    description: "Students admitted before the selected start date",
  },
  {
    key: "active_students",
    label: "Active Students Report",
    description: "Currently active enrolled students",
  },
  {
    key: "disabled_students",
    label: "Disabled Students Report",
    description: "Disabled / blocked student records",
  },
  {
    key: "alumni_students",
    label: "Alumni Students Report",
    description: "Alumni student records",
  },
  {
    key: "student_history",
    label: "Student History Report",
    description: "Admission and enrollment history",
  },
  {
    key: "student_login_status",
    label: "Student Login Status Report",
    description: "Portal first login / channel status",
  },
  {
    key: "student_profile",
    label: "Student Profile Report",
    description: "Full student profile snapshot",
  },
  {
    key: "student_gender",
    label: "Student Gender Report",
    description: "Gender-wise student counts and roster",
  },
  {
    key: "student_birthday",
    label: "Student Birthday Report",
    description: "Upcoming / date-of-birth listing",
  },
  {
    key: "student_siblings",
    label: "Student Siblings Report",
    description: "Linked sibling groups",
  },
  {
    key: "student_guardian",
    label: "Student Guardian Report",
    description: "Guardian / parent contact details",
  },
  {
    key: "student_teacher",
    label: "Student Teacher Report",
    description: "Class teacher and subject teachers per student",
  },
  {
    key: "online_admissions",
    label: "Online Admissions Report",
    description: "Online admission applications",
  },
  {
    key: "at_school_admissions",
    label: "At School Admissions Report",
    description: "Walk-in / office admissions (not from online form)",
  },
];

function nameOf(firstName: string, lastName?: string | null) {
  return `${firstName} ${lastName ?? ""}`.trim();
}

function classLabel(
  enrollment:
    | {
        classSection: {
          academicClass: { name: string };
          section: { name: string };
        };
      }
    | null
    | undefined,
) {
  if (!enrollment) return null;
  return `${enrollment.classSection.academicClass.name} - ${enrollment.classSection.section.name}`;
}

const enrollmentInclude = {
  where: { status: EnrollmentStatus.ACTIVE },
  include: {
    academicSession: { select: { name: true } },
    classSection: {
      include: {
        academicClass: { select: { name: true } },
        section: { select: { name: true } },
        classTeacher: { select: { firstName: true, lastName: true } },
        subjects: {
          include: {
            subject: { select: { name: true } },
            teacher: { select: { firstName: true, lastName: true } },
          },
        },
      },
    },
  },
  orderBy: { enrolledAt: "desc" as const },
  take: 1,
};

async function resolveSession(tenantId: string, sessionId?: string) {
  if (sessionId) {
    return prisma.academicSession.findFirst({
      where: tenantScope(tenantId, { id: sessionId }),
      select: { id: true, name: true, startDate: true, endDate: true },
    });
  }
  return prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { isCurrent: true }),
    select: { id: true, name: true, startDate: true, endDate: true },
  });
}

export async function runStudentReport(
  tenantId: string,
  reportKey: StudentReportKey,
  query: {
    sessionId?: string;
    from?: Date;
    to?: Date;
    classSectionId?: string;
  },
) {
  const session = await resolveSession(tenantId, query.sessionId);
  const from = query.from;
  const to = query.to;

  if (reportKey === "online_admissions") {
    const apps = await prisma.onlineAdmissionApplication.findMany({
      where: tenantScope(tenantId, {
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
        ...(query.classSectionId ? { classSectionId: query.classSectionId } : {}),
        ...(session ? { OR: [{ academicSessionId: session.id }, { academicSessionId: null }] } : {}),
      }),
      include: {
        classSection: {
          include: { academicClass: true, section: true },
        },
        academicSession: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return {
      reportKey,
      title: "Online Admissions Report",
      session,
      summary: {
        total: apps.length,
        pending: apps.filter((a) => a.status === OnlineAdmissionStatus.PENDING).length,
        accepted: apps.filter((a) => a.status === OnlineAdmissionStatus.ACCEPTED).length,
        rejected: apps.filter((a) => a.status === OnlineAdmissionStatus.REJECTED).length,
      },
      rows: apps.map((app) => ({
        id: app.id,
        name: nameOf(app.firstName, app.lastName),
        gender: app.gender,
        mobile: app.mobile,
        email: app.email,
        status: app.status,
        classLabel: app.classSection
          ? `${app.classSection.academicClass.name} - ${app.classSection.section.name}`
          : null,
        session: app.academicSession?.name ?? null,
        appliedAt: app.createdAt.toISOString(),
      })),
    };
  }

  if (reportKey === "student_login_status") {
    const students = await prisma.student.findMany({
      where: tenantScope(tenantId, {
        status: StudentStatus.ACTIVE,
        ...(query.classSectionId
          ? {
              enrollments: {
                some: {
                  classSectionId: query.classSectionId,
                  status: EnrollmentStatus.ACTIVE,
                },
              },
            }
          : {}),
      }),
      include: {
        user: {
          select: {
            firstLoginAt: true,
            lastLoginAt: true,
            lastLoginChannel: true,
            email: true,
          },
        },
        enrollments: enrollmentInclude,
      },
      orderBy: [{ firstName: "asc" }],
      take: 1000,
    });
    const rows = students.map((student) => {
      const loginStatus = !student.user
        ? "NO_ACCOUNT"
        : student.user.firstLoginAt
          ? "ACTIVE"
          : "INACTIVE";
      return {
        id: student.id,
        admissionNumber: student.admissionNumber,
        name: nameOf(student.firstName, student.lastName),
        classLabel: classLabel(student.enrollments[0]),
        loginStatus,
        firstLoginAt: student.user?.firstLoginAt?.toISOString() ?? null,
        lastLoginAt: student.user?.lastLoginAt?.toISOString() ?? null,
        channel: student.user?.lastLoginChannel ?? null,
        email: student.email ?? student.user?.email ?? null,
      };
    });
    return {
      reportKey,
      title: "Student Login Status Report",
      session,
      summary: {
        total: rows.length,
        active: rows.filter((r) => r.loginStatus === "ACTIVE").length,
        inactive: rows.filter((r) => r.loginStatus === "INACTIVE").length,
        noAccount: rows.filter((r) => r.loginStatus === "NO_ACCOUNT").length,
      },
      rows,
    };
  }

  if (reportKey === "student_siblings") {
    const students = await prisma.student.findMany({
      where: tenantScope(tenantId, {
        siblingGroupId: { not: null },
        ...(query.classSectionId
          ? {
              enrollments: {
                some: {
                  classSectionId: query.classSectionId,
                  status: EnrollmentStatus.ACTIVE,
                },
              },
            }
          : {}),
      }),
      include: { enrollments: enrollmentInclude },
      orderBy: [{ siblingGroupId: "asc" }, { firstName: "asc" }],
      take: 1000,
    });
    const byGroup = new Map<string, typeof students>();
    for (const student of students) {
      const key = student.siblingGroupId!;
      const list = byGroup.get(key) ?? [];
      list.push(student);
      byGroup.set(key, list);
    }
    const rows = students.map((student) => {
      const siblings = (byGroup.get(student.siblingGroupId!) ?? []).filter(
        (s) => s.id !== student.id,
      );
      return {
        id: student.id,
        admissionNumber: student.admissionNumber,
        name: nameOf(student.firstName, student.lastName),
        classLabel: classLabel(student.enrollments[0]),
        siblingGroupId: student.siblingGroupId,
        siblings: siblings.map((s) => `${nameOf(s.firstName, s.lastName)} (${s.admissionNumber})`).join("; "),
        siblingCount: siblings.length,
      };
    });
    return {
      reportKey,
      title: "Student Siblings Report",
      session,
      summary: { total: rows.length, groups: byGroup.size },
      rows,
    };
  }

  // Shared student query for remaining reports
  const statusFilter =
    reportKey === "disabled_students"
      ? StudentStatus.DISABLED
      : reportKey === "alumni_students"
        ? StudentStatus.ALUMNI
        : reportKey === "active_students" ||
            reportKey === "student_gender" ||
            reportKey === "student_birthday" ||
            reportKey === "student_guardian" ||
            reportKey === "student_teacher" ||
            reportKey === "student_profile" ||
            reportKey === "student_history" ||
            reportKey === "new_admissions" ||
            reportKey === "old_admissions" ||
            reportKey === "at_school_admissions"
          ? reportKey === "new_admissions" ||
            reportKey === "old_admissions" ||
            reportKey === "at_school_admissions" ||
            reportKey === "student_history" ||
            reportKey === "student_profile"
            ? undefined
            : StudentStatus.ACTIVE
          : StudentStatus.ACTIVE;

  const admissionDateFilter =
    reportKey === "new_admissions" && (from || to)
      ? {
          admissionDate: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : reportKey === "old_admissions" && from
        ? { admissionDate: { lt: from } }
        : reportKey === "old_admissions" && session
          ? { admissionDate: { lt: session.startDate } }
          : {};

  const students = await prisma.student.findMany({
    where: tenantScope(tenantId, {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...admissionDateFilter,
      ...(query.classSectionId
        ? {
            enrollments: {
              some: {
                classSectionId: query.classSectionId,
                status: EnrollmentStatus.ACTIVE,
              },
            },
          }
        : {}),
      ...(reportKey === "at_school_admissions"
        ? { onlineAdmissions: { none: {} } }
        : {}),
      ...(reportKey === "student_birthday"
        ? { dateOfBirth: { not: null } }
        : {}),
    }),
    include: {
      category: { select: { name: true } },
      house: { select: { name: true } },
      user: {
        select: {
          email: true,
          firstLoginAt: true,
          lastLoginAt: true,
          lastLoginChannel: true,
        },
      },
      guardians: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        },
      },
      enrollments: {
        include: {
          academicSession: { select: { name: true } },
          classSection: {
            include: {
              academicClass: { select: { name: true } },
              section: { select: { name: true } },
              classTeacher: { select: { firstName: true, lastName: true } },
              subjects: {
                include: {
                  subject: { select: { name: true } },
                  teacher: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
        },
        orderBy: { enrolledAt: "desc" },
      },
    },
    orderBy: [{ firstName: "asc" }, { admissionNumber: "asc" }],
    take: 1000,
  });

  const title =
    STUDENT_REPORTS.find((item) => item.key === reportKey)?.label ?? "Student Report";

  if (reportKey === "student_gender") {
    const male = students.filter((s) => s.gender === "MALE").length;
    const female = students.filter((s) => s.gender === "FEMALE").length;
    const other = students.length - male - female;
    return {
      reportKey,
      title,
      session,
      summary: { total: students.length, male, female, other },
      rows: students.map((student) => ({
        id: student.id,
        admissionNumber: student.admissionNumber,
        name: nameOf(student.firstName, student.lastName),
        gender: student.gender ?? "UNKNOWN",
        classLabel: classLabel(student.enrollments[0]),
        status: student.status,
      })),
    };
  }

  if (reportKey === "student_birthday") {
    const rows = students
      .filter((s) => s.dateOfBirth)
      .map((student) => {
        const dob = student.dateOfBirth!;
        const month = dob.getUTCMonth() + 1;
        const day = dob.getUTCDate();
        return {
          id: student.id,
          admissionNumber: student.admissionNumber,
          name: nameOf(student.firstName, student.lastName),
          dateOfBirth: dob.toISOString().slice(0, 10),
          birthday: `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}`,
          classLabel: classLabel(student.enrollments[0]),
          mobile: student.mobile,
        };
      })
      .sort((a, b) => a.birthday.localeCompare(b.birthday));
    return {
      reportKey,
      title,
      session,
      summary: { total: rows.length },
      rows,
    };
  }

  if (reportKey === "student_guardian") {
    return {
      reportKey,
      title,
      session,
      summary: { total: students.length },
      rows: students.map((student) => {
        const primary = student.guardians.find((g) => g.isPrimary) ?? student.guardians[0];
        return {
          id: student.id,
          admissionNumber: student.admissionNumber,
          name: nameOf(student.firstName, student.lastName),
          classLabel: classLabel(student.enrollments[0]),
          fatherName: student.fatherName,
          fatherPhone: student.fatherPhone,
          motherName: student.motherName,
          motherPhone: student.motherPhone,
          guardianName: student.guardianName ?? (primary ? nameOf(primary.user.firstName, primary.user.lastName) : null),
          guardianPhone: student.guardianPhone ?? primary?.user.phone ?? null,
          guardianEmail: student.guardianEmail ?? primary?.user.email ?? null,
          guardianRelation: student.guardianRelation ?? primary?.relation ?? null,
        };
      }),
    };
  }

  if (reportKey === "student_teacher") {
    return {
      reportKey,
      title,
      session,
      summary: { total: students.length },
      rows: students.map((student) => {
        const enrollment = student.enrollments[0];
        const classTeacher = enrollment?.classSection.classTeacher
          ? nameOf(
              enrollment.classSection.classTeacher.firstName,
              enrollment.classSection.classTeacher.lastName,
            )
          : null;
        const subjectTeachers = (enrollment?.classSection.subjects ?? [])
          .filter((s) => s.teacher)
          .map(
            (s) =>
              `${s.subject.name}: ${nameOf(s.teacher!.firstName, s.teacher!.lastName)}`,
          )
          .join("; ");
        return {
          id: student.id,
          admissionNumber: student.admissionNumber,
          name: nameOf(student.firstName, student.lastName),
          classLabel: classLabel(enrollment),
          classTeacher,
          subjectTeachers: subjectTeachers || null,
        };
      }),
    };
  }

  if (reportKey === "student_history") {
    return {
      reportKey,
      title,
      session,
      summary: { total: students.length },
      rows: students.map((student) => ({
        id: student.id,
        admissionNumber: student.admissionNumber,
        name: nameOf(student.firstName, student.lastName),
        status: student.status,
        admissionDate: student.admissionDate.toISOString().slice(0, 10),
        disabledReason: student.disabledReason,
        enrollments: student.enrollments
          .map(
            (e) =>
              `${e.academicSession.name}: ${e.classSection.academicClass.name}-${e.classSection.section.name} (${e.status})`,
          )
          .join("; "),
        createdAt: student.createdAt.toISOString(),
        updatedAt: student.updatedAt.toISOString(),
      })),
    };
  }

  if (reportKey === "student_profile") {
    return {
      reportKey,
      title,
      session,
      summary: { total: students.length },
      rows: students.map((student) => ({
        id: student.id,
        admissionNumber: student.admissionNumber,
        name: nameOf(student.firstName, student.lastName),
        gender: student.gender,
        dateOfBirth: student.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        mobile: student.mobile,
        email: student.email,
        status: student.status,
        category: student.category?.name ?? null,
        house: student.house?.name ?? null,
        admissionDate: student.admissionDate.toISOString().slice(0, 10),
        admissionType: student.admissionType,
        classLabel: classLabel(student.enrollments[0]),
        fatherName: student.fatherName,
        motherName: student.motherName,
        guardianName: student.guardianName,
        currentAddress: student.currentAddress,
      })),
    };
  }

  // active / disabled / alumni / new / old / at_school
  return {
    reportKey,
    title,
    session,
    summary: { total: students.length },
    rows: students.map((student) => ({
      id: student.id,
      admissionNumber: student.admissionNumber,
      name: nameOf(student.firstName, student.lastName),
      gender: student.gender,
      mobile: student.mobile,
      email: student.email,
      status: student.status,
      admissionDate: student.admissionDate.toISOString().slice(0, 10),
      classLabel: classLabel(student.enrollments[0]),
      session: student.enrollments[0]?.academicSession.name ?? null,
      disabledReason: student.disabledReason,
      category: student.category?.name ?? null,
    })),
  };
}
