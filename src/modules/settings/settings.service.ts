import type { AttendanceType, ExamResultType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

export interface UpdateSettingsInput {
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  currency?: string;
  timezone?: string;
  dateFormat?: string;
  attendanceType?: AttendanceType;
  autoAdmissionNumber?: boolean;
  admissionPrefix?: string | null;
  autoStaffNumber?: boolean;
  staffPrefix?: string | null;
  teacherRestricted?: boolean;
  examResultType?: ExamResultType;
  onlineAdmission?: boolean;
  liveClassAutoAttendance?: boolean;
}

const settingsSelect = {
  id: true,
  tenantId: true,
  address: true,
  phone: true,
  email: true,
  currency: true,
  timezone: true,
  dateFormat: true,
  attendanceType: true,
  autoAdmissionNumber: true,
  admissionPrefix: true,
  nextAdmissionNumber: true,
  autoStaffNumber: true,
  staffPrefix: true,
  nextStaffNumber: true,
  teacherRestricted: true,
  examResultType: true,
  onlineAdmission: true,
  liveClassAutoAttendance: true,
  updatedAt: true,
} satisfies Prisma.TenantSettingSelect;

export function getSettings(tenantId: string) {
  return prisma.tenantSetting.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
    select: settingsSelect,
  });
}

export function updateSettings(tenantId: string, input: UpdateSettingsInput) {
  return prisma.tenantSetting.upsert({
    where: { tenantId },
    create: { tenantId, ...input },
    update: input,
    select: settingsSelect,
  });
}
