import {
  EnrollmentStatus,
  NotificationType,
  NoticeAudience,
  UserStatus,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { isPushConfigured, sendWebPush } from "../../lib/push.js";
import { sendMail } from "../../lib/mail.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import { sendFeeRemindersForSession } from "./fee-reminders.js";

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

type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function savePushSubscription(
  tenantId: string,
  userId: string,
  input: PushSubscriptionInput,
  userAgent?: string,
) {
  const endpoint = input.endpoint.trim();
  const p256dh = input.keys.p256dh.trim();
  const auth = input.keys.auth.trim();

  if (!endpoint || !p256dh || !auth) {
    throw new AppError(400, "Invalid push subscription payload", "INVALID_PUSH_SUBSCRIPTION");
  }

  return prisma.pushSubscription.upsert({
    where: { tenantId_endpoint: { tenantId, endpoint } },
    create: { tenantId, userId, endpoint, p256dh, auth, userAgent },
    update: { userId, p256dh, auth, userAgent },
    select: { id: true, endpoint: true, updatedAt: true },
  });
}

export async function removePushSubscription(tenantId: string, userId: string, endpoint: string) {
  const result = await prisma.pushSubscription.deleteMany({
    where: { tenantId, userId, endpoint },
  });
  return { removed: result.count };
}

export async function sendPushToUser(
  tenantId: string,
  userId: string,
  payload: { title: string; body: string; url?: string; type?: string },
) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { tenantId, userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (!subscriptions.length) return { delivered: 0, failed: 0 };

  let delivered = 0;
  let failed = 0;
  for (const sub of subscriptions) {
    const result = await sendWebPush(sub, payload);
    if (result.delivered) {
      delivered += 1;
      continue;
    }

    failed += 1;
    if (result.statusCode === 404 || result.statusCode === 410) {
      await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
    }
  }

  return { delivered, failed };
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

  if (notification.targetUserId && isPushConfigured()) {
    await sendPushToUser(tenantId, notification.targetUserId, {
      title,
      body,
      type: notification.type,
      url: `${env.WEB_ORIGIN}/#/notifications`,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : "push send failed";
      console.error(`[notifications] Push send failed: ${message}`);
    });
  }

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

export async function sendFeeOverdueReminders(
  tenantId: string,
  createdById: string,
  sessionId: string,
) {
  const setting = await prisma.tenantFeeSetting.findUnique({ where: { tenantId } });
  return sendFeeRemindersForSession(tenantId, createdById, sessionId, {
    mode: "all_due",
    sendEmail: setting?.reminderEmailEnabled !== false,
    sendSms: setting?.reminderSmsEnabled !== false,
    minBalance: setting?.reminderMinBalance !== false ? 5 : 0,
    title: "Fee overdue reminder",
  });
}

export async function sendPushTestNotification(tenantId: string, userId: string) {
  if (!isPushConfigured()) {
    throw new AppError(
      400,
      "Push is not configured. Add PUSH_VAPID_PUBLIC_KEY, PUSH_VAPID_PRIVATE_KEY, PUSH_CONTACT_EMAIL.",
      "PUSH_NOT_CONFIGURED",
    );
  }
  return sendPushToUser(tenantId, userId, {
    title: "Push notifications enabled",
    body: "This is a test push from SaaS CMS LMS.",
    type: "ANNOUNCEMENT",
    url: `${env.WEB_ORIGIN}/#/notifications`,
  });
}

