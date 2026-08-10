import type { MessageNoticeTemplateType } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

type Seed = {
  key: string;
  name: string;
  description: string;
  type: MessageNoticeTemplateType;
  category: string;
  language?: string;
  subject?: string;
  body: string;
  channelWhatsapp?: boolean;
  channelSms?: boolean;
  channelPush?: boolean;
  channelEmail?: boolean;
  isActive?: boolean;
  usedInTriggers?: boolean;
};

const VARIABLES = [
  { key: "{{Student Name}}", label: "Student full name" },
  { key: "{{Parent Name}}", label: "Parent / guardian name" },
  { key: "{{School Name}}", label: "Tenant / school name" },
  { key: "{{Class}}", label: "Class name" },
  { key: "{{Section}}", label: "Section name" },
  { key: "{{Adm No}}", label: "Admission number" },
  { key: "{{Amount}}", label: "Fee amount" },
  { key: "{{Due Date}}", label: "Payment due date" },
  { key: "{{Exam Name}}", label: "Examination name" },
  { key: "{{Date}}", label: "Event date" },
  { key: "{{Time}}", label: "Event time" },
  { key: "{{Staff Name}}", label: "Staff member name" },
];

function msg(
  key: string,
  name: string,
  description: string,
  category: string,
  body: string,
  channels: Partial<Pick<Seed, "channelWhatsapp" | "channelSms" | "channelPush" | "channelEmail">> = {},
  extras: Partial<Seed> = {},
): Seed {
  return {
    key,
    name,
    description,
    type: "MESSAGE",
    category,
    body,
    channelWhatsapp: channels.channelWhatsapp ?? true,
    channelSms: channels.channelSms ?? true,
    channelPush: channels.channelPush ?? true,
    channelEmail: channels.channelEmail ?? false,
    ...extras,
  };
}

function notice(
  key: string,
  name: string,
  description: string,
  category: string,
  body: string,
  extras: Partial<Seed> = {},
): Seed {
  return {
    key,
    name,
    description,
    type: "NOTICE",
    category,
    subject: name,
    body,
    channelWhatsapp: false,
    channelSms: false,
    channelPush: true,
    channelEmail: true,
    ...extras,
  };
}

function email(
  key: string,
  name: string,
  description: string,
  category: string,
  body: string,
  extras: Partial<Seed> = {},
): Seed {
  return {
    key,
    name,
    description,
    type: "EMAIL",
    category,
    subject: name,
    body,
    channelWhatsapp: false,
    channelSms: false,
    channelPush: false,
    channelEmail: true,
    ...extras,
  };
}

const DEFAULT_TEMPLATES: Seed[] = [
  // Messages (36)
  msg(
    "welcome_new_student",
    "Welcome - New Student",
    "Sent when a student is enrolled",
    "Admission",
    "Dear {{Parent Name}},\n\nWelcome to {{School Name}}! {{Student Name}} (Adm No: {{Adm No}}) has been enrolled in {{Class}}-{{Section}}.\n\nRegards,\n{{School Name}}",
    { channelEmail: true },
  ),
  msg(
    "fee_payment_reminder",
    "Fee Payment Reminder",
    "Reminder before fee due date",
    "Fees",
    "Dear {{Parent Name}},\n\nFee of {{Amount}} for {{Student Name}} ({{Class}}-{{Section}}) is due on {{Due Date}}. Please pay on time.\n\n— {{School Name}}",
    { channelSms: true, channelWhatsapp: true, channelPush: true },
  ),
  msg(
    "fee_overdue_alert",
    "Fee Overdue Alert",
    "Alert after due date",
    "Fees",
    "Dear {{Parent Name}}, fee of {{Amount}} for {{Student Name}} is overdue. Please clear dues at the earliest. — {{School Name}}",
  ),
  msg(
    "payment_success",
    "Payment Success",
    "Confirm successful payment",
    "Fees",
    "Payment of {{Amount}} received for {{Student Name}}. Thank you. — {{School Name}}",
    { channelSms: true, channelWhatsapp: true },
  ),
  msg(
    "admission_approved",
    "Admission Approved",
    "Notify admission approval",
    "Admission",
    "Congratulations! Admission of {{Student Name}} to {{Class}} at {{School Name}} is approved. Adm No: {{Adm No}}.",
  ),
  msg(
    "admission_document_request",
    "Document Request",
    "Request pending documents",
    "Admission",
    "Dear {{Parent Name}}, please submit pending documents for {{Student Name}} at the earliest. — {{School Name}}",
  ),
  msg(
    "homework_assigned",
    "Homework Assigned",
    "New homework alert",
    "Academics",
    "New homework assigned for {{Student Name}} ({{Class}}-{{Section}}). Due: {{Due Date}}.",
    { channelSms: false, channelPush: true, channelWhatsapp: true },
  ),
  msg(
    "homework_due_reminder",
    "Homework Due Reminder",
    "Day-before homework reminder",
    "Academics",
    "Reminder: homework for {{Student Name}} is due tomorrow ({{Due Date}}).",
    { channelSms: false },
  ),
  msg(
    "class_cancelled",
    "Class Cancelled",
    "Urgent cancellation notice",
    "Academics",
    "Class for {{Class}}-{{Section}} on {{Date}} at {{Time}} has been cancelled. — {{School Name}}",
    { channelSms: true },
  ),
  msg(
    "live_class_starting",
    "Live Class Starting",
    "Join reminder for live class",
    "Academics",
    "Live class for {{Class}}-{{Section}} starts at {{Time}}. Please join on time.",
    { channelSms: false, channelPush: true },
  ),
  msg(
    "exam_schedule_alert",
    "Exam Schedule Alert",
    "Exam timetable published",
    "Examinations",
    "{{Exam Name}} schedule is published for {{Student Name}}. Check the portal for details.",
  ),
  msg(
    "exam_reminder",
    "Exam Reminder",
    "Day-before exam reminder",
    "Examinations",
    "Reminder: {{Exam Name}} for {{Student Name}} is tomorrow ({{Date}}).",
  ),
  msg(
    "result_published_msg",
    "Result Published",
    "Results available alert",
    "Examinations",
    "Results for {{Exam Name}} are now available for {{Student Name}}. — {{School Name}}",
  ),
  msg(
    "admit_card_ready_msg",
    "Admit Card Ready",
    "Admit card download alert",
    "Examinations",
    "Admit card for {{Exam Name}} is ready for {{Student Name}}. Download from the parent portal.",
  ),
  msg(
    "student_absent_alert",
    "Student Absent Alert",
    "Notify parent on absence",
    "Attendance",
    "Dear {{Parent Name}}, {{Student Name}} was marked absent on {{Date}}. — {{School Name}}",
    { channelSms: true, channelWhatsapp: true },
  ),
  msg(
    "late_arrival_alert",
    "Late Arrival Alert",
    "Late check-in notice",
    "Attendance",
    "{{Student Name}} arrived late on {{Date}} at {{Time}}. — {{School Name}}",
    { channelSms: false },
  ),
  msg(
    "low_attendance_warning",
    "Low Attendance Warning",
    "Attendance below threshold",
    "Attendance",
    "Attendance for {{Student Name}} ({{Class}}-{{Section}}) is below the required threshold. Please contact school.",
  ),
  msg(
    "holiday_notice_msg",
    "Holiday Notice",
    "Holiday declaration alert",
    "General",
    "{{School Name}} will remain closed on {{Date}}. Enjoy the holiday!",
  ),
  msg(
    "school_announcement_msg",
    "School Announcement",
    "General announcement broadcast",
    "General",
    "Announcement from {{School Name}}: please check the notice board / app for details.",
  ),
  msg(
    "transport_delay",
    "Transport Delay",
    "Bus delay notification",
    "Transport",
    "School bus for {{Student Name}} is delayed. Expected time: {{Time}}. — {{School Name}}",
    { channelSms: true },
  ),
  msg(
    "library_due",
    "Library Book Due",
    "Book return reminder",
    "Library",
    "Library book for {{Student Name}} is due on {{Due Date}}. Please return on time.",
    { channelSms: false, channelPush: true },
  ),
  msg(
    "id_card_ready",
    "ID Card Ready",
    "ID card collection notice",
    "General",
    "ID card for {{Student Name}} ({{Adm No}}) is ready for collection. — {{School Name}}",
  ),
  msg(
    "meeting_reminder",
    "PTM Reminder",
    "Parent-teacher meeting reminder",
    "General",
    "PTM for {{Class}}-{{Section}} is scheduled on {{Date}} at {{Time}}. — {{School Name}}",
  ),
  msg(
    "leave_approved_parent",
    "Student Leave Approved",
    "Leave approval to parent",
    "Attendance",
    "Leave request for {{Student Name}} on {{Date}} has been approved.",
    { channelSms: false },
  ),
  msg(
    "fee_receipt_msg",
    "Fee Receipt",
    "Receipt available alert",
    "Fees",
    "Fee receipt for {{Amount}} ({{Student Name}}) is available on the portal.",
    { channelSms: false, channelWhatsapp: true },
  ),
  msg(
    "installment_due_msg",
    "Installment Due",
    "Upcoming installment reminder",
    "Fees",
    "Installment of {{Amount}} for {{Student Name}} is due on {{Due Date}}.",
  ),
  msg(
    "assignment_graded_msg",
    "Assignment Graded",
    "Marks published alert",
    "Academics",
    "Assignment for {{Student Name}} has been graded. Check the portal for scores.",
    { channelSms: false, channelPush: true },
  ),
  msg(
    "syllabus_update_msg",
    "Syllabus Update",
    "Syllabus change alert",
    "Academics",
    "Syllabus for {{Class}}-{{Section}} has been updated. Please review on the app.",
    { channelSms: false },
  ),
  msg(
    "event_invite_msg",
    "Event Invitation",
    "School event invite",
    "General",
    "You are invited to {{School Name}} event on {{Date}} at {{Time}}. — {{School Name}}",
  ),
  msg(
    "birthday_wish_msg",
    "Birthday Wish",
    "Student birthday greeting",
    "General",
    "Happy Birthday {{Student Name}}! Wishing you a wonderful year ahead. — {{School Name}}",
    { channelSms: false, channelPush: true, channelWhatsapp: true },
  ),
  msg(
    "staff_leave_approved",
    "Staff Leave Approved",
    "Leave approval for staff",
    "HR",
    "Dear {{Staff Name}}, your leave on {{Date}} has been approved. — {{School Name}}",
    { channelSms: false, channelPush: true, channelWhatsapp: true },
    { usedInTriggers: true },
  ),
  msg(
    "payroll_processed_msg",
    "Payroll Processed",
    "Salary processed alert",
    "HR",
    "Dear {{Staff Name}}, payroll for this month has been processed. — {{School Name}}",
    { channelSms: false, channelEmail: true },
  ),
  msg(
    "emergency_alert_msg",
    "Emergency Alert",
    "Critical emergency broadcast",
    "General",
    "EMERGENCY from {{School Name}}: please check your phone / portal immediately.",
    { channelSms: true, channelWhatsapp: true, channelPush: true },
  ),
  msg(
    "revaluation_update_msg",
    "Revaluation Update",
    "Revaluation status message",
    "Examinations",
    "Revaluation update for {{Student Name}} ({{Exam Name}}) is available on the portal.",
    { channelSms: false },
    { isActive: false, usedInTriggers: true },
  ),
  msg(
    "waitlist_update_msg",
    "Waitlist Update",
    "Admission waitlist change",
    "Admission",
    "Waitlist status for {{Student Name}} has been updated. Please check the portal.",
    {},
    { isActive: false, usedInTriggers: false },
  ),
  msg(
    "unused_promo_msg",
    "Promotional Offer",
    "Unused promotional template",
    "General",
    "Special offer from {{School Name}} for {{Parent Name}}. Contact office for details.",
    { channelSms: true },
    { isActive: false, usedInTriggers: false },
  ),

  // Notices (14)
  notice(
    "exam_timetable_notice",
    "Exam Timetable Notice",
    "Published exam timetable for portal",
    "Examinations",
    "Dear Parents,\n\nThe timetable for {{Exam Name}} has been published.\n\nStudent: {{Student Name}}\nClass: {{Class}}-{{Section}}\n\nPlease download the schedule from the parent portal.\n\n— {{School Name}}",
  ),
  notice(
    "fee_structure_notice",
    "Fee Structure Notice",
    "Annual fee structure announcement",
    "Fees",
    "Fee structure for the academic year is now available. Please review dues for {{Student Name}} ({{Class}}-{{Section}}).",
  ),
  notice(
    "academic_calendar_notice",
    "Academic Calendar Notice",
    "Calendar publication notice",
    "Academics",
    "Academic calendar has been updated. Holidays and events are listed on the portal.",
  ),
  notice(
    "uniform_policy_notice",
    "Uniform Policy Notice",
    "Dress code reminder",
    "General",
    "All students must follow the school uniform policy from {{Date}}. Contact office for queries.",
  ),
  notice(
    "ptm_notice",
    "Parent Teacher Meeting",
    "PTM schedule notice",
    "General",
    "PTM for {{Class}}-{{Section}} will be held on {{Date}} at {{Time}}. Your presence is requested.",
  ),
  notice(
    "result_declaration_notice",
    "Result Declaration",
    "Result day notice",
    "Examinations",
    "Results for {{Exam Name}} will be declared on {{Date}}. Parents may collect report cards from school.",
  ),
  notice(
    "sports_day_notice",
    "Sports Day Notice",
    "Annual sports day invite",
    "General",
    "Annual Sports Day will be celebrated on {{Date}}. Students of {{Class}} are requested to participate.",
  ),
  notice(
    "library_rules_notice",
    "Library Rules",
    "Library usage guidelines",
    "Library",
    "Updated library rules are in effect from {{Date}}. Please ensure books are returned by {{Due Date}}.",
  ),
  notice(
    "transport_route_notice",
    "Transport Route Change",
    "Bus route update notice",
    "Transport",
    "Transport routes have been revised. Please check the updated stop timings on the portal.",
  ),
  notice(
    "health_checkup_notice",
    "Health Checkup Notice",
    "Annual health checkup",
    "General",
    "Health checkup for students will be conducted on {{Date}}. Consent forms are available on the portal.",
  ),
  notice(
    "exam_hall_ticket_notice",
    "Hall Ticket Notice",
    "Hall ticket collection",
    "Examinations",
    "Hall tickets for {{Exam Name}} are ready. Collect from office with Adm No {{Adm No}}.",
  ),
  notice(
    "attendance_policy_notice",
    "Attendance Policy",
    "Minimum attendance policy",
    "Attendance",
    "Students must maintain minimum attendance. Parents of {{Student Name}} will be notified if below threshold.",
  ),
  notice(
    "unused_draft_notice",
    "Draft Circular",
    "Unused draft circular",
    "General",
    "Draft circular content for internal review only.",
    { isActive: false, usedInTriggers: false },
  ),
  notice(
    "summer_camp_notice",
    "Summer Camp Notice",
    "Summer camp registration",
    "General",
    "Summer camp registration opens on {{Date}}. Limited seats for {{Class}} students.",
  ),

  // Email templates (8)
  email(
    "welcome_email",
    "Welcome Email",
    "Full welcome email for new admissions",
    "Admission",
    "Dear {{Parent Name}},\n\nWe are delighted to welcome {{Student Name}} to {{School Name}}.\n\nClass: {{Class}}-{{Section}}\nAdmission No: {{Adm No}}\n\nPlease complete the onboarding checklist on the portal.\n\nWarm regards,\n{{School Name}}",
  ),
  email(
    "fee_invoice_email",
    "Fee Invoice Email",
    "Detailed fee invoice email",
    "Fees",
    "Dear {{Parent Name}},\n\nPlease find the fee invoice for {{Student Name}}.\nAmount Due: {{Amount}}\nDue Date: {{Due Date}}\n\nPay online via the parent portal.\n\n— Accounts, {{School Name}}",
  ),
  email(
    "report_card_email",
    "Report Card Email",
    "Report card delivery email",
    "Examinations",
    "Dear {{Parent Name}},\n\nThe report card for {{Student Name}} ({{Exam Name}}) is attached / available on the portal.\n\n— {{School Name}}",
  ),
  email(
    "leave_status_email",
    "Leave Status Email",
    "Staff leave status email",
    "HR",
    "Dear {{Staff Name}},\n\nYour leave request for {{Date}} has been updated. Please check HR portal for details.\n\n— {{School Name}}",
  ),
  email(
    "newsletter_email",
    "Monthly Newsletter",
    "School newsletter email",
    "General",
    "Dear Parents,\n\nHere is the monthly newsletter from {{School Name}}. Highlights for {{Class}} are available on the portal.\n\n— {{School Name}}",
  ),
  email(
    "password_reset_email",
    "Password Reset",
    "Portal password reset email",
    "System",
    "Dear user,\n\nA password reset was requested for your {{School Name}} account. If this wasn't you, contact support.\n\n— {{School Name}}",
  ),
  email(
    "event_confirmation_email",
    "Event Confirmation",
    "Event registration confirmation",
    "General",
    "Dear {{Parent Name}},\n\nYour registration for the school event on {{Date}} at {{Time}} is confirmed for {{Student Name}}.\n\n— {{School Name}}",
  ),
  email(
    "unused_alumni_email",
    "Alumni Outreach",
    "Unused alumni outreach email",
    "General",
    "Dear Alumni,\n\nWe would love to reconnect. Visit {{School Name}} portal for updates.",
    { isActive: true, usedInTriggers: false },
  ),
];

function formatUpdatedAt(value: Date) {
  return value.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function extractVariables(body: string, subject?: string | null) {
  const text = `${subject || ""}\n${body}`;
  const matches = text.match(/\{\{[^}]+\}\}/g) || [];
  return [...new Set(matches)];
}

function mapTemplate(
  row: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    type: MessageNoticeTemplateType;
    category: string;
    language: string;
    subject: string | null;
    body: string;
    channelWhatsapp: boolean;
    channelSms: boolean;
    channelPush: boolean;
    channelEmail: boolean;
    isActive: boolean;
    usedInTriggers: boolean;
    updatedAt: Date;
  },
  index: number,
) {
  const variables = extractVariables(row.body, row.subject);
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    type: row.type,
    typeLabel: row.type === "MESSAGE" ? "Message" : row.type === "NOTICE" ? "Notice" : "Email",
    category: row.category,
    language: row.language,
    languageLabel: row.language === "en" ? "English" : row.language.toUpperCase(),
    subject: row.subject || "",
    body: row.body,
    channels: {
      whatsapp: row.channelWhatsapp,
      sms: row.channelSms,
      push: row.channelPush,
      email: row.channelEmail,
    },
    isActive: row.isActive,
    usedInTriggers: row.usedInTriggers,
    variables,
    updatedAtLabel: formatUpdatedAt(row.updatedAt),
    index: index + 1,
  };
}

async function ensureDefaults(tenantId: string) {
  const count = await prisma.messageNoticeTemplate.count({ where: { tenantId } });
  if (count > 0) return;

  await prisma.messageNoticeTemplate.createMany({
    data: DEFAULT_TEMPLATES.map((item, index) => ({
      tenantId,
      key: item.key,
      name: item.name,
      description: item.description,
      type: item.type,
      category: item.category,
      language: item.language || "en",
      subject: item.subject || null,
      body: item.body,
      channelWhatsapp: item.channelWhatsapp ?? false,
      channelSms: item.channelSms ?? false,
      channelPush: item.channelPush ?? false,
      channelEmail: item.channelEmail ?? false,
      isActive: item.isActive ?? true,
      usedInTriggers: item.usedInTriggers ?? true,
      sortOrder: index + 1,
    })),
  });
}

export async function getMessageNoticeTemplatesSetup(tenantId: string) {
  await ensureDefaults(tenantId);

  const templates = await prisma.messageNoticeTemplate.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const total = templates.length;
  const messageCount = templates.filter((t) => t.type === "MESSAGE").length;
  const noticeCount = templates.filter((t) => t.type === "NOTICE" || t.type === "EMAIL").length;
  const emailCount = templates.filter((t) => t.type === "EMAIL" || t.channelEmail).length;
  const active = templates.filter((t) => t.isActive).length;
  const unused = templates.filter((t) => !t.usedInTriggers).length;

  const categories = [...new Set(templates.map((t) => t.category))].sort();

  return {
    stats: {
      total,
      messageCount,
      noticeCount,
      emailCount,
      active,
      unused,
      activePercent: total ? Math.round((active / total) * 1000) / 10 : 0,
    },
    variables: VARIABLES,
    categories,
    templates: templates.map((row, index) => mapTemplate(row, index)),
  };
}

export type MessageNoticeTemplateInput = {
  id?: string;
  name: string;
  description?: string | null;
  type: MessageNoticeTemplateType;
  category: string;
  language?: string;
  subject?: string | null;
  body: string;
  channelWhatsapp?: boolean;
  channelSms?: boolean;
  channelPush?: boolean;
  channelEmail?: boolean;
  isActive?: boolean;
  usedInTriggers?: boolean;
};

export async function upsertMessageNoticeTemplate(
  tenantId: string,
  input: MessageNoticeTemplateInput,
) {
  const name = input.name.trim();
  const body = input.body.trim();
  const category = input.category.trim();
  if (!name) throw new AppError(400, "Template name is required", "TEMPLATE_NAME_REQUIRED");
  if (!body) throw new AppError(400, "Template body is required", "TEMPLATE_BODY_REQUIRED");
  if (!category) throw new AppError(400, "Category is required", "TEMPLATE_CATEGORY_REQUIRED");

  const data = {
    name,
    description: input.description?.trim() || null,
    type: input.type,
    category,
    language: input.language?.trim() || "en",
    subject: input.subject?.trim() || null,
    body,
    channelWhatsapp: input.channelWhatsapp ?? false,
    channelSms: input.channelSms ?? false,
    channelPush: input.channelPush ?? false,
    channelEmail: input.channelEmail ?? false,
    isActive: input.isActive ?? true,
    usedInTriggers: input.usedInTriggers ?? true,
  };

  if (input.id) {
    const found = await prisma.messageNoticeTemplate.findFirst({
      where: tenantScope(tenantId, { id: input.id }),
    });
    if (!found) throw new AppError(404, "Template not found", "TEMPLATE_NOT_FOUND");
    await prisma.messageNoticeTemplate.update({ where: { id: input.id }, data });
  } else {
    const key = `${input.type.toLowerCase()}_${name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .slice(0, 40)}_${Date.now()}`.slice(0, 80);
    const maxSort = await prisma.messageNoticeTemplate.aggregate({
      where: { tenantId },
      _max: { sortOrder: true },
    });
    await prisma.messageNoticeTemplate.create({
      data: {
        tenantId,
        key,
        ...data,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }

  return getMessageNoticeTemplatesSetup(tenantId);
}

export async function deleteMessageNoticeTemplate(tenantId: string, id: string) {
  const found = await prisma.messageNoticeTemplate.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!found) throw new AppError(404, "Template not found", "TEMPLATE_NOT_FOUND");
  await prisma.messageNoticeTemplate.delete({ where: { id } });
  return getMessageNoticeTemplatesSetup(tenantId);
}

export async function toggleMessageNoticeTemplate(
  tenantId: string,
  id: string,
  isActive?: boolean,
) {
  const found = await prisma.messageNoticeTemplate.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!found) throw new AppError(404, "Template not found", "TEMPLATE_NOT_FOUND");
  await prisma.messageNoticeTemplate.update({
    where: { id },
    data: { isActive: typeof isActive === "boolean" ? isActive : !found.isActive },
  });
  return getMessageNoticeTemplatesSetup(tenantId);
}
