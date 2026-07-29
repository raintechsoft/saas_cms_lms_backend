import { NotificationType, Prisma, UserStatus } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import {
  sendFeeRemindersForSession,
  type FeeReminderStep,
} from "../notifications/fee-reminders.js";

export type ReminderStepInput = {
  id?: string;
  days: number;
  when: "before" | "after";
  notice: string;
  email: boolean;
  sms: boolean;
};

export type FeeReminderSettingsInput = {
  autoReminder: boolean;
  reminderDaysBefore: number;
  reminderDaysAfter: number;
  reminderEmailEnabled?: boolean;
  reminderSmsEnabled?: boolean;
  reminderExecutionTime?: string;
  reminderSkipWeekends?: boolean;
  reminderMinBalance?: boolean;
  reminderSteps?: ReminderStepInput[];
};

function normalizeExecutionTime(value?: string) {
  const raw = (value ?? "09:00").trim();
  if (!/^\d{2}:\d{2}$/.test(raw)) {
    throw new AppError(400, "Execution time must be HH:mm", "INVALID_EXECUTION_TIME");
  }
  return raw;
}

export function updateFeeReminder(tenantId: string, input: FeeReminderSettingsInput) {
  const steps = (input.reminderSteps ?? []).map((step) => ({
    days: Math.max(0, Math.min(90, Math.trunc(Number(step.days) || 0))),
    when: step.when === "before" ? "before" : "after",
    notice: String(step.notice || "Fee reminder").slice(0, 120),
    email: Boolean(step.email),
    sms: Boolean(step.sms),
  }));

  const before =
    steps.find((s) => s.when === "before")?.days ?? input.reminderDaysBefore;
  const after =
    steps.find((s) => s.when === "after")?.days ?? input.reminderDaysAfter;

  const reminderStepsJson: Prisma.InputJsonValue = steps;

  return prisma.tenantFeeSetting.upsert({
    where: { tenantId },
    create: {
      tenantId,
      autoReminder: input.autoReminder,
      reminderDaysBefore: before,
      reminderDaysAfter: after,
      reminderEmailEnabled: input.reminderEmailEnabled ?? true,
      reminderSmsEnabled: input.reminderSmsEnabled ?? true,
      reminderExecutionTime: normalizeExecutionTime(input.reminderExecutionTime),
      reminderSkipWeekends: input.reminderSkipWeekends ?? true,
      reminderMinBalance: input.reminderMinBalance ?? true,
      reminderSteps: reminderStepsJson,
    },
    update: {
      autoReminder: input.autoReminder,
      reminderDaysBefore: before,
      reminderDaysAfter: after,
      reminderEmailEnabled: input.reminderEmailEnabled ?? true,
      reminderSmsEnabled: input.reminderSmsEnabled ?? true,
      reminderExecutionTime: normalizeExecutionTime(input.reminderExecutionTime),
      reminderSkipWeekends: input.reminderSkipWeekends ?? true,
      reminderMinBalance: input.reminderMinBalance ?? true,
      reminderSteps: reminderStepsJson,
    },
  });
}

async function resolveActorId(tenantId: string) {
  const admin = await prisma.user.findFirst({
    where: tenantScope(tenantId, {
      status: UserStatus.ACTIVE,
      roles: { some: { role: { code: "INSTITUTION_ADMIN" } } },
    }),
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    throw new AppError(400, "No institution admin available to send reminders", "NO_ADMIN");
  }
  return admin.id;
}

export async function runFeeRemindersNow(tenantId: string, actorUserId: string, sessionId?: string) {
  const setting = await prisma.tenantFeeSetting.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  });

  const session = sessionId
    ? await prisma.academicSession.findFirst({
        where: tenantScope(tenantId, { id: sessionId }),
        select: { id: true, name: true },
      })
    : await prisma.academicSession.findFirst({
        where: tenantScope(tenantId, { isCurrent: true }),
        select: { id: true, name: true },
      });
  if (!session) throw new AppError(404, "Academic session not found", "SESSION_NOT_FOUND");

  const result = await sendFeeRemindersForSession(tenantId, actorUserId, session.id, {
    mode: "all_due",
    sendEmail: setting.reminderEmailEnabled !== false,
    sendSms: setting.reminderSmsEnabled !== false,
    minBalance: setting.reminderMinBalance ? 5 : 0,
    title: "Fee payment reminder",
  });

  await prisma.tenantFeeSetting.update({
    where: { tenantId },
    data: { lastReminderRunAt: new Date() },
  });

  return { ...result, sessionId: session.id, sessionName: session.name };
}

export async function sendStudentFeeReminder(
  tenantId: string,
  actorUserId: string,
  studentId: string,
  sessionId?: string,
) {
  const session = sessionId
    ? await prisma.academicSession.findFirst({
        where: tenantScope(tenantId, { id: sessionId }),
        select: { id: true, name: true },
      })
    : await prisma.academicSession.findFirst({
        where: tenantScope(tenantId, { isCurrent: true }),
        select: { id: true, name: true },
      });
  if (!session) throw new AppError(404, "Academic session not found", "SESSION_NOT_FOUND");

  const student = await prisma.student.findFirst({
    where: tenantScope(tenantId, { id: studentId }),
    select: { id: true },
  });
  if (!student) throw new AppError(404, "Student not found", "STUDENT_NOT_FOUND");

  const setting = await prisma.tenantFeeSetting.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  });
  const result = await sendFeeRemindersForSession(tenantId, actorUserId, session.id, {
    mode: "all_due",
    studentId,
    sendEmail: setting.reminderEmailEnabled !== false,
    sendSms: setting.reminderSmsEnabled !== false,
    minBalance: 0,
    title: "Fee payment reminder",
  });
  return { ...result, studentId, sessionId: session.id, sessionName: session.name };
}

export async function getFeeReminderStats(tenantId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [sentMtd, lastSent] = await Promise.all([
    prisma.notification.count({
      where: tenantScope(tenantId, {
        type: NotificationType.FEE_OVERDUE,
        createdAt: { gte: monthStart },
      }),
    }),
    prisma.notification.findFirst({
      where: tenantScope(tenantId, { type: NotificationType.FEE_OVERDUE }),
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  return { sentMtd, lastSentAt: lastSent?.createdAt ?? null };
}

function parseSteps(setting: {
  reminderSteps: Prisma.JsonValue | null;
  reminderDaysBefore: number;
  reminderDaysAfter: number;
  reminderEmailEnabled: boolean;
  reminderSmsEnabled: boolean;
}): FeeReminderStep[] {
  const raw = setting.reminderSteps;
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((item) => {
        const row = (item ?? {}) as Record<string, unknown>;
        return {
          days: Math.max(0, Math.trunc(Number(row.days) || 0)),
          when: row.when === "before" ? ("before" as const) : ("after" as const),
          notice: String(row.notice || "Fee reminder"),
          email: Boolean(row.email) && setting.reminderEmailEnabled,
          sms: Boolean(row.sms) && setting.reminderSmsEnabled,
        };
      })
      .filter((step) => step.email || step.sms);
  }
  return [
    {
      days: setting.reminderDaysBefore,
      when: "before" as const,
      notice: "Initial Due Notice",
      email: setting.reminderEmailEnabled,
      sms: false,
    },
    {
      days: setting.reminderDaysAfter,
      when: "after" as const,
      notice: "Urgent Payment Reminder",
      email: setting.reminderEmailEnabled,
      sms: setting.reminderSmsEnabled,
    },
  ].filter((step) => step.email || step.sms);
}

function sameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function localHhMm(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Runs once per minute from server bootstrap. */
export async function processScheduledFeeReminders() {
  const now = new Date();
  const hhmm = localHhMm(now);
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  const settings = await prisma.tenantFeeSetting.findMany({
    where: { autoReminder: true },
  });

  for (const setting of settings) {
    try {
      if (setting.reminderSkipWeekends && isWeekend) continue;
      if ((setting.reminderExecutionTime || "09:00") !== hhmm) continue;
      if (setting.lastReminderRunAt && sameCalendarDay(setting.lastReminderRunAt, now)) continue;

      const session = await prisma.academicSession.findFirst({
        where: tenantScope(setting.tenantId, { isCurrent: true }),
        select: { id: true, name: true },
      });
      if (!session) continue;

      const actorId = await resolveActorId(setting.tenantId);
      const steps = parseSteps({
        reminderSteps: setting.reminderSteps,
        reminderDaysBefore: setting.reminderDaysBefore,
        reminderDaysAfter: setting.reminderDaysAfter,
        reminderEmailEnabled: setting.reminderEmailEnabled,
        reminderSmsEnabled: setting.reminderSmsEnabled,
      });
      if (!steps.length) {
        console.info(`[fee-reminders] tenant=${setting.tenantId} skipped — no email/SMS steps enabled`);
        continue;
      }

      const result = await sendFeeRemindersForSession(setting.tenantId, actorId, session.id, {
        mode: "schedule_steps",
        steps,
        minBalance: setting.reminderMinBalance ? 5 : 0,
      });

      await prisma.tenantFeeSetting.update({
        where: { id: setting.id },
        data: { lastReminderRunAt: now },
      });

      console.info(
        `[fee-reminders] tenant=${setting.tenantId} session=${session.name} notices=${result.count} smsSent=${result.smsSent} smsFailed=${result.smsFailed}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "reminder job failed";
      console.error(`[fee-reminders] tenant=${setting.tenantId} failed: ${message}`);
    }
  }
}
