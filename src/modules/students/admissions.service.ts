import {
  CustomFieldTarget,
  OnlineAdmissionStatus,
  type Gender,
  type Prisma,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import { createStudent } from "./students.service.js";

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

export async function getPublicAdmissionForm(tenantSlug: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug.toLowerCase() },
    include: { setting: true },
  });
  if (!tenant || tenant.status !== "ACTIVE") {
    throw new AppError(404, "Institution not found", "TENANT_NOT_FOUND");
  }
  if (!tenant.setting?.onlineAdmission) {
    throw new AppError(403, "Online admission is disabled for this institution", "ADMISSION_DISABLED");
  }
  const [currentSession, classSections, customFields] = await Promise.all([
    prisma.academicSession.findFirst({
      where: tenantScope(tenant.id, { isCurrent: true }),
    }),
    prisma.classSection.findMany({
      where: tenantScope(tenant.id, { academicSession: { isCurrent: true } }),
      include: { academicClass: true, section: true },
      orderBy: [{ academicClass: { sortOrder: "asc" } }, { section: { name: "asc" } }],
    }),
    prisma.customField.findMany({
      where: tenantScope(tenant.id, { target: CustomFieldTarget.ADMISSION, isActive: true }),
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      branding: tenant.branding,
      type: tenant.type,
    },
    currentSession,
    classSections: classSections.map((item) => ({
      id: item.id,
      label: `${item.academicClass.name} - ${item.section.name}`,
    })),
    customFields: customFields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      options: field.options,
      isRequired: field.isRequired,
    })),
  };
}

export async function submitPublicAdmission(
  tenantSlug: string,
  input: {
    firstName: string;
    lastName?: string | null;
    gender?: Gender | null;
    dateOfBirth?: Date | null;
    mobile?: string | null;
    email?: string | null;
    fatherName?: string | null;
    motherName?: string | null;
    guardianPhone?: string | null;
    currentAddress?: string | null;
    classSectionId?: string | null;
    payload?: Record<string, unknown>;
  },
) {
  const form = await getPublicAdmissionForm(tenantSlug);
  if (input.classSectionId && !form.classSections.some((item) => item.id === input.classSectionId)) {
    throw new AppError(400, "Invalid preferred class", "INVALID_CLASS_SECTION");
  }
  return prisma.onlineAdmissionApplication.create({
    data: {
      tenantId: form.tenant.id,
      academicSessionId: form.currentSession?.id ?? null,
      classSectionId: input.classSectionId ?? null,
      firstName: input.firstName.trim(),
      lastName: input.lastName?.trim() || null,
      gender: input.gender ?? null,
      dateOfBirth: input.dateOfBirth ?? null,
      mobile: input.mobile?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      fatherName: input.fatherName?.trim() || null,
      motherName: input.motherName?.trim() || null,
      guardianPhone: input.guardianPhone?.trim() || null,
      currentAddress: input.currentAddress?.trim() || null,
      payload: asJson(input.payload),
    },
  });
}

export async function listOnlineAdmissions(tenantId: string, status?: OnlineAdmissionStatus) {
  return prisma.onlineAdmissionApplication.findMany({
    where: tenantScope(tenantId, { status }),
    include: {
      classSection: { include: { academicClass: true, section: true } },
      student: { select: { id: true, admissionNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function acceptOnlineAdmission(
  tenantId: string,
  applicationId: string,
  reviewerId: string,
  input: { note?: string | null; classSectionId?: string },
) {
  const application = await prisma.onlineAdmissionApplication.findFirst({
    where: tenantScope(tenantId, { id: applicationId }),
  });
  if (!application) throw new AppError(404, "Application not found", "ADMISSION_NOT_FOUND");
  if (application.status !== OnlineAdmissionStatus.PENDING) {
    throw new AppError(409, "Application already reviewed", "ADMISSION_REVIEWED");
  }
  const classSectionId = input.classSectionId ?? application.classSectionId;
  if (!classSectionId) {
    throw new AppError(400, "Class section is required to accept admission", "CLASS_REQUIRED");
  }
  const student = await createStudent(tenantId, {
    firstName: application.firstName,
    lastName: application.lastName,
    gender: application.gender,
    dateOfBirth: application.dateOfBirth,
    mobile: application.mobile,
    email: application.email,
    fatherName: application.fatherName,
    motherName: application.motherName,
    guardianPhone: application.guardianPhone,
    currentAddress: application.currentAddress,
    admissionDate: new Date(),
    classSectionId,
  });
  return prisma.onlineAdmissionApplication.update({
    where: { id: application.id },
    data: {
      status: OnlineAdmissionStatus.ACCEPTED,
      reviewNote: input.note?.trim() || null,
      reviewedById: reviewerId,
      studentId: student.id,
      classSectionId,
    },
    include: { student: true },
  });
}

export async function rejectOnlineAdmission(
  tenantId: string,
  applicationId: string,
  reviewerId: string,
  note?: string | null,
) {
  const application = await prisma.onlineAdmissionApplication.findFirst({
    where: tenantScope(tenantId, { id: applicationId }),
  });
  if (!application) throw new AppError(404, "Application not found", "ADMISSION_NOT_FOUND");
  if (application.status !== OnlineAdmissionStatus.PENDING) {
    throw new AppError(409, "Application already reviewed", "ADMISSION_REVIEWED");
  }
  return prisma.onlineAdmissionApplication.update({
    where: { id: application.id },
    data: {
      status: OnlineAdmissionStatus.REJECTED,
      reviewNote: note?.trim() || null,
      reviewedById: reviewerId,
    },
  });
}
