import {
  HomeworkAutoReminderMode,
  HomeworkDueDateBehavior,
  HomeworkLatePenaltyType,
  HomeworkReminderUnit,
  HomeworkSubmissionStartMode,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

const DEFAULT_FILE_TYPES = ["PDF", "DOC", "DOCX", "JPG", "PNG"];

const DEFAULT_TYPES: Array<{ name: string; description: string; isActive: boolean; sortOrder: number }> = [
  { name: "Classwork", description: "Work completed during class hours", isActive: true, sortOrder: 1 },
  { name: "Project Work", description: "Longer project-based assignments", isActive: true, sortOrder: 2 },
  { name: "Worksheet", description: "Practice worksheet for revision", isActive: true, sortOrder: 3 },
  { name: "Assignment", description: "Standard homework assignment", isActive: true, sortOrder: 4 },
  { name: "Practical Work", description: "Lab or practical tasks", isActive: true, sortOrder: 5 },
  { name: "Reading Assignment", description: "Reading and comprehension tasks", isActive: true, sortOrder: 6 },
];

const DEFAULT_STATUSES: Array<{
  name: string;
  description: string;
  color: string;
  isFinal: boolean;
  sortOrder: number;
}> = [
  { name: "Assigned", description: "Homework has been assigned to students", color: "#3B82F6", isFinal: false, sortOrder: 1 },
  { name: "Submitted", description: "Student has submitted the homework", color: "#22C55E", isFinal: false, sortOrder: 2 },
  { name: "Under Review", description: "Teacher is reviewing the submission", color: "#06B6D4", isFinal: false, sortOrder: 3 },
  { name: "Graded", description: "Homework has been graded", color: "#8B5CF6", isFinal: true, sortOrder: 4 },
  { name: "Returned", description: "Returned to student for corrections", color: "#F97316", isFinal: false, sortOrder: 5 },
  { name: "Not Submitted", description: "Student did not submit", color: "#EF4444", isFinal: true, sortOrder: 6 },
];

function money(value: unknown) {
  return Number(value ?? 0);
}

function normalizeFileTypes(types?: string[]) {
  if (!types) return DEFAULT_FILE_TYPES;
  const cleaned = [...new Set(types.map((t) => t.trim().toUpperCase()).filter(Boolean))];
  return cleaned.length ? cleaned : DEFAULT_FILE_TYPES;
}

async function ensureDefaults(tenantId: string) {
  const [typeCount, statusCount] = await Promise.all([
    prisma.homeworkType.count({ where: { tenantId } }),
    prisma.homeworkWorkflowStatus.count({ where: { tenantId } }),
  ]);

  if (!typeCount) {
    await prisma.homeworkType.createMany({
      data: DEFAULT_TYPES.map((item) => ({ tenantId, ...item })),
    });
  }
  if (!statusCount) {
    await prisma.homeworkWorkflowStatus.createMany({
      data: DEFAULT_STATUSES.map((item) => ({ tenantId, ...item, isActive: true })),
    });
  }
}

async function getOrCreateSetting(tenantId: string) {
  return prisma.tenantHomeworkSetting.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  });
}

export async function getHomeworkSettingsSetup(tenantId: string) {
  await ensureDefaults(tenantId);
  const [settings, types, statuses, moduleRow] = await Promise.all([
    getOrCreateSetting(tenantId),
    prisma.homeworkType.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.homeworkWorkflowStatus.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.tenantModuleSetting.findUnique({
      where: { tenantId_moduleKey: { tenantId, moduleKey: "homework" } },
    }),
  ]);

  return {
    settings: {
      moduleEnabled: moduleRow?.adminEnabled ?? settings.moduleEnabled,
      allowTeachersAssign: settings.allowTeachersAssign,
      allowAttachments: settings.allowAttachments,
      allowOnlineSubmission: settings.allowOnlineSubmission,
      allowLateSubmission: settings.allowLateSubmission,
      latePenaltyValue: money(settings.latePenaltyValue),
      latePenaltyType: settings.latePenaltyType,
      allowPortalView: settings.allowPortalView,
      submissionStartsFrom: settings.submissionStartsFrom,
      dueDateBehavior: settings.dueDateBehavior,
      graceDays: settings.graceDays,
      reminderBeforeValue: settings.reminderBeforeValue,
      reminderBeforeUnit: settings.reminderBeforeUnit,
      autoReminderMode: settings.autoReminderMode,
      maxFileSizeMb: settings.maxFileSizeMb,
      allowedFileTypes: settings.allowedFileTypes.length
        ? settings.allowedFileTypes
        : DEFAULT_FILE_TYPES,
    },
    types,
    statuses,
  };
}

export async function updateHomeworkSettings(
  tenantId: string,
  input: {
    moduleEnabled?: boolean;
    allowTeachersAssign?: boolean;
    allowAttachments?: boolean;
    allowOnlineSubmission?: boolean;
    allowLateSubmission?: boolean;
    latePenaltyValue?: number;
    latePenaltyType?: HomeworkLatePenaltyType;
    allowPortalView?: boolean;
    submissionStartsFrom?: HomeworkSubmissionStartMode;
    dueDateBehavior?: HomeworkDueDateBehavior;
    graceDays?: number;
    reminderBeforeValue?: number;
    reminderBeforeUnit?: HomeworkReminderUnit;
    autoReminderMode?: HomeworkAutoReminderMode;
    maxFileSizeMb?: number;
    allowedFileTypes?: string[];
  },
) {
  await getOrCreateSetting(tenantId);

  if (input.moduleEnabled !== undefined) {
    await prisma.tenantModuleSetting.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey: "homework" } },
      create: {
        tenantId,
        moduleKey: "homework",
        adminEnabled: input.moduleEnabled,
        studentEnabled: input.moduleEnabled,
        parentEnabled: input.moduleEnabled,
      },
      update: {
        adminEnabled: input.moduleEnabled,
        studentEnabled: input.moduleEnabled,
        parentEnabled: input.moduleEnabled,
      },
    });
  }

  await prisma.tenantHomeworkSetting.update({
    where: { tenantId },
    data: {
      moduleEnabled: input.moduleEnabled,
      allowTeachersAssign: input.allowTeachersAssign,
      allowAttachments: input.allowAttachments,
      allowOnlineSubmission: input.allowOnlineSubmission,
      allowLateSubmission: input.allowLateSubmission,
      latePenaltyValue: input.latePenaltyValue,
      latePenaltyType: input.latePenaltyType,
      allowPortalView: input.allowPortalView,
      submissionStartsFrom: input.submissionStartsFrom,
      dueDateBehavior: input.dueDateBehavior,
      graceDays: input.graceDays,
      reminderBeforeValue: input.reminderBeforeValue,
      reminderBeforeUnit: input.reminderBeforeUnit,
      autoReminderMode: input.autoReminderMode,
      maxFileSizeMb: input.maxFileSizeMb,
      allowedFileTypes: input.allowedFileTypes
        ? normalizeFileTypes(input.allowedFileTypes)
        : undefined,
    },
  });

  return getHomeworkSettingsSetup(tenantId);
}

export async function createHomeworkType(
  tenantId: string,
  input: { name: string; description?: string | null; isActive?: boolean },
) {
  const name = input.name.trim();
  const exists = await prisma.homeworkType.findFirst({
    where: tenantScope(tenantId, { name }),
    select: { id: true },
  });
  if (exists) throw new AppError(409, `Homework type "${name}" already exists`, "HOMEWORK_TYPE_EXISTS");

  const maxSort = await prisma.homeworkType.aggregate({
    where: { tenantId },
    _max: { sortOrder: true },
  });

  return prisma.homeworkType.create({
    data: {
      tenantId,
      name,
      description: input.description?.trim() || null,
      isActive: input.isActive ?? true,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
}

export async function updateHomeworkType(
  tenantId: string,
  id: string,
  input: { name?: string; description?: string | null; isActive?: boolean },
) {
  const existing = await prisma.homeworkType.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!existing) throw new AppError(404, "Homework type not found", "HOMEWORK_TYPE_NOT_FOUND");

  if (input.name) {
    const clash = await prisma.homeworkType.findFirst({
      where: tenantScope(tenantId, { name: input.name.trim(), id: { not: id } }),
      select: { id: true },
    });
    if (clash) {
      throw new AppError(409, `Homework type "${input.name.trim()}" already exists`, "HOMEWORK_TYPE_EXISTS");
    }
  }

  return prisma.homeworkType.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      description: input.description === undefined ? undefined : input.description?.trim() || null,
      isActive: input.isActive,
    },
  });
}

export async function deleteHomeworkType(tenantId: string, id: string) {
  const existing = await prisma.homeworkType.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true },
  });
  if (!existing) throw new AppError(404, "Homework type not found", "HOMEWORK_TYPE_NOT_FOUND");
  await prisma.homeworkType.delete({ where: { id } });
  return { ok: true };
}

export async function createHomeworkWorkflowStatus(
  tenantId: string,
  input: {
    name: string;
    description?: string | null;
    color?: string;
    isFinal?: boolean;
    isActive?: boolean;
  },
) {
  const name = input.name.trim();
  const exists = await prisma.homeworkWorkflowStatus.findFirst({
    where: tenantScope(tenantId, { name }),
    select: { id: true },
  });
  if (exists) throw new AppError(409, `Status "${name}" already exists`, "HOMEWORK_STATUS_EXISTS");

  const maxSort = await prisma.homeworkWorkflowStatus.aggregate({
    where: { tenantId },
    _max: { sortOrder: true },
  });

  return prisma.homeworkWorkflowStatus.create({
    data: {
      tenantId,
      name,
      description: input.description?.trim() || null,
      color: input.color?.trim() || "#6366F1",
      isFinal: input.isFinal ?? false,
      isActive: input.isActive ?? true,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
}

export async function updateHomeworkWorkflowStatus(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    description?: string | null;
    color?: string;
    isFinal?: boolean;
    isActive?: boolean;
  },
) {
  const existing = await prisma.homeworkWorkflowStatus.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!existing) throw new AppError(404, "Homework status not found", "HOMEWORK_STATUS_NOT_FOUND");

  if (input.name) {
    const clash = await prisma.homeworkWorkflowStatus.findFirst({
      where: tenantScope(tenantId, { name: input.name.trim(), id: { not: id } }),
      select: { id: true },
    });
    if (clash) {
      throw new AppError(409, `Status "${input.name.trim()}" already exists`, "HOMEWORK_STATUS_EXISTS");
    }
  }

  return prisma.homeworkWorkflowStatus.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      description: input.description === undefined ? undefined : input.description?.trim() || null,
      color: input.color?.trim(),
      isFinal: input.isFinal,
      isActive: input.isActive,
    },
  });
}

export async function deleteHomeworkWorkflowStatus(tenantId: string, id: string) {
  const existing = await prisma.homeworkWorkflowStatus.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true, isFinal: true },
  });
  if (!existing) throw new AppError(404, "Homework status not found", "HOMEWORK_STATUS_NOT_FOUND");
  if (existing.isFinal) {
    throw new AppError(400, "Final status cannot be deleted", "HOMEWORK_STATUS_FINAL");
  }
  await prisma.homeworkWorkflowStatus.delete({ where: { id } });
  return { ok: true };
}
