import { EnrollmentStatus, ProductMode } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

export interface PortalViewer {
  userId: string;
  roles: string[];
}

const studentInclude = {
  category: true,
  house: true,
  transportRouteRef: {
    select: {
      id: true,
      name: true,
      code: true,
      vehicleNumber: true,
      driverName: true,
      driverPhone: true,
      stops: true,
    },
  },
  hostelBedRef: {
    select: { id: true, label: true },
  },
  hostelRoomRef: {
    select: {
      id: true,
      name: true,
      block: { select: { id: true, name: true, gender: true } },
    },
  },
  enrollments: {
    where: { status: EnrollmentStatus.ACTIVE },
    include: {
      academicSession: true,
      classSection: {
        include: { academicClass: true, section: true, classTeacher: true },
      },
    },
    orderBy: { enrolledAt: "desc" as const },
  },
} as const;

export async function resolveAccessibleStudents(tenantId: string, viewer: PortalViewer) {
  if (viewer.roles.includes("STUDENT")) {
    const student = await prisma.student.findFirst({
      where: tenantScope(tenantId, { userId: viewer.userId }),
      include: studentInclude,
    });
    return student
      ? [{ student, relation: "SELF" as string | null, isPrimary: true }]
      : [];
  }
  if (viewer.roles.includes("PARENT")) {
    const links = await prisma.studentGuardian.findMany({
      where: tenantScope(tenantId, { userId: viewer.userId }),
      include: { student: { include: studentInclude } },
      orderBy: { isPrimary: "desc" },
    });
    return links.map((link) => ({
      student: link.student,
      relation: link.relation,
      isPrimary: link.isPrimary,
    }));
  }
  return [];
}

export type AccessibleLink = Awaited<ReturnType<typeof resolveAccessibleStudents>>[number];
export type AccessibleStudent = AccessibleLink["student"];

export function currentEnrollment(student: AccessibleStudent) {
  return (
    student.enrollments.find((item) => item.academicSession.isCurrent) ??
    student.enrollments[0] ??
    null
  );
}

export async function assertAccessibleStudent(
  tenantId: string,
  viewer: PortalViewer,
  studentId: string,
) {
  const links = await resolveAccessibleStudents(tenantId, viewer);
  const match = links.find((link) => link.student.id === studentId);
  if (!match) throw new AppError(403, "Student is not accessible", "PORTAL_FORBIDDEN");
  return match;
}

export function portalRole(viewer: PortalViewer): "STUDENT" | "PARENT" {
  if (viewer.roles.includes("STUDENT")) return "STUDENT";
  if (viewer.roles.includes("PARENT")) return "PARENT";
  throw new AppError(403, "Portal is available to students and parents", "PORTAL_FORBIDDEN");
}

export function assertProductMode(
  productMode: ProductMode | null,
  needed: "CMS" | "LMS" | "SHARED",
) {
  if (!productMode) {
    throw new AppError(403, `${needed} is not enabled for this tenant`, "MODULE_NOT_ENTITLED");
  }
  if (needed === "SHARED") return;
  if (productMode !== "BOTH" && productMode !== needed) {
    throw new AppError(403, `${needed} is not enabled for this tenant`, "MODULE_NOT_ENTITLED");
  }
}
