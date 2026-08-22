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
import {
  isMobilePushConfigured,
  sendMobilePushToUser,
  sendMobilePushToUsers,
} from "../mobile/mobile-push.service.js";
import { buildPortalPushPayload } from "../mobile/portal-alert.format.js";
import { getTenantDisplayName } from "../mobile/portal-alert.service.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import { sendFeeRemindersForSession } from "./fee-reminders.js";
import { collectAudienceUserIds } from "./push-audience.js";

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

async function resolvePortalClassSectionIds(
  tenantId: string,
  userId: string,
  roleCodes: string[],
) {
  const ids = new Set<string>();

  if (roleCodes.includes("STUDENT")) {
    const student = await prisma.student.findFirst({
      where: tenantScope(tenantId, { userId }),
      select: {
        enrollments: {
          where: { status: EnrollmentStatus.ACTIVE },
          select: { classSectionId: true },
        },
      },
    });
    for (const enrollment of student?.enrollments ?? []) {
      ids.add(enrollment.classSectionId);
    }
  }

  if (roleCodes.includes("PARENT")) {
    const links = await prisma.studentGuardian.findMany({
      where: tenantScope(tenantId, { userId }),
      select: {
        student: {
          select: {
            enrollments: {
              where: { status: EnrollmentStatus.ACTIVE },
              select: { classSectionId: true },
            },
          },
        },
      },
    });
    for (const link of links) {
      for (const enrollment of link.student.enrollments) {
        ids.add(enrollment.classSectionId);
      }
    }
  }

  return [...ids];
}

async function resolvePortalNotificationSince(
  tenantId: string,
  userId: string,
  roleCodes: string[],
) {
  const user = await prisma.user.findFirst({
    where: tenantScope(tenantId, { id: userId }),
    select: { createdAt: true },
  });
  if (!user) return null;

  let sinceMs = user.createdAt.getTime();

  if (roleCodes.includes("STUDENT")) {
    const student = await prisma.student.findFirst({
      where: tenantScope(tenantId, { userId }),
      select: { createdAt: true },
    });
    if (student) {
      sinceMs = Math.max(sinceMs, student.createdAt.getTime());
    }
  }

  if (roleCodes.includes("PARENT")) {
    const links = await prisma.studentGuardian.findMany({
      where: tenantScope(tenantId, { userId }),
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 1,
    });
    if (links[0]) {
      sinceMs = Math.max(sinceMs, links[0].createdAt.getTime());
    }
  }

  return new Date(sinceMs);
}

/** Portal inbox: personal alerts + school-wide/class broadcasts only. */
function buildPortalInboxWhere(
  userId: string,
  audiences: NoticeAudience[],
  classSectionIds: string[],
  since?: Date | null,
) {
  const classScope =
    classSectionIds.length > 0
      ? { OR: [{ classSectionId: null }, { classSectionId: { in: classSectionIds } }] }
      : { classSectionId: null };

  const inboxWhere = {
    OR: [
      { targetUserId: userId },
      {
        targetUserId: null,
        audience: { in: audiences },
        AND: [classScope],
      },
    ],
  };

  if (!since) return inboxWhere;

  return {
    AND: [inboxWhere, { createdAt: { gte: since } }],
  };
}

async function resolvePortalInboxWhere(tenantId: string, userId: string) {
  const roleCodes = await getUserRoleCodes(tenantId, userId);
  const audiences = relevantAudiences(roleCodes);
  const classSectionIds = await resolvePortalClassSectionIds(tenantId, userId, roleCodes);
  const since = await resolvePortalNotificationSince(tenantId, userId, roleCodes);
  return buildPortalInboxWhere(userId, audiences, classSectionIds, since);
}

type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function isAnyPushConfigured() {
  return isPushConfigured() || isMobilePushConfigured();
}

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

  let delivered = 0;
  let failed = 0;

  if (isPushConfigured()) {
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
  }

  const mobileResult = await sendMobilePushToUser(tenantId, userId, payload);
  delivered += mobileResult.delivered;
  failed += mobileResult.failed;

  const totalRecipients = subscriptions.length + mobileResult.deviceCount;
  if (!totalRecipients) return { delivered: 0, failed: 0 };

  try {
    const { logPushDelivery } = await import("../erp/push-gateway.service.js");
    await logPushDelivery({
      tenantId,
      title: payload.title,
      body: payload.body,
      topicKey: payload.type ?? null,
      recipientCount: totalRecipients,
      status: failed === 0 ? "DELIVERED" : delivered === 0 ? "FAILED" : "SENT",
      errorMessage: failed > 0 ? `${failed} device(s) failed` : null,
    });
  } catch {
    // Non-blocking analytics logging
  }

  return { delivered, failed };
}

function pushClickUrlForAudience(audience: NoticeAudience) {
  if (audience === NoticeAudience.PARENTS) {
    return `${env.WEB_ORIGIN}/#/portal/parent/notifications`;
  }
  if (audience === NoticeAudience.STUDENTS) {
    return `${env.WEB_ORIGIN}/#/portal/student/notifications`;
  }
  return `${env.WEB_ORIGIN}/#/portal`;
}

export async function sendPushToAudience(
  tenantId: string,
  audience: NoticeAudience,
  payload: { title: string; body: string; type?: string; url?: string },
  options?: { classSectionId?: string | null; targetUserId?: string | null },
) {
  if (!isAnyPushConfigured()) return { delivered: 0, failed: 0, recipients: 0 };

  const userIds = await collectAudienceUserIds(tenantId, audience, options);
  if (!userIds.length) return { delivered: 0, failed: 0, recipients: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { tenantId, userId: { in: userIds } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  const resolvedPayload = {
    ...payload,
    url: payload.url ?? pushClickUrlForAudience(audience),
  };

  let delivered = 0;
  let failed = 0;

  if (isPushConfigured()) {
    for (const sub of subscriptions) {
      const result = await sendWebPush(sub, resolvedPayload);
      if (result.delivered) {
        delivered += 1;
        continue;
      }
      failed += 1;
      if (result.statusCode === 404 || result.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
      }
    }
  }

  const mobileResult = await sendMobilePushToUsers(tenantId, userIds, resolvedPayload);
  delivered += mobileResult.delivered;
  failed += mobileResult.failed;

  if (!subscriptions.length && mobileResult.deviceCount === 0) {
    return { delivered: 0, failed: 0, recipients: userIds.length };
  }

  return { delivered, failed, recipients: userIds.length };
}

export async function listNotifications(
  tenantId: string,
  userId: string,
  limit = 30,
  options?: { scope?: "inbox" | "all" },
) {
  const scope = options?.scope ?? "inbox";
  const inboxWhere =
    scope === "all" ? {} : await resolvePortalInboxWhere(tenantId, userId);

  const notifications = await prisma.notification.findMany({
    where: tenantScope(tenantId, inboxWhere),
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
  const inboxWhere = await resolvePortalInboxWhere(tenantId, userId);

  return prisma.notification.count({
    where: tenantScope(tenantId, {
      ...inboxWhere,
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

  const audience = input.audience ?? NoticeAudience.ALL;
  let pushResult = { delivered: 0, failed: 0, recipients: 0 };
  if (isAnyPushConfigured()) {
    try {
      const tenantName = await getTenantDisplayName(tenantId);
      const pushPayload = buildPortalPushPayload({
        category: "ANNOUNCEMENT",
        title,
        body,
        type: notification.type,
        screen: "notifications",
        tenantName,
        referenceId: notification.id,
      });
      pushResult = await sendPushToAudience(
        tenantId,
        audience,
        {
          ...pushPayload,
          url: pushClickUrlForAudience(audience),
        },
        {
          classSectionId: input.classSectionId,
          targetUserId: input.targetUserId,
        },
      );
      console.info(
        `[notifications] Push "${title}" delivered=${pushResult.delivered} failed=${pushResult.failed} recipients=${pushResult.recipients}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "push send failed";
      console.error(`[notifications] Push broadcast failed: ${message}`);
    }
  }

  if (!input.sendEmail) {
    return { ...notification, pushSent: pushResult.delivered, pushFailed: pushResult.failed };
  }

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

  if (!anyDelivered) {
    return { ...notification, pushSent: pushResult.delivered, pushFailed: pushResult.failed };
  }

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { emailSent: true, sentAt: new Date() },
  });
  return { ...updated, pushSent: pushResult.delivered, pushFailed: pushResult.failed };
}

export async function markRead(
  tenantId: string,
  userId: string,
  notificationId: string,
) {
  const inboxWhere = await resolvePortalInboxWhere(tenantId, userId);
  const exists = await prisma.notification.findFirst({
    where: tenantScope(tenantId, { id: notificationId, ...inboxWhere }),
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
  const inboxWhere = await resolvePortalInboxWhere(tenantId, userId);

  const unread = await prisma.notification.findMany({
    where: tenantScope(tenantId, {
      ...inboxWhere,
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
  if (!isAnyPushConfigured()) {
    throw new AppError(
      400,
      "Push is not configured. Add PUSH_VAPID_* env vars or FIREBASE_SERVICE_ACCOUNT_JSON.",
      "PUSH_NOT_CONFIGURED",
    );
  }
  const roleCodes = await getUserRoleCodes(tenantId, userId);
  const url = roleCodes.includes("PARENT")
    ? `${env.WEB_ORIGIN}/#/portal/parent/notifications`
    : roleCodes.includes("STUDENT")
      ? `${env.WEB_ORIGIN}/#/portal/student/notifications`
      : `${env.WEB_ORIGIN}/#/notifications`;

  return sendPushToUser(tenantId, userId, {
    title: "Push notifications enabled",
    body: "This is a test push from SaaS CMS LMS.",
    type: "ANNOUNCEMENT",
    url,
  });
}

