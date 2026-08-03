import {
  EnrollmentStatus,
  NoticeAudience,
  NotificationType,
  StudentStatus,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { sendMail } from "../../lib/mail.js";
import { prisma } from "../../lib/prisma.js";
import { sendSms } from "../../lib/sms.js";
import { tenantScope } from "../../lib/tenant-scope.js";

export type PortalLoginStatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "NO_ACCOUNT";

function studentName(firstName: string, lastName?: string | null) {
  return `${firstName} ${lastName ?? ""}`.trim();
}

export async function listAppDownloadStatus(
  tenantId: string,
  query: {
    status?: PortalLoginStatusFilter;
    classSectionId?: string;
    search?: string;
  },
) {
  const students = await prisma.student.findMany({
    where: tenantScope(tenantId, {
      status: StudentStatus.ACTIVE,
      ...(query.classSectionId
        ? {
            enrollments: {
              some: {
                classSectionId: query.classSectionId,
                status: EnrollmentStatus.ACTIVE,
              },
            },
          }
        : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { firstName: { contains: query.search.trim(), mode: "insensitive" as const } },
              { lastName: { contains: query.search.trim(), mode: "insensitive" as const } },
              { admissionNumber: { contains: query.search.trim(), mode: "insensitive" as const } },
              { email: { contains: query.search.trim(), mode: "insensitive" as const } },
              { mobile: { contains: query.search.trim() } },
            ],
          }
        : {}),
    }),
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          firstLoginAt: true,
          lastLoginAt: true,
          lastLoginChannel: true,
          status: true,
        },
      },
      enrollments: {
        where: { status: EnrollmentStatus.ACTIVE },
        include: {
          academicSession: { select: { name: true } },
          classSection: {
            include: {
              academicClass: { select: { name: true } },
              section: { select: { name: true } },
            },
          },
        },
        orderBy: { enrolledAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ firstName: "asc" }, { admissionNumber: "asc" }],
    take: 500,
  });

  const rows = students.map((student) => {
    const enrollment = student.enrollments[0] ?? null;
    const loginStatus = !student.user
      ? ("NO_ACCOUNT" as const)
      : student.user.firstLoginAt
        ? ("ACTIVE" as const)
        : ("INACTIVE" as const);

    return {
      studentId: student.id,
      admissionNumber: student.admissionNumber,
      name: studentName(student.firstName, student.lastName),
      mobile: student.mobile ?? student.user?.phone ?? null,
      email: student.email ?? student.user?.email ?? null,
      classLabel: enrollment
        ? `${enrollment.classSection.academicClass.name} - ${enrollment.classSection.section.name}`
        : null,
      session: enrollment?.academicSession.name ?? null,
      loginStatus,
      firstLoginAt: student.user?.firstLoginAt?.toISOString() ?? null,
      lastLoginAt: student.user?.lastLoginAt?.toISOString() ?? null,
      lastLoginChannel: student.user?.lastLoginChannel ?? null,
      hasPortalAccount: Boolean(student.userId),
      userId: student.userId,
    };
  });

  const filtered =
    !query.status || query.status === "ALL"
      ? rows
      : rows.filter((row) => row.loginStatus === query.status);

  const summary = {
    total: rows.length,
    active: rows.filter((row) => row.loginStatus === "ACTIVE").length,
    inactive: rows.filter((row) => row.loginStatus === "INACTIVE").length,
    noAccount: rows.filter((row) => row.loginStatus === "NO_ACCOUNT").length,
  };

  return { summary, items: filtered };
}

export async function getPortalLoginReminderSettings(tenantId: string) {
  const settings = await prisma.tenantSetting.findUnique({ where: { tenantId } });
  return {
    enabled: settings?.portalInactiveReminderEnabled ?? false,
    sendSms: settings?.portalInactiveReminderSms ?? true,
    sendEmail: settings?.portalInactiveReminderEmail ?? true,
    intervalDays: settings?.portalInactiveReminderDays ?? 7,
  };
}

export async function updatePortalLoginReminderSettings(
  tenantId: string,
  input: {
    enabled: boolean;
    sendSms: boolean;
    sendEmail: boolean;
    intervalDays: number;
  },
) {
  const intervalDays = Math.min(90, Math.max(1, Math.trunc(input.intervalDays || 7)));
  await prisma.tenantSetting.upsert({
    where: { tenantId },
    update: {
      portalInactiveReminderEnabled: input.enabled,
      portalInactiveReminderSms: input.sendSms,
      portalInactiveReminderEmail: input.sendEmail,
      portalInactiveReminderDays: intervalDays,
    },
    create: {
      tenantId,
      portalInactiveReminderEnabled: input.enabled,
      portalInactiveReminderSms: input.sendSms,
      portalInactiveReminderEmail: input.sendEmail,
      portalInactiveReminderDays: intervalDays,
    },
  });
  return getPortalLoginReminderSettings(tenantId);
}

async function deliverPortalLoginAlert(input: {
  tenantId: string;
  createdById: string;
  studentId: string;
  name: string;
  email: string | null;
  mobile: string | null;
  userId: string | null;
  sendSms: boolean;
  sendEmail: boolean;
  title: string;
  body: string;
}) {
  let emailSent = false;
  let smsSent = false;
  let notificationId: string | null = null;

  if (input.userId) {
    const notification = await prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        createdById: input.createdById,
        title: input.title,
        body: input.body,
        type: NotificationType.ANNOUNCEMENT,
        audience: NoticeAudience.STUDENTS,
        targetUserId: input.userId,
      },
    });
    notificationId = notification.id;
  }

  if (input.sendEmail && input.email) {
    try {
      await sendMail({
        to: input.email,
        subject: input.title,
        text: input.body,
        tenantId: input.tenantId,
      });
      emailSent = true;
    } catch (error) {
      console.error(
        `[app-download-status] email failed: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  if (input.sendSms && input.mobile) {
    try {
      const result = await sendSms({
        tenantId: input.tenantId,
        to: input.mobile,
        body: `${input.title}: Please login to your student portal with your credentials.`,
      });
      smsSent = Boolean(result.delivered);
    } catch (error) {
      console.error(
        `[app-download-status] sms failed: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  return { emailSent, smsSent, notificationId };
}

export async function sendInactivePortalLoginReminders(
  tenantId: string,
  createdById: string,
  options?: { studentId?: string },
) {
  const settings = await getPortalLoginReminderSettings(tenantId);
  const { items } = await listAppDownloadStatus(tenantId, {
    status: options?.studentId ? "ALL" : "INACTIVE",
  });

  const targets = options?.studentId
    ? items.filter((item) => item.studentId === options.studentId)
    : items.filter((item) => item.loginStatus === "INACTIVE");

  if (options?.studentId && !targets.length) {
    throw new AppError(404, "Student not found for portal reminder", "STUDENT_NOT_FOUND");
  }

  const title = "Portal login reminder";
  let sent = 0;
  let emailSent = 0;
  let smsSent = 0;

  for (const item of targets) {
    const body = [
      `Hello ${item.name},`,
      "",
      "Please login to your student / parent portal using the credentials shared by your school.",
      item.admissionNumber ? `Admission No: ${item.admissionNumber}` : "",
      "",
      "If you need help, contact the school office.",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await deliverPortalLoginAlert({
      tenantId,
      createdById,
      studentId: item.studentId,
      name: item.name,
      email: item.email,
      mobile: item.mobile,
      userId: item.userId,
      sendSms: settings.sendSms,
      sendEmail: settings.sendEmail,
      title,
      body,
    });
    sent += 1;
    if (result.emailSent) emailSent += 1;
    if (result.smsSent) smsSent += 1;
  }

  return {
    count: sent,
    emailSent,
    smsSent,
    schedule: settings,
  };
}

/** Runs on the API timer — sends reminders for tenants with schedule enabled. */
export async function processScheduledPortalInactiveReminders() {
  const settingsRows = await prisma.tenantSetting.findMany({
    where: { portalInactiveReminderEnabled: true },
    select: {
      tenantId: true,
      portalInactiveReminderDays: true,
      portalInactiveReminderSms: true,
      portalInactiveReminderEmail: true,
    },
  });

  for (const setting of settingsRows) {
    const intervalDays = Math.min(90, Math.max(1, setting.portalInactiveReminderDays || 7));
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - intervalDays);

    const recentScheduled = await prisma.notification.count({
      where: {
        tenantId: setting.tenantId,
        title: "Scheduled portal login reminder",
        createdAt: { gte: since },
      },
    });
    if (recentScheduled > 0) continue;

    const admin = await prisma.user.findFirst({
      where: {
        tenantId: setting.tenantId,
        status: "ACTIVE",
        roles: { some: { role: { code: "INSTITUTION_ADMIN" } } },
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (!admin) {
      console.warn(
        `[portal-login-reminders] tenant=${setting.tenantId} skipped — no admin user`,
      );
      continue;
    }

    const { items } = await listAppDownloadStatus(setting.tenantId, { status: "INACTIVE" });
    if (!items.length) continue;

    let sent = 0;
    for (const item of items) {
      const body = [
        `Hello ${item.name},`,
        "",
        "Please login to your student / parent portal using the credentials shared by your school.",
        item.admissionNumber ? `Admission No: ${item.admissionNumber}` : "",
        "",
        "If you need help, contact the school office.",
      ]
        .filter(Boolean)
        .join("\n");

      await deliverPortalLoginAlert({
        tenantId: setting.tenantId,
        createdById: admin.id,
        studentId: item.studentId,
        name: item.name,
        email: item.email,
        mobile: item.mobile,
        userId: item.userId,
        sendSms: setting.portalInactiveReminderSms,
        sendEmail: setting.portalInactiveReminderEmail,
        title: "Scheduled portal login reminder",
        body,
      });
      sent += 1;
    }

    console.info(
      `[portal-login-reminders] tenant=${setting.tenantId} inactive=${sent} intervalDays=${intervalDays}`,
    );
  }
}
