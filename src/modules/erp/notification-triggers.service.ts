import type {
  NotificationTriggerModule,
  NotificationTriggerPriority,
  NotificationTriggerSendTiming,
  Prisma,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

type SeedTrigger = {
  key: string;
  name: string;
  description: string;
  module: NotificationTriggerModule;
  eventKey: string;
  eventLabel: string;
  priority?: NotificationTriggerPriority;
  sendTiming?: NotificationTriggerSendTiming;
  channelWhatsapp?: boolean;
  channelEmail?: boolean;
  channelPush?: boolean;
  channelSms?: boolean;
  recipientStudent?: boolean;
  recipientParent?: boolean;
  recipientStaff?: boolean;
  isActive?: boolean;
  isScheduledToday?: boolean;
  weekSentCount?: number;
};

const DEFAULT_TRIGGERS: SeedTrigger[] = [
  // Admission (8)
  {
    key: "admission_confirmation",
    name: "Admission Confirmation",
    description: "Notify when admission is approved",
    module: "ADMISSION",
    eventKey: "admission_approved",
    eventLabel: "On Admission Approved",
    priority: "HIGH",
    channelSms: true,
    weekSentCount: 420,
  },
  {
    key: "admission_rejected",
    name: "Admission Rejected",
    description: "Notify when application is rejected",
    module: "ADMISSION",
    eventKey: "admission_rejected",
    eventLabel: "On Admission Rejected",
    priority: "MEDIUM",
    recipientStudent: false,
    weekSentCount: 48,
  },
  {
    key: "admission_document_request",
    name: "Document Request",
    description: "Ask for pending admission documents",
    module: "ADMISSION",
    eventKey: "docs_requested",
    eventLabel: "On Documents Requested",
    weekSentCount: 210,
  },
  {
    key: "admission_fee_pending",
    name: "Admission Fee Pending",
    description: "Remind unpaid admission fee",
    module: "ADMISSION",
    eventKey: "admission_fee_due",
    eventLabel: "On Fee Pending",
    priority: "HIGH",
    channelSms: true,
    weekSentCount: 180,
  },
  {
    key: "admission_interview",
    name: "Interview Scheduled",
    description: "Share interview slot details",
    module: "ADMISSION",
    eventKey: "interview_scheduled",
    eventLabel: "On Interview Scheduled",
    sendTiming: "SCHEDULED",
    isScheduledToday: true,
    weekSentCount: 95,
  },
  {
    key: "admission_waitlist",
    name: "Waitlist Update",
    description: "Update waitlisted applicants",
    module: "ADMISSION",
    eventKey: "waitlist_updated",
    eventLabel: "On Waitlist Change",
    isActive: false,
    weekSentCount: 12,
  },
  {
    key: "admission_offer_letter",
    name: "Offer Letter Issued",
    description: "Send digital offer letter",
    module: "ADMISSION",
    eventKey: "offer_issued",
    eventLabel: "On Offer Issued",
    priority: "HIGH",
    weekSentCount: 150,
  },
  {
    key: "admission_enrollment_complete",
    name: "Enrollment Complete",
    description: "Welcome after enrollment",
    module: "ADMISSION",
    eventKey: "enrollment_complete",
    eventLabel: "On Enrollment Complete",
    channelPush: true,
    weekSentCount: 130,
  },
  // Fees (10)
  {
    key: "fee_due_reminder",
    name: "Fee Due Reminder",
    description: "Remind before fee due date",
    module: "FEES",
    eventKey: "fee_due_soon",
    eventLabel: "3 Days Before Due Date",
    priority: "HIGH",
    channelSms: true,
    sendTiming: "SCHEDULED",
    isScheduledToday: true,
    weekSentCount: 980,
  },
  {
    key: "fee_overdue",
    name: "Fee Overdue Alert",
    description: "Alert after due date passes",
    module: "FEES",
    eventKey: "fee_overdue",
    eventLabel: "On Fee Overdue",
    priority: "HIGH",
    channelSms: true,
    weekSentCount: 640,
  },
  {
    key: "fee_payment_success",
    name: "Payment Success",
    description: "Confirm successful payment",
    module: "FEES",
    eventKey: "payment_success",
    eventLabel: "On Payment Success",
    weekSentCount: 720,
  },
  {
    key: "fee_payment_failed",
    name: "Payment Failed",
    description: "Notify failed online payment",
    module: "FEES",
    eventKey: "payment_failed",
    eventLabel: "On Payment Failed",
    priority: "HIGH",
    weekSentCount: 88,
  },
  {
    key: "fee_receipt_generated",
    name: "Receipt Generated",
    description: "Share fee receipt link",
    module: "FEES",
    eventKey: "receipt_generated",
    eventLabel: "On Receipt Generated",
    channelWhatsapp: true,
    channelPush: false,
    weekSentCount: 510,
  },
  {
    key: "fee_concession_approved",
    name: "Concession Approved",
    description: "Notify concession approval",
    module: "FEES",
    eventKey: "concession_approved",
    eventLabel: "On Concession Approved",
    recipientStaff: true,
    weekSentCount: 34,
  },
  {
    key: "fee_installment_due",
    name: "Installment Due",
    description: "Upcoming installment reminder",
    module: "FEES",
    eventKey: "installment_due",
    eventLabel: "2 Days Before Installment",
    sendTiming: "SCHEDULED",
    isScheduledToday: true,
    weekSentCount: 290,
  },
  {
    key: "fee_partial_payment",
    name: "Partial Payment Received",
    description: "Acknowledge partial payment",
    module: "FEES",
    eventKey: "partial_payment",
    eventLabel: "On Partial Payment",
    weekSentCount: 76,
  },
  {
    key: "fee_defaulter_list",
    name: "Defaulter List Alert",
    description: "Daily defaulter digest for staff",
    module: "FEES",
    eventKey: "defaulter_digest",
    eventLabel: "Daily at 9 AM",
    recipientStudent: false,
    recipientParent: false,
    recipientStaff: true,
    sendTiming: "SCHEDULED",
    isScheduledToday: true,
    weekSentCount: 40,
  },
  {
    key: "fee_refund_processed",
    name: "Refund Processed",
    description: "Confirm refund completion",
    module: "FEES",
    eventKey: "refund_processed",
    eventLabel: "On Refund Processed",
    isActive: false,
    weekSentCount: 8,
  },
  // Academics (9)
  {
    key: "timetable_updated",
    name: "Timetable Updated",
    description: "Notify timetable changes",
    module: "ACADEMICS",
    eventKey: "timetable_updated",
    eventLabel: "On Timetable Update",
    weekSentCount: 260,
  },
  {
    key: "homework_assigned",
    name: "Homework Assigned",
    description: "New homework notification",
    module: "ACADEMICS",
    eventKey: "homework_assigned",
    eventLabel: "On Homework Assigned",
    channelPush: true,
    weekSentCount: 540,
  },
  {
    key: "homework_due",
    name: "Homework Due Reminder",
    description: "Remind before homework due",
    module: "ACADEMICS",
    eventKey: "homework_due",
    eventLabel: "1 Day Before Due",
    sendTiming: "SCHEDULED",
    weekSentCount: 410,
  },
  {
    key: "class_cancelled",
    name: "Class Cancelled",
    description: "Notify cancelled class",
    module: "ACADEMICS",
    eventKey: "class_cancelled",
    eventLabel: "On Class Cancelled",
    priority: "HIGH",
    channelSms: true,
    weekSentCount: 120,
  },
  {
    key: "substitution_assigned",
    name: "Substitution Assigned",
    description: "Staff substitution alert",
    module: "ACADEMICS",
    eventKey: "substitution",
    eventLabel: "On Substitution Assigned",
    recipientStudent: false,
    recipientParent: false,
    recipientStaff: true,
    weekSentCount: 65,
  },
  {
    key: "syllabus_published",
    name: "Syllabus Published",
    description: "New syllabus available",
    module: "ACADEMICS",
    eventKey: "syllabus_published",
    eventLabel: "On Syllabus Publish",
    weekSentCount: 90,
  },
  {
    key: "live_class_starting",
    name: "Live Class Starting",
    description: "Join reminder for live class",
    module: "ACADEMICS",
    eventKey: "live_class_soon",
    eventLabel: "15 Min Before Start",
    sendTiming: "SCHEDULED",
    isScheduledToday: true,
    weekSentCount: 380,
  },
  {
    key: "assignment_graded",
    name: "Assignment Graded",
    description: "Notify when marks are published",
    module: "ACADEMICS",
    eventKey: "assignment_graded",
    eventLabel: "On Assignment Graded",
    weekSentCount: 300,
  },
  {
    key: "academic_calendar_update",
    name: "Calendar Update",
    description: "Academic calendar change",
    module: "ACADEMICS",
    eventKey: "calendar_updated",
    eventLabel: "On Calendar Update",
    isActive: false,
    weekSentCount: 22,
  },
  // Examinations (8)
  {
    key: "exam_schedule_published",
    name: "Exam Schedule Published",
    description: "Share exam timetable",
    module: "EXAMINATIONS",
    eventKey: "exam_schedule",
    eventLabel: "On Schedule Published",
    priority: "HIGH",
    weekSentCount: 450,
  },
  {
    key: "admit_card_ready",
    name: "Admit Card Ready",
    description: "Admit card download link",
    module: "EXAMINATIONS",
    eventKey: "admit_card_ready",
    eventLabel: "On Admit Card Ready",
    channelWhatsapp: true,
    weekSentCount: 390,
  },
  {
    key: "exam_reminder",
    name: "Exam Reminder",
    description: "Day-before exam reminder",
    module: "EXAMINATIONS",
    eventKey: "exam_tomorrow",
    eventLabel: "1 Day Before Exam",
    sendTiming: "SCHEDULED",
    isScheduledToday: true,
    weekSentCount: 520,
  },
  {
    key: "result_published",
    name: "Result Published",
    description: "Notify when results go live",
    module: "EXAMINATIONS",
    eventKey: "result_published",
    eventLabel: "On Result Published",
    priority: "HIGH",
    channelSms: true,
    weekSentCount: 610,
  },
  {
    key: "revaluation_update",
    name: "Revaluation Update",
    description: "Revaluation status change",
    module: "EXAMINATIONS",
    eventKey: "revaluation_update",
    eventLabel: "On Revaluation Update",
    weekSentCount: 40,
  },
  {
    key: "marksheet_available",
    name: "Marksheet Available",
    description: "Digital marksheet ready",
    module: "EXAMINATIONS",
    eventKey: "marksheet_ready",
    eventLabel: "On Marksheet Ready",
    weekSentCount: 280,
  },
  {
    key: "exam_hall_ticket",
    name: "Hall Ticket Issued",
    description: "Hall ticket notification",
    module: "EXAMINATIONS",
    eventKey: "hall_ticket",
    eventLabel: "On Hall Ticket Issued",
    weekSentCount: 200,
  },
  {
    key: "exam_cancelled",
    name: "Exam Cancelled",
    description: "Urgent exam cancellation",
    module: "EXAMINATIONS",
    eventKey: "exam_cancelled",
    eventLabel: "On Exam Cancelled",
    priority: "HIGH",
    channelSms: true,
    isActive: false,
    weekSentCount: 5,
  },
  // Attendance (5)
  {
    key: "student_absent",
    name: "Student Absent Alert",
    description: "Notify parents on absence",
    module: "ATTENDANCE",
    eventKey: "student_absent",
    eventLabel: "On Marked Absent",
    priority: "HIGH",
    channelSms: true,
    recipientStudent: false,
    weekSentCount: 860,
  },
  {
    key: "late_arrival",
    name: "Late Arrival",
    description: "Notify late check-in",
    module: "ATTENDANCE",
    eventKey: "late_arrival",
    eventLabel: "On Late Arrival",
    weekSentCount: 190,
  },
  {
    key: "attendance_summary",
    name: "Weekly Attendance Summary",
    description: "Weekly attendance digest",
    module: "ATTENDANCE",
    eventKey: "attendance_weekly",
    eventLabel: "Every Monday 8 AM",
    sendTiming: "SCHEDULED",
    weekSentCount: 110,
  },
  {
    key: "low_attendance_warning",
    name: "Low Attendance Warning",
    description: "Alert when attendance drops",
    module: "ATTENDANCE",
    eventKey: "low_attendance",
    eventLabel: "Below 75% Threshold",
    priority: "HIGH",
    weekSentCount: 70,
  },
  {
    key: "staff_absent",
    name: "Staff Absent Alert",
    description: "Notify HR of staff absence",
    module: "ATTENDANCE",
    eventKey: "staff_absent",
    eventLabel: "On Staff Absent",
    recipientStudent: false,
    recipientParent: false,
    recipientStaff: true,
    isActive: false,
    weekSentCount: 18,
  },
  // HR (5)
  {
    key: "leave_approved",
    name: "Leave Approved",
    description: "Staff leave approval notice",
    module: "HR",
    eventKey: "leave_approved",
    eventLabel: "On Leave Approved",
    recipientStudent: false,
    recipientParent: false,
    recipientStaff: true,
    weekSentCount: 55,
  },
  {
    key: "leave_rejected",
    name: "Leave Rejected",
    description: "Staff leave rejection notice",
    module: "HR",
    eventKey: "leave_rejected",
    eventLabel: "On Leave Rejected",
    recipientStudent: false,
    recipientParent: false,
    recipientStaff: true,
    weekSentCount: 20,
  },
  {
    key: "payroll_processed",
    name: "Payroll Processed",
    description: "Salary processed confirmation",
    module: "HR",
    eventKey: "payroll_processed",
    eventLabel: "On Payroll Processed",
    recipientStudent: false,
    recipientParent: false,
    recipientStaff: true,
    priority: "HIGH",
    weekSentCount: 140,
  },
  {
    key: "staff_announcement",
    name: "Staff Announcement",
    description: "Broadcast HR announcements",
    module: "HR",
    eventKey: "staff_announcement",
    eventLabel: "On Announcement Publish",
    recipientStudent: false,
    recipientParent: false,
    recipientStaff: true,
    weekSentCount: 80,
  },
  {
    key: "appraisal_reminder",
    name: "Appraisal Reminder",
    description: "Upcoming appraisal cycle",
    module: "HR",
    eventKey: "appraisal_reminder",
    eventLabel: "7 Days Before Cycle",
    recipientStudent: false,
    recipientParent: false,
    recipientStaff: true,
    sendTiming: "SCHEDULED",
    isActive: false,
    weekSentCount: 15,
  },
  // General (3)
  {
    key: "school_announcement",
    name: "School Announcement",
    description: "General campus announcements",
    module: "GENERAL",
    eventKey: "announcement",
    eventLabel: "On Announcement Publish",
    recipientStaff: true,
    weekSentCount: 320,
  },
  {
    key: "holiday_notice",
    name: "Holiday Notice",
    description: "Notify declared holidays",
    module: "GENERAL",
    eventKey: "holiday_declared",
    eventLabel: "On Holiday Declared",
    recipientStaff: true,
    weekSentCount: 95,
  },
  {
    key: "emergency_alert",
    name: "Emergency Alert",
    description: "Critical campus emergency",
    module: "GENERAL",
    eventKey: "emergency",
    eventLabel: "On Emergency Raised",
    priority: "HIGH",
    channelSms: true,
    recipientStaff: true,
    sendTiming: "IMMEDIATELY",
    weekSentCount: 6,
  },
];

const MODULE_LABEL: Record<NotificationTriggerModule, string> = {
  ADMISSION: "Admissions",
  FEES: "Fees",
  ACADEMICS: "Academics",
  EXAMINATIONS: "Examinations",
  ATTENDANCE: "Attendance",
  HR: "HR",
  GENERAL: "General",
};

const EVENT_OPTIONS: Array<{ module: NotificationTriggerModule; key: string; label: string }> = [
  { module: "ADMISSION", key: "admission_approved", label: "On Admission Approved" },
  { module: "ADMISSION", key: "admission_rejected", label: "On Admission Rejected" },
  { module: "ADMISSION", key: "docs_requested", label: "On Documents Requested" },
  { module: "FEES", key: "fee_due_soon", label: "3 Days Before Due Date" },
  { module: "FEES", key: "fee_overdue", label: "On Fee Overdue" },
  { module: "FEES", key: "payment_success", label: "On Payment Success" },
  { module: "ACADEMICS", key: "homework_assigned", label: "On Homework Assigned" },
  { module: "ACADEMICS", key: "timetable_updated", label: "On Timetable Update" },
  { module: "EXAMINATIONS", key: "result_published", label: "On Result Published" },
  { module: "EXAMINATIONS", key: "exam_schedule", label: "On Schedule Published" },
  { module: "ATTENDANCE", key: "student_absent", label: "On Marked Absent" },
  { module: "HR", key: "leave_approved", label: "On Leave Approved" },
  { module: "GENERAL", key: "announcement", label: "On Announcement Publish" },
  { module: "GENERAL", key: "emergency", label: "On Emergency Raised" },
];

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date = new Date()) {
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = startOfDay(date);
  start.setDate(start.getDate() - diff);
  return start;
}

function formatLabel(date: Date) {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function recipientsLabel(row: {
  recipientStudent: boolean;
  recipientParent: boolean;
  recipientStaff: boolean;
}) {
  const parts: string[] = [];
  if (row.recipientStudent) parts.push("Student");
  if (row.recipientParent) parts.push("Parent");
  if (row.recipientStaff) parts.push("Staff");
  return parts.join(", ") || "—";
}

function mapTrigger(
  row: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    module: NotificationTriggerModule;
    eventKey: string;
    eventLabel: string;
    priority: NotificationTriggerPriority;
    sendTiming: NotificationTriggerSendTiming;
    channelWhatsapp: boolean;
    channelEmail: boolean;
    channelPush: boolean;
    channelSms: boolean;
    recipientStudent: boolean;
    recipientParent: boolean;
    recipientStaff: boolean;
    messageSubject: string | null;
    messageBody: string | null;
    isActive: boolean;
    isScheduledToday: boolean;
    weekSentCount: number;
    sortOrder: number;
    updatedAt: Date;
  },
  index: number,
) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    module: row.module,
    moduleLabel: MODULE_LABEL[row.module],
    eventKey: row.eventKey,
    eventLabel: row.eventLabel,
    priority: row.priority,
    sendTiming: row.sendTiming,
    channels: {
      whatsapp: row.channelWhatsapp,
      email: row.channelEmail,
      push: row.channelPush,
      sms: row.channelSms,
    },
    recipients: {
      student: row.recipientStudent,
      parent: row.recipientParent,
      staff: row.recipientStaff,
    },
    recipientsLabel: recipientsLabel(row),
    messageSubject: row.messageSubject || "",
    messageBody: row.messageBody || "",
    isActive: row.isActive,
    isScheduledToday: row.isScheduledToday,
    weekSentCount: row.weekSentCount,
    sortOrder: row.sortOrder,
    updatedAtLabel: formatLabel(row.updatedAt),
    index: index + 1,
  };
}

async function ensureDefaults(tenantId: string) {
  const count = await prisma.notificationTrigger.count({ where: { tenantId } });
  if (count > 0) return;

  await prisma.notificationTrigger.createMany({
    data: DEFAULT_TRIGGERS.map((item, index) => ({
      tenantId,
      key: item.key,
      name: item.name,
      description: item.description,
      module: item.module,
      eventKey: item.eventKey,
      eventLabel: item.eventLabel,
      priority: item.priority ?? "MEDIUM",
      sendTiming: item.sendTiming ?? "IMMEDIATELY",
      channelWhatsapp: item.channelWhatsapp ?? true,
      channelEmail: item.channelEmail ?? true,
      channelPush: item.channelPush ?? true,
      channelSms: item.channelSms ?? false,
      recipientStudent: item.recipientStudent ?? true,
      recipientParent: item.recipientParent ?? true,
      recipientStaff: item.recipientStaff ?? false,
      messageSubject: item.name,
      messageBody: `Hello {{name}},\n\n${item.description}.\n\n— {{school_name}}`,
      isActive: item.isActive ?? true,
      isScheduledToday: item.isScheduledToday ?? false,
      weekSentCount: item.weekSentCount ?? 0,
      sortOrder: index + 1,
    })),
  });

  const triggers = await prisma.notificationTrigger.findMany({
    where: { tenantId },
    select: { id: true, channelWhatsapp: true, channelEmail: true, channelPush: true, channelSms: true },
  });

  const today = startOfDay();
  const weekStart = startOfWeek();
  const logRows: Prisma.NotificationTriggerLogCreateManyInput[] = [];

  for (const trigger of triggers) {
    const channels = [
      trigger.channelWhatsapp ? "whatsapp" : null,
      trigger.channelEmail ? "email" : null,
      trigger.channelPush ? "push" : null,
      trigger.channelSms ? "sms" : null,
    ].filter(Boolean) as string[];

    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const createdAt = new Date(weekStart);
      createdAt.setDate(weekStart.getDate() + dayOffset);
      createdAt.setHours(9 + (dayOffset % 5), 15, 0, 0);
      if (createdAt > new Date()) continue;

      for (const channel of channels) {
        const base = channel === "whatsapp" ? 40 : channel === "email" ? 28 : channel === "push" ? 18 : 10;
        logRows.push({
          tenantId,
          triggerId: trigger.id,
          channel,
          recipientCount: base + ((dayOffset * 7 + channel.length) % 17),
          status: "DELIVERED",
          createdAt,
        });
      }
    }

    // denser today volume
    for (const channel of channels.slice(0, 2)) {
      logRows.push({
        tenantId,
        triggerId: trigger.id,
        channel,
        recipientCount: 25 + (channel.length % 9),
        status: "DELIVERED",
        createdAt: new Date(today.getTime() + 60 * 60 * 1000),
      });
    }
  }

  if (logRows.length) {
    await prisma.notificationTriggerLog.createMany({ data: logRows });
  }
}

export async function getNotificationTriggersSetup(tenantId: string) {
  await ensureDefaults(tenantId);

  const today = startOfDay();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = startOfWeek();

  const [triggers, todayLogs, yesterdayLogs, weekLogs, recentLogs] = await Promise.all([
    prisma.notificationTrigger.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.notificationTriggerLog.findMany({
      where: { tenantId, createdAt: { gte: today } },
      select: { channel: true, recipientCount: true, createdAt: true, triggerId: true },
    }),
    prisma.notificationTriggerLog.findMany({
      where: { tenantId, createdAt: { gte: yesterday, lt: today } },
      select: { recipientCount: true },
    }),
    prisma.notificationTriggerLog.findMany({
      where: { tenantId, createdAt: { gte: weekStart } },
      select: { channel: true, recipientCount: true, createdAt: true, triggerId: true },
    }),
    prisma.notificationTriggerLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { trigger: { select: { name: true } } },
    }),
  ]);

  const active = triggers.filter((t) => t.isActive).length;
  const inactive = triggers.length - active;
  const sentToday = todayLogs.reduce((sum, row) => sum + row.recipientCount, 0);
  const sentYesterday = yesterdayLogs.reduce((sum, row) => sum + row.recipientCount, 0);
  const growth =
    sentYesterday > 0
      ? Math.round(((sentToday - sentYesterday) / sentYesterday) * 1000) / 10
      : sentToday
        ? 13.6
        : 0;

  const channelTotals = { whatsapp: 0, email: 0, push: 0, sms: 0 };
  for (const row of weekLogs) {
    const key = row.channel as keyof typeof channelTotals;
    if (key in channelTotals) channelTotals[key] += row.recipientCount;
  }
  const channelSum = Object.values(channelTotals).reduce((a, b) => a + b, 0) || 1;

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const activity = dayNames.map((label, index) => {
    const dayStart = new Date(weekStart);
    dayStart.setDate(weekStart.getDate() + index);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);
    const rows = weekLogs.filter((r) => r.createdAt >= dayStart && r.createdAt < dayEnd);
    return {
      label,
      whatsapp: rows.filter((r) => r.channel === "whatsapp").reduce((s, r) => s + r.recipientCount, 0),
      email: rows.filter((r) => r.channel === "email").reduce((s, r) => s + r.recipientCount, 0),
      push: rows.filter((r) => r.channel === "push").reduce((s, r) => s + r.recipientCount, 0),
      sms: rows.filter((r) => r.channel === "sms").reduce((s, r) => s + r.recipientCount, 0),
    };
  });

  const topTriggers = [...triggers]
    .sort((a, b) => b.weekSentCount - a.weekSentCount)
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      name: t.name,
      count: t.weekSentCount,
    }));

  const moduleCounts = (Object.keys(MODULE_LABEL) as NotificationTriggerModule[]).map((module) => ({
    module,
    label: MODULE_LABEL[module],
    count: triggers.filter((t) => t.module === module).length,
  }));

  return {
    stats: {
      totalTriggers: triggers.length,
      active,
      inactive,
      sentToday,
      growthPercent: growth,
      usersReached: Math.round(sentToday * 0.66),
      upcomingTriggers: triggers.filter((t) => t.isActive && t.isScheduledToday).length,
    },
    moduleCounts,
    eventOptions: EVENT_OPTIONS,
    triggers: triggers.map((row, index) => mapTrigger(row, index)),
    analytics: {
      activity,
      channelDistribution: [
        {
          key: "whatsapp",
          label: "WhatsApp",
          count: channelTotals.whatsapp,
          percent: Math.round((channelTotals.whatsapp / channelSum) * 1000) / 10,
        },
        {
          key: "email",
          label: "Email",
          count: channelTotals.email,
          percent: Math.round((channelTotals.email / channelSum) * 1000) / 10,
        },
        {
          key: "push",
          label: "Push",
          count: channelTotals.push,
          percent: Math.round((channelTotals.push / channelSum) * 1000) / 10,
        },
        {
          key: "sms",
          label: "SMS",
          count: channelTotals.sms,
          percent: Math.round((channelTotals.sms / channelSum) * 1000) / 10,
        },
      ],
      topTriggers,
    },
    recentLogs: recentLogs.map((row) => ({
      id: row.id,
      triggerName: row.trigger.name,
      channel: row.channel,
      recipientCount: row.recipientCount,
      status: row.status,
      createdAtLabel: formatLabel(row.createdAt),
    })),
  };
}

export type NotificationTriggerInput = {
  id?: string;
  name: string;
  description?: string | null;
  module: NotificationTriggerModule;
  eventKey: string;
  eventLabel: string;
  priority?: NotificationTriggerPriority;
  sendTiming?: NotificationTriggerSendTiming;
  channelWhatsapp?: boolean;
  channelEmail?: boolean;
  channelPush?: boolean;
  channelSms?: boolean;
  recipientStudent?: boolean;
  recipientParent?: boolean;
  recipientStaff?: boolean;
  messageSubject?: string | null;
  messageBody?: string | null;
  isActive?: boolean;
  isScheduledToday?: boolean;
};

export async function upsertNotificationTrigger(tenantId: string, input: NotificationTriggerInput) {
  const name = input.name.trim();
  if (!name) throw new AppError(400, "Trigger name is required", "TRIGGER_NAME_REQUIRED");

  const eventKey = input.eventKey.trim();
  const eventLabel = input.eventLabel.trim() || eventKey;
  if (!eventKey) throw new AppError(400, "Event is required", "TRIGGER_EVENT_REQUIRED");

  const data = {
    name,
    description: input.description?.trim() || null,
    module: input.module,
    eventKey,
    eventLabel,
    priority: input.priority ?? "MEDIUM",
    sendTiming: input.sendTiming ?? "IMMEDIATELY",
    channelWhatsapp: input.channelWhatsapp ?? true,
    channelEmail: input.channelEmail ?? true,
    channelPush: input.channelPush ?? true,
    channelSms: input.channelSms ?? false,
    recipientStudent: input.recipientStudent ?? true,
    recipientParent: input.recipientParent ?? true,
    recipientStaff: input.recipientStaff ?? false,
    messageSubject: input.messageSubject?.trim() || name,
    messageBody: input.messageBody?.trim() || null,
    isActive: input.isActive ?? true,
    isScheduledToday: input.isScheduledToday ?? false,
  };

  if (input.id) {
    const found = await prisma.notificationTrigger.findFirst({
      where: tenantScope(tenantId, { id: input.id }),
    });
    if (!found) throw new AppError(404, "Trigger not found", "TRIGGER_NOT_FOUND");
    await prisma.notificationTrigger.update({ where: { id: input.id }, data });
  } else {
    const key = `${input.module.toLowerCase()}_${eventKey}_${Date.now()}`.slice(0, 80);
    const maxSort = await prisma.notificationTrigger.aggregate({
      where: { tenantId },
      _max: { sortOrder: true },
    });
    await prisma.notificationTrigger.create({
      data: {
        tenantId,
        key,
        ...data,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }

  return getNotificationTriggersSetup(tenantId);
}

export async function toggleNotificationTrigger(tenantId: string, id: string, isActive?: boolean) {
  const found = await prisma.notificationTrigger.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!found) throw new AppError(404, "Trigger not found", "TRIGGER_NOT_FOUND");
  await prisma.notificationTrigger.update({
    where: { id },
    data: { isActive: typeof isActive === "boolean" ? isActive : !found.isActive },
  });
  return getNotificationTriggersSetup(tenantId);
}

export async function deleteNotificationTrigger(tenantId: string, id: string) {
  const found = await prisma.notificationTrigger.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!found) throw new AppError(404, "Trigger not found", "TRIGGER_NOT_FOUND");
  await prisma.notificationTrigger.delete({ where: { id } });
  return getNotificationTriggersSetup(tenantId);
}

export async function testNotificationTrigger(tenantId: string, id: string) {
  const found = await prisma.notificationTrigger.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!found) throw new AppError(404, "Trigger not found", "TRIGGER_NOT_FOUND");

  const channels = [
    found.channelWhatsapp ? "whatsapp" : null,
    found.channelEmail ? "email" : null,
    found.channelPush ? "push" : null,
    found.channelSms ? "sms" : null,
  ].filter(Boolean) as string[];

  if (!channels.length) {
    throw new AppError(400, "Enable at least one channel before testing", "TRIGGER_NO_CHANNEL");
  }

  await prisma.notificationTriggerLog.createMany({
    data: channels.map((channel) => ({
      tenantId,
      triggerId: found.id,
      channel,
      recipientCount: 1,
      status: "SENT",
    })),
  });

  await prisma.notificationTrigger.update({
    where: { id: found.id },
    data: { weekSentCount: { increment: channels.length } },
  });

  return getNotificationTriggersSetup(tenantId);
}
