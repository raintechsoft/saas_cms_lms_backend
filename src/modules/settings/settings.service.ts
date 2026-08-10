import type {
  AttendanceType,
  ExamResultDisplayType,
  ExamResultType,
  OnlineExamViewMode,
  Prisma,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

export interface UpdateSettingsInput {
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  currency?: string;
  timezone?: string;
  dateFormat?: string;
  attendanceType?: AttendanceType;
  biometricAttendanceEnabled?: boolean;
  autoAdmissionNumber?: boolean;
  admissionPrefix?: string | null;
  admissionNumberDigits?: number;
  nextAdmissionNumber?: number;
  autoStaffNumber?: boolean;
  staffPrefix?: string | null;
  staffNumberDigits?: number;
  nextStaffNumber?: number;
  teacherRestricted?: boolean;
  examResultType?: ExamResultType;
  examResultDisplayType?: ExamResultDisplayType;
  onlineExamViewMode?: OnlineExamViewMode;
  onlineAdmission?: boolean;
  onlineAdmissionRequirePayment?: boolean;
  onlineAdmissionFeeTypeId?: string | null;
  liveClassAutoAttendance?: boolean;
  attendancePresentPoints?: number;
  attendanceHalfDayPoints?: number;
  attendanceLatePoints?: number;
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
  biometricAttendanceEnabled: true,
  autoAdmissionNumber: true,
  admissionPrefix: true,
  admissionNumberDigits: true,
  nextAdmissionNumber: true,
  autoStaffNumber: true,
  staffPrefix: true,
  staffNumberDigits: true,
  nextStaffNumber: true,
  teacherRestricted: true,
  examResultType: true,
  examResultDisplayType: true,
  onlineExamViewMode: true,
  onlineAdmission: true,
  onlineAdmissionRequirePayment: true,
  onlineAdmissionFeeTypeId: true,
  liveClassAutoAttendance: true,
  attendancePresentPoints: true,
  attendanceHalfDayPoints: true,
  attendanceLatePoints: true,
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

export async function updateSettings(tenantId: string, input: UpdateSettingsInput) {
  if (input.onlineAdmissionFeeTypeId) {
    const feeType = await prisma.feeType.findFirst({
      where: { tenantId, id: input.onlineAdmissionFeeTypeId, isActive: true },
      select: { id: true },
    });
    if (!feeType) {
      throw new AppError(400, "Selected fee type is invalid", "INVALID_FEE_TYPE");
    }
  }

  return prisma.tenantSetting.upsert({
    where: { tenantId },
    create: { tenantId, ...input },
    update: input,
    select: settingsSelect,
  });
}
