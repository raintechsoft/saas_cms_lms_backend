import type { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { getSettings } from "./settings.service.js";

export type SchoolProfileBranding = {
  logoText?: string;
  logoUrl?: string;
  tagline?: string;
  frontDisplayName?: string;
  website?: string;
  establishedYear?: string;
  affiliation?: string;
  schoolCode?: string;
  primaryColor?: string;
  customDomain?: string;
};

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getSchoolProfile(tenantId: string) {
  const [tenant, settings, students, staff, session] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, status: true, branding: true },
    }),
    getSettings(tenantId),
    prisma.student.count({ where: { tenantId, status: "ACTIVE" } }),
    prisma.user.count({
      where: {
        tenantId,
        status: "ACTIVE",
        roles: { some: { role: { code: { in: ["TEACHER", "STAFF", "ACCOUNTANT", "INSTITUTION_ADMIN"] } } } },
      },
    }),
    prisma.academicSession.findFirst({
      where: { tenantId, isCurrent: true },
      select: { id: true, name: true },
    }),
  ]);

  if (!tenant) throw new AppError(404, "Tenant not found", "TENANT_NOT_FOUND");

  const branding = asObject(tenant.branding);

  return {
    institutionName: tenant.name,
    frontDisplayName: str(branding.frontDisplayName) ?? tenant.name,
    tagline: str(branding.tagline) ?? str(branding.logoText) ?? "",
    address: settings.address,
    email: settings.email,
    phone: settings.phone,
    website: str(branding.website),
    establishedYear: str(branding.establishedYear),
    affiliation: str(branding.affiliation),
    schoolCode: str(branding.schoolCode) ?? tenant.slug.toUpperCase(),
    logoUrl: str(branding.logoUrl),
    status: tenant.status,
    stats: {
      students,
      staff,
      sessionName: session?.name ?? null,
    },
  };
}

export type UpdateSchoolProfileInput = {
  institutionName?: string;
  frontDisplayName?: string | null;
  tagline?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  establishedYear?: string | null;
  affiliation?: string | null;
  schoolCode?: string | null;
  logoUrl?: string | null;
};

export async function updateSchoolProfile(tenantId: string, input: UpdateSchoolProfileInput) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, branding: true },
  });
  if (!tenant) throw new AppError(404, "Tenant not found", "TENANT_NOT_FOUND");

  const current = asObject(tenant.branding);
  const nextBranding: Record<string, unknown> = { ...current };

  const brandingKeys: Array<keyof UpdateSchoolProfileInput> = [
    "frontDisplayName",
    "tagline",
    "website",
    "establishedYear",
    "affiliation",
    "schoolCode",
    "logoUrl",
  ];
  for (const key of brandingKeys) {
    if (input[key] !== undefined) {
      const value = input[key];
      if (value == null || value === "") delete nextBranding[key];
      else nextBranding[key] = String(value).trim();
    }
  }
  // Keep logoText in sync with tagline for older shell consumers
  if (input.tagline !== undefined) {
    if (input.tagline) nextBranding.logoText = input.tagline.trim();
  }

  await prisma.$transaction(async (tx) => {
    if (input.institutionName !== undefined) {
      const name = input.institutionName.trim();
      if (!name) throw new AppError(400, "Institution name is required", "INSTITUTION_NAME_REQUIRED");
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          name,
          branding: nextBranding as Prisma.InputJsonValue,
        },
      });
    } else {
      await tx.tenant.update({
        where: { id: tenantId },
        data: { branding: nextBranding as Prisma.InputJsonValue },
      });
    }

    if (
      input.address !== undefined ||
      input.email !== undefined ||
      input.phone !== undefined
    ) {
      await tx.tenantSetting.upsert({
        where: { tenantId },
        create: {
          tenantId,
          address: input.address ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
        },
        update: {
          ...(input.address !== undefined ? { address: input.address } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
        },
      });
    }
  });

  return getSchoolProfile(tenantId);
}
