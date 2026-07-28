import {
  DiscountType,
  EnrollmentStatus,
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

async function getUserRoleCodes(tenantId: string, userId: string) {
  const roles = await prisma.userRole.findMany({
    where: tenantScope(tenantId, { userId }),
    include: { role: { select: { code: true } } },
  });
  return roles.map((r) => r.role.code);
}

function relevantAudiences(roleCodes: string[]) {
  const audiences: NoticeAudience[] = [NoticeAudience.ALL];
  if (roleCodes.includes("STUDENT")) audiences.push(NoticeAudience.STUDENTS);
  if (roleCodes.includes("PARENT")) audiences.push(NoticeAudience.PARENTS);
  return audiences;
}

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
) {
  const effectiveDue = new Date(dueDate);
  effectiveDue.setUTCDate(effectiveDue.getUTCDate() + graceDays);
  if (fineType === FeeFineType.NONE || asOf <= effectiveDue) return 0;
  return fineType === FeeFineType.PERCENTAGE
    ? (base * money(fineValue)) / 100
    : money(fineValue);
}

function toDue(
  assignment: Prisma.StudentFeeAssignmentGetPayload<{
    include: {
      feeMaster: true;
      discount: true;
      paymentItems: true;
    };
  }>,
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
  );
  const paid = assignment.paymentItems.reduce(
    (sum, item) => sum + money(item.paidAmount),
    0,
  );
  const balance = Math.max(0, base - discount + fine - paid);
  return { totals: { balance } };
}

export async function listNotifications(
  tenantId: string,
  userId: string,
  limit = 30,
  options?: { scope?: "inbox" | "all" },
) {
  const scope = options?.scope ?? "inbox";
  const roleCodes = await getUserRoleCodes(tenantId, userId);
  const audiences = relevantAudiences(roleCodes);

  const notifications = await prisma.notification.findMany({
    where: tenantScope(
      tenantId,
      scope === "all"
        ? {}
        : {
            OR: [{ audience: { in: audiences } }, { targetUserId: userId }],
          },
    ),
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const notificationIds = notifications.map((n) => n.id);
  const reads = notificationIds.length
    ? await prisma.notificationRead.findMany({
        where: { userId, notificationId: { in: notificationIds } },
        select: { notificationId: true },
      })
    : [];
  const readSet = new Set(reads.map((r) => r.notificationId));

  return notifications.map((n) => ({
    ...n,
    isRead: readSet.has(n.id),
  }));
}

export async function getUnreadCount(tenantId: string, userId: string) {
  const roleCodes = await getUserRoleCodes(tenantId, userId);
  const audiences = relevantAudiences(roleCodes);

  return prisma.notification.count({
    where: tenantScope(tenantId, {
      OR: [{ audience: { in: audiences } }, { targetUserId: userId }],
      reads: { none: { userId } },
    }),
  });
}

function normalizeEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase();
  return email && email.includes("@") ? email : null;
}

async function collectAudienceEmails(
  tenantId: string,
  audience: NoticeAudience,
  options?: { classSectionId?: string | null; targetUserId?: string | null },
) {
  const emails = new Set<string>();

  if (options?.targetUserId) {
    const target = await prisma.user.findFirst({
      where: tenantScope(tenantId, { id: options.targetUserId }),
      select: { email: true },
    });
    const email = normalizeEmail(target?.email);
    if (email) emails.add(email);
    return [...emails];
  }

  if (audience === NoticeAudience.STUDENTS || audience === NoticeAudience.ALL) {
    const studentUsers = await prisma.userRole.findMany({
      where: tenantScope(tenantId, {
        role: { code: "STUDENT" },
        user: { status: UserStatus.ACTIVE },
      }),
      include: { user: { select: { email: true } } },
    });
    for (const row of studentUsers) {
      const email = normalizeEmail(row.user.email);
      if (email) emails.add(email);
    }
  }

  if (audience === NoticeAudience.PARENTS || audience === NoticeAudience.ALL) {
    const parentUsers = await prisma.userRole.findMany({
      where: tenantScope(tenantId, {
        role: { code: "PARENT" },
        user: { status: UserStatus.ACTIVE },
      }),
      include: { user: { select: { email: true } } },
    });
    for (const row of parentUsers) {
      const email = normalizeEmail(row.user.email);
      if (email) emails.add(email);
    }
  }

  if (audience === NoticeAudience.ALL) {
    const staff = await prisma.user.findMany({
      where: tenantScope(tenantId, { status: UserStatus.ACTIVE }),
      select: { email: true },
    });
    for (const row of staff) {
      const email = normalizeEmail(row.email);
      if (email) emails.add(email);
    }
  }

  // Also include contact emails from student profiles (father/mother/guardian/student email).
  // These are often real phone Gmail addresses without a login account.
  if (
    audience === NoticeAudience.ALL ||
    audience === NoticeAudience.PARENTS ||
    audience === NoticeAudience.STUDENTS
  ) {
    const students = await prisma.student.findMany({
      where: tenantScope(tenantId, {
        ...(options?.classSectionId
          ? {
              enrollments: {
                some: {
                  classSectionId: options.classSectionId,
                  status: EnrollmentStatus.ACTIVE,
                },
              },
            }
          : {}),
      }),
      select: {
        email: true,
        fatherEmail: true,
        motherEmail: true,
        guardianEmail: true,
      },
    });

    for (const student of students) {
      const contacts =
        audience === NoticeAudience.STUDENTS
          ? [student.email]
          : audience === NoticeAudience.PARENTS
            ? [student.fatherEmail, student.motherEmail, student.guardianEmail]
            : [student.email, student.fatherEmail, student.motherEmail, student.guardianEmail];

      for (const value of contacts) {
        const email = normalizeEmail(value);
        if (email) emails.add(email);
      }
    }
  }

  return [...emails];
}

export async function createNotification(
  tenantId: string,
  createdById: string,
  input: {
    title: string;
    body: string;
    type?: NotificationType;
    audience?: NoticeAudience;
    classSectionId?: string | null;
    targetUserId?: string | null;
    sendEmail?: boolean;
  },
) {
  if (input.classSectionId) {
    const ok = await prisma.classSection.findFirst({
      where: tenantScope(tenantId, { id: input.classSectionId }),
      select: { id: true },
    });
    if (!ok) throw new AppError(400, "Invalid class section", "INVALID_CLASS_SECTION");
  }

  if (input.targetUserId) {
    const ok = await prisma.user.findFirst({
      where: tenantScope(tenantId, { id: input.targetUserId }),
      select: { id: true },
    });
    if (!ok) throw new AppError(400, "Invalid target user", "INVALID_TARGET_USER");
  }

  const title = input.title.trim();
  const body = input.body.trim();

  const notification = await prisma.notification.create({
    data: {
      tenantId,
      createdById,
      title,
      body,
      type: input.type ?? NotificationType.ANNOUNCEMENT,
      audience: input.audience ?? NoticeAudience.ALL,
      classSectionId: input.classSectionId ?? null,
      targetUserId: input.targetUserId ?? null,
    },
  });

  if (!input.sendEmail) return notification;

  const audience = input.audience ?? NoticeAudience.ALL;
  const recipientEmails = await collectAudienceEmails(tenantId, audience, {
    classSectionId: input.classSectionId,
    targetUserId: input.targetUserId,
  });

  console.info(
    `[notifications] Sending "${title}" to ${recipientEmails.length} recipient(s): ${recipientEmails.join(", ")}`,
  );

  let anyDelivered = false;
  for (const email of recipientEmails) {
    try {
      const result = await sendMail({
        to: email,
        subject: title,
        text: body,
        tenantId,
      });
      anyDelivered ||= result.delivered;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Email send failed";
      console.error(`[notifications] Email send failed to ${email}: ${message}`);
    }
  }

  if (!anyDelivered) return notification;

  return prisma.notification.update({
    where: { id: notification.id },
    data: { emailSent: true, sentAt: new Date() },
  });
}

export async function markRead(
  tenantId: string,
  userId: string,
  notificationId: string,
) {
  const exists = await prisma.notification.findFirst({
    where: tenantScope(tenantId, { id: notificationId }),
    select: { id: true },
  });
  if (!exists) throw new AppError(404, "Notification not found", "NOTIFICATION_NOT_FOUND");

  return prisma.notificationRead.upsert({
    where: { notificationId_userId: { notificationId, userId } },
    create: { notificationId, userId },
    update: { readAt: new Date() },
  });
}

export async function markAllRead(tenantId: string, userId: string) {
  const roleCodes = await getUserRoleCodes(tenantId, userId);
  const audiences = relevantAudiences(roleCodes);

  const unread = await prisma.notification.findMany({
    where: tenantScope(tenantId, {
      OR: [{ audience: { in: audiences } }, { targetUserId: userId }],
      reads: { none: { userId } },
    }),
    select: { id: true },
  });

  if (!unread.length) return { updated: 0 };

  const result = await prisma.notificationRead.createMany({
    data: unread.map((n) => ({ notificationId: n.id, userId })),
    skipDuplicates: true,
  });

  return { updated: result.count };
}

const assignmentInclude = {
  feeMaster: true,
  discount: true,
  paymentItems: {
    where: { payment: { status: PaymentStatus.COLLECTED } },
    include: { payment: true },
  },
} satisfies Prisma.StudentFeeAssignmentInclude;

async function sendEmailOnly(to: string, subject: string, text: string, tenantId?: string) {
  try {
    await sendMail({ to, subject, text, tenantId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email send failed";
    console.error(`[notifications] Email send failed to ${to}: ${message}`);
  }
}

export async function sendFeeOverdueReminders(
  tenantId: string,
  createdById: string,
  sessionId: string,
) {
  const session = await prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { id: sessionId }),
    select: { id: true, name: true },
  });
  if (!session) throw new AppError(404, "Academic session not found", "SESSION_NOT_FOUND");

  const asOf = new Date();
  const assignments = await prisma.studentFeeAssignment.findMany({
    where: tenantScope(tenantId, {
      status: FeeAssignmentStatus.ACTIVE,
      feeMaster: { academicSessionId: sessionId },
    }),
    include: {
      ...assignmentInclude,
      studentEnrollment: {
        select: {
          classSectionId: true,
          student: {
            select: {
              id: true,
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

  const byStudent = new Map<
    string,
    {
      classSectionId: string;
      balance: number;
      studentName: string;
      studentUserId: string | null;
      studentEmail: string | null;
      smsNumbers: string[];
      parentUsers: Array<{ userId: string; email: string }>;
      parentContactEmails: string[];
    }
  >();

  for (const assignment of assignments) {
    const due = toDue(assignment as any, asOf);
    const balance = due.totals.balance;
    if (balance <= 0) continue;

    const student = assignment.studentEnrollment.student;
    const key = student.id;
    const existing = byStudent.get(key);
    if (existing) {
      existing.balance += balance;
      continue;
    }

    const studentName = [student.firstName, student.lastName].filter(Boolean).join(" ").trim() || "Student";
    const coveredEmails = new Set<string>();

    const studentUserId = student.user?.id ?? null;
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
    });
  }

  let sent = 0;
  let smsSent = 0;
  let smsFailed = 0;
  const smsErrors: string[] = [];

  for (const item of byStudent.values()) {
    const title = "Fee overdue reminder";
    const amount = item.balance.toFixed(2);
    const studentBody = [
      `Hello ${item.studentName},`,
      ``,
      `Your outstanding fee balance for ${session.name} is ${amount}.`,
      `Please pay at your earliest convenience to avoid further delays.`,
      ``,
      `Thank you.`,
    ].join("\n");
    const parentBody = [
      `Hello,`,
      ``,
      `This is a fee overdue reminder for ${item.studentName}.`,
      `Outstanding fee balance for ${session.name} is ${amount}.`,
      `Please arrange payment at your earliest convenience.`,
      ``,
      `Thank you.`,
    ].join("\n");

    // Student: in-app + email (login account), or email-only fallback.
    if (item.studentUserId) {
      await createNotification(tenantId, createdById, {
        title,
        body: studentBody,
        type: NotificationType.FEE_OVERDUE,
        audience: NoticeAudience.STUDENTS,
        classSectionId: item.classSectionId,
        targetUserId: item.studentUserId,
        sendEmail: true,
      });
      sent += 1;
    } else if (item.studentEmail) {
      await sendEmailOnly(item.studentEmail, title, studentBody, tenantId);
      sent += 1;
    }

    // Linked parent login accounts: in-app + email.
    for (const parent of item.parentUsers) {
      await createNotification(tenantId, createdById, {
        title,
        body: parentBody,
        type: NotificationType.FEE_OVERDUE,
        audience: NoticeAudience.PARENTS,
        classSectionId: item.classSectionId,
        targetUserId: parent.userId,
        sendEmail: true,
      });
      sent += 1;
    }

    // Parent contact emails on student record (no login): email only.
    for (const email of item.parentContactEmails) {
      await sendEmailOnly(email, title, parentBody, tenantId);
      sent += 1;
    }

    const smsBody = `Fee overdue: ${item.studentName} owes ${amount} for ${session.name}. Please pay soon.`;
    for (const phone of item.smsNumbers) {
      try {
        const result = await sendSms({ tenantId, to: phone, body: smsBody });
        if (result.delivered) smsSent += 1;
        else smsFailed += 1;
      } catch (err) {
        smsFailed += 1;
        const message = err instanceof Error ? err.message : "SMS send failed";
        smsErrors.push(`${phone}: ${message}`);
        console.error(`[notifications] SMS send failed to ${phone}: ${message}`);
      }
    }
  }

  return { count: sent, smsSent, smsFailed, smsErrors: smsErrors.slice(0, 5) };
}

