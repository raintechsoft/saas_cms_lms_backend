import {
  DiscountType,
  FeeAssignmentStatus,
  FeeFineType,
  NotificationType,
  NoticeAudience,
  PaymentStatus,
  Prisma,
  UserStatus,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { sendMail } from "../../lib/mail.js";
import { sendSms } from "../../lib/sms.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import {
  dispatchPortalUserAlert,
  getTenantDisplayName,
} from "../mobile/portal-alert.service.js";

export type FeeReminderStep = {
  days: number;
  when: "before" | "after";
  notice: string;
  email: boolean;
  sms: boolean;
};

export type SendFeeReminderOptions = {
  mode: "all_due" | "schedule_steps";
  steps?: FeeReminderStep[];
  sendEmail?: boolean;
  sendSms?: boolean;
  minBalance?: number;
  title?: string;
  studentId?: string;
};

const assignmentInclude = {
  feeMaster: { include: { fineRanges: { orderBy: { startDate: "asc" as const } } } },
  discount: true,
  paymentItems: {
    where: { payment: { status: PaymentStatus.COLLECTED } },
    include: { payment: true },
  },
} satisfies Prisma.StudentFeeAssignmentInclude;

function money(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value ?? 0);
}

function calculateDiscount(
  type: DiscountType | undefined,
  value: Prisma.Decimal | undefined,
  base: number,
) {
  if (!type || !value) return 0;
  const discount =
    type === DiscountType.PERCENTAGE ? (base * money(value)) / 100 : money(value);
  return Math.min(base, Math.max(0, discount));
}

function calculateFine(
  fineType: FeeFineType,
  fineValue: Prisma.Decimal,
  base: number,
  dueDate: Date,
  graceDays: number,
  asOf: Date,
  ranges: Array<{
    startDate: Date;
    endDate: Date | null;
    amount: Prisma.Decimal;
    perDay: boolean;
  }> = [],
) {
  const effectiveDue = new Date(dueDate);
  effectiveDue.setDate(effectiveDue.getDate() + (graceDays || 0));
  if (asOf <= effectiveDue) return 0;
  if (fineType === FeeFineType.NONE) return 0;
  if (fineType === FeeFineType.PERCENTAGE) return (base * money(fineValue)) / 100;
  if (fineType === FeeFineType.PER_DAY) {
    const days = Math.max(
      1,
      Math.ceil((asOf.getTime() - effectiveDue.getTime()) / 86_400_000),
    );
    return days * money(fineValue);
  }
  if (fineType === FeeFineType.DATE_RANGE) {
    const range = ranges.find(
      (item) => asOf >= item.startDate && (!item.endDate || asOf <= item.endDate),
    );
    if (!range) return 0;
    if (!range.perDay) return money(range.amount);
    const days = Math.max(
      1,
      Math.ceil((asOf.getTime() - range.startDate.getTime()) / 86_400_000) + 1,
    );
    return days * money(range.amount);
  }
  return money(fineValue);
}

function toBalance(
  assignment: Prisma.StudentFeeAssignmentGetPayload<{ include: typeof assignmentInclude }>,
  asOf: Date,
) {
  const base =
    money(assignment.customAmount ?? assignment.feeMaster.amount) +
    money(assignment.carryForwardAmount);
  const discount = calculateDiscount(
    assignment.discount?.type,
    assignment.discount?.value,
    base,
  );
  const fine = calculateFine(
    assignment.feeMaster.fineType,
    assignment.feeMaster.fineValue,
    base,
    assignment.feeMaster.dueDate,
    assignment.feeMaster.graceDays,
    asOf,
    assignment.feeMaster.fineRanges,
  );
  const paid = assignment.paymentItems.reduce(
    (sum, item) => sum + money(item.paidAmount),
    0,
  );
  return Math.max(0, base - discount + fine - paid);
}

function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase();
  return email && email.includes("@") ? email : null;
}

function calendarDaysUntilDue(dueDate: Date, asOf: Date) {
  const start = Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  const end = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return Math.round((end - start) / 86_400_000);
}

async function sendEmailOnly(to: string, subject: string, text: string, tenantId?: string) {
  try {
    await sendMail({ to, subject, text, tenantId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email send failed";
    console.error(`[fee-reminders] Email send failed to ${to}: ${message}`);
  }
}

type StudentBucket = {
  classSectionId: string;
  balance: number;
  studentName: string;
  studentUserId: string | null;
  studentEmail: string | null;
  smsNumbers: string[];
  parentUsers: Array<{ userId: string; email: string }>;
  parentContactEmails: string[];
  notice: string;
  sendEmail: boolean;
  sendSms: boolean;
};

export async function sendFeeRemindersForSession(
  tenantId: string,
  createdById: string,
  sessionId: string,
  options: SendFeeReminderOptions,
) {
  const session = await prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { id: sessionId }),
    select: { id: true, name: true },
  });
  if (!session) throw new AppError(404, "Academic session not found", "SESSION_NOT_FOUND");

  const tenantName = await getTenantDisplayName(tenantId);

  const asOf = new Date();
  const minBalance = options.minBalance ?? 0;
  const assignments = await prisma.studentFeeAssignment.findMany({
    where: tenantScope(tenantId, {
      status: FeeAssignmentStatus.ACTIVE,
      feeMaster: { academicSessionId: sessionId },
      ...(options.studentId
        ? { studentEnrollment: { studentId: options.studentId } }
        : {}),
    }),
    include: {
      ...assignmentInclude,
      studentEnrollment: {
        select: {
          classSectionId: true,
          student: {
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
              mobile: true,
              fatherEmail: true,
              motherEmail: true,
              guardianEmail: true,
              fatherPhone: true,
              motherPhone: true,
              guardianPhone: true,
              user: { select: { id: true, email: true, phone: true } },
              guardians: {
                select: {
                  user: { select: { id: true, email: true, phone: true, status: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const byStudent = new Map<string, StudentBucket>();

  for (const assignment of assignments) {
    const balance = toBalance(assignment as any, asOf);
    if (balance < Math.max(minBalance, 0.01)) continue;

    const daysUntil = calendarDaysUntilDue(assignment.feeMaster.dueDate, asOf);
    let matched: FeeReminderStep | null = null;

    if (options.mode === "schedule_steps") {
      matched =
        (options.steps ?? []).find((step) =>
          step.when === "before"
            ? daysUntil === step.days
            : daysUntil === -step.days,
        ) ?? null;
      if (!matched) continue;
    } else {
      // all_due: only balances currently overdue or due today+
      if (daysUntil > 0) continue;
      matched = {
        days: Math.abs(Math.min(daysUntil, 0)),
        when: "after",
        notice: options.title ?? "Fee payment reminder",
        email: options.sendEmail !== false,
        sms: options.sendSms !== false,
      };
    }

    const student = assignment.studentEnrollment.student;
    const key = `${student.id}:${matched.notice}:${matched.email}:${matched.sms}`;
    const existing = byStudent.get(key);
    if (existing) {
      existing.balance += balance;
      continue;
    }

    const studentName =
      [student.firstName, student.lastName].filter(Boolean).join(" ").trim() || "Student";
    const coveredEmails = new Set<string>();
    const studentUserId = student.user?.id ?? student.userId ?? null;
    const studentEmail =
      normalizeEmail(student.user?.email) ?? normalizeEmail(student.email);
    if (studentEmail) coveredEmails.add(studentEmail);

    const parentUsers: Array<{ userId: string; email: string }> = [];
    for (const link of student.guardians) {
      if (link.user.status !== UserStatus.ACTIVE) continue;
      const email = normalizeEmail(link.user.email);
      if (!email) continue;
      if (parentUsers.some((p) => p.userId === link.user.id)) continue;
      parentUsers.push({ userId: link.user.id, email });
      coveredEmails.add(email);
    }

    const parentContactEmails = [
      student.fatherEmail,
      student.motherEmail,
      student.guardianEmail,
    ]
      .map(normalizeEmail)
      .filter((email): email is string => Boolean(email))
      .filter((email) => !coveredEmails.has(email));

    const smsNumbers = [
      student.mobile,
      student.user?.phone,
      student.fatherPhone,
      student.motherPhone,
      student.guardianPhone,
      ...student.guardians.map((link) => link.user.phone),
    ]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));

    byStudent.set(key, {
      classSectionId: assignment.studentEnrollment.classSectionId,
      balance,
      studentName,
      studentUserId,
      studentEmail,
      smsNumbers: [...new Set(smsNumbers)],
      parentUsers,
      parentContactEmails: [...new Set(parentContactEmails)],
      notice: matched.notice,
      sendEmail: matched.email,
      sendSms: matched.sms,
    });
  }

  let sent = 0;
  let smsSent = 0;
  let smsFailed = 0;
  let pushSent = 0;
  let pushFailed = 0;
  const smsErrors: string[] = [];

  for (const item of byStudent.values()) {
    const title = item.notice || options.title || "Fee payment reminder";
    const amount = item.balance.toFixed(2);
    const studentPushBody = `Outstanding balance ₹${amount} for ${session.name}. Please pay at your earliest convenience.`;
    const parentPushBody = `${item.studentName} has an outstanding balance of ₹${amount} for ${session.name}. Please arrange payment soon.`;
    const studentBody = [
      `Hello ${item.studentName},`,
      ``,
      `${title}`,
      `Your outstanding fee balance for ${session.name} is ${amount}.`,
      `Please pay at your earliest convenience.`,
      ``,
      `Thank you.`,
    ].join("\n");
    const parentBody = [
      `Hello,`,
      ``,
      `${title} for ${item.studentName}.`,
      `Outstanding fee balance for ${session.name} is ${amount}.`,
      `Please arrange payment soon.`,
      ``,
      `Thank you.`,
    ].join("\n");

    // In-app + browser push for linked login accounts (independent of email/SMS toggles).
    if (item.studentUserId) {
      await prisma.notification.create({
        data: {
          tenantId,
          createdById,
          title,
          body: studentBody,
          type: NotificationType.FEE_OVERDUE,
          audience: NoticeAudience.STUDENTS,
          classSectionId: item.classSectionId,
          targetUserId: item.studentUserId,
        },
      });
      const push = await dispatchPortalUserAlert(tenantId, item.studentUserId, {
        category: "FEE_REMINDER",
        title,
        body: studentPushBody,
        type: NotificationType.FEE_OVERDUE,
        screen: "fees",
        tenantName,
      });
      pushSent += push.delivered;
      pushFailed += push.failed;
      if (push.mobile.failed > 0 || push.mobile.deviceCount === 0) {
        console.warn(
          `[fee-reminders] Student push user=${item.studentUserId} devices=${push.mobile.deviceCount} delivered=${push.mobile.delivered} failed=${push.mobile.failed}`,
        );
      }
      sent += 1;
    }

    for (const parent of item.parentUsers) {
      await prisma.notification.create({
        data: {
          tenantId,
          createdById,
          title,
          body: parentBody,
          type: NotificationType.FEE_OVERDUE,
          audience: NoticeAudience.PARENTS,
          classSectionId: item.classSectionId,
          targetUserId: parent.userId,
        },
      });
      const push = await dispatchPortalUserAlert(tenantId, parent.userId, {
        category: "FEE_REMINDER",
        title,
        body: parentPushBody,
        type: NotificationType.FEE_OVERDUE,
        screen: "fees",
        tenantName,
      });
      pushSent += push.delivered;
      pushFailed += push.failed;
      sent += 1;
    }

    if (item.sendEmail) {
      if (item.studentEmail) {
        await sendEmailOnly(item.studentEmail, title, studentBody, tenantId);
      }
      for (const parent of item.parentUsers) {
        await sendEmailOnly(parent.email, title, parentBody, tenantId);
      }
      for (const email of item.parentContactEmails) {
        await sendEmailOnly(email, title, parentBody, tenantId);
      }
    }

    if (item.sendSms) {
      const smsBody = `${title}: ${item.studentName} owes ${amount} for ${session.name}. Please pay soon.`;
      for (const phone of item.smsNumbers) {
        try {
          const result = await sendSms({ tenantId, to: phone, body: smsBody });
          if (result.delivered) smsSent += 1;
          else smsFailed += 1;
        } catch (err) {
          smsFailed += 1;
          const message = err instanceof Error ? err.message : "SMS send failed";
          smsErrors.push(`${phone}: ${message}`);
          console.error(`[fee-reminders] SMS send failed to ${phone}: ${message}`);
        }
      }
    }
  }

  return {
    count: sent,
    smsSent,
    smsFailed,
    pushSent,
    pushFailed,
    smsErrors: smsErrors.slice(0, 5),
  };
}
