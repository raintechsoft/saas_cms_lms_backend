import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

const DEFAULT_TENANT_ROLES = [
  {
    code: "TEACHER",
    name: "Teacher",
    permissions: [
      "students.view",
      "academics.view",
      "sessions.view",
      "attendance.view",
      "attendance.manage",
      "exams.view",
      "exams.manage",
      "documents.view",
      "documents.generate",
      "timetable.view",
      "homework.view",
      "homework.manage",
      "homework.evaluate",
      "question_bank.view",
      "question_bank.manage",
      "test_series.view",
      "test_series.manage",
      "lesson_planning.view",
      "lesson_planning.manage",
      "live_classes.view",
      "live_classes.manage",
      "ncert.view",
      "ncert.manage",
      "academic_calendar.view",
      "academic_calendar.manage",
    ],
  },
  {
    code: "ACCOUNTANT",
    name: "Accountant",
    permissions: [
      "students.view",
      "sessions.view",
      "fees.view",
      "fees.manage",
      "fees.collect",
      "hr.view",
      "payroll.manage",
      "reports.view",
    ],
  },
  {
    code: "STAFF",
    name: "Staff",
    permissions: [
      "students.view",
      "academics.view",
      "sessions.view",
      "attendance.view",
      "attendance.manage",
      "hr.view",
      "timetable.view",
      "timetable.manage",
      "homework.view",
      "homework.manage",
      "homework.evaluate",
      "question_bank.view",
      "question_bank.manage",
      "test_series.view",
      "test_series.manage",
      "lesson_planning.view",
      "lesson_planning.manage",
      "live_classes.view",
      "live_classes.manage",
      "ncert.view",
      "ncert.manage",
      "academic_calendar.view",
      "academic_calendar.manage",
    ],
  },
  {
    code: "STUDENT",
    name: "Student",
    permissions: ["timetable.view", "homework.view", "homework.submit", "academic_calendar.view"],
  },
  {
    code: "PARENT",
    name: "Parent",
    permissions: ["timetable.view", "homework.view", "academic_calendar.view"],
  },
] as const;

type DbClient = Prisma.TransactionClient | typeof prisma;

function currentAcademicSessionBounds() {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    name: `${startYear}-${startYear + 1}`,
    startDate: new Date(`${startYear}-04-01T00:00:00.000Z`),
    endDate: new Date(`${startYear + 1}-03-31T00:00:00.000Z`),
  };
}

export async function bootstrapTenantWorkspace(tenantId: string, client: DbClient = prisma) {
  const session = currentAcademicSessionBounds();
  await client.tenantSetting.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
      email: null,
      currency: "INR",
      timezone: "Asia/Kolkata",
      autoAdmissionNumber: true,
      admissionPrefix: "ADM-",
      nextAdmissionNumber: 1,
      onlineAdmission: false,
    },
  });
  await client.academicSession.upsert({
    where: { tenantId_name: { tenantId, name: session.name } },
    update: { isCurrent: true },
    create: {
      tenantId,
      name: session.name,
      startDate: session.startDate,
      endDate: session.endDate,
      isCurrent: true,
    },
  });
  const receiptBookCount = await client.feeReceiptBook.count({ where: { tenantId } });
  if (receiptBookCount === 0) {
    await client.feeReceiptBook.create({
      data: {
        tenantId,
        name: "Main",
        prefix: "RCPT-",
        isDefault: true,
      },
    });
  }
  await client.tenantFeeSetting.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId },
  });
}

export async function ensureInstitutionAdminRole(tenantId: string, client: DbClient = prisma) {
  for (const [key, description] of [
    ["library.view", "View library books and loans"],
    ["library.manage", "Manage library books and issue/return"],
    ["inventory.view", "View inventory stock and movements"],
    ["inventory.manage", "Manage inventory stock and issue items"],
    ["online_exam.view", "View online exams, attempts, and ranks"],
    ["online_exam.manage", "Manage online exams, questions, attempts, and grading"],
    ["question_bank.view", "View question bank questions and categories"],
    ["question_bank.manage", "Manage question bank questions, types, and settings"],
    ["test_series.view", "View LMS test series and papers"],
    ["test_series.manage", "Create and manage LMS test series from the Question Bank"],
    ["lesson_planning.view", "View LMS lesson plans"],
    ["lesson_planning.manage", "Create and manage LMS lesson plans"],
    ["live_classes.view", "View LMS live class sessions"],
    ["live_classes.manage", "Create and manage LMS live class sessions"],
    ["ncert.view", "View LMS NCERT study resources"],
    ["ncert.manage", "Create and manage LMS NCERT study resources"],
    ["academic_calendar.view", "View LMS academic calendar events"],
    ["academic_calendar.manage", "Create and manage LMS academic calendar events"],
    ["transport.view", "View transport routes and assignments"],
    ["transport.manage", "Manage transport routes and assignments"],
    ["hostel.view", "View hostel blocks, rooms, and assignments"],
    ["hostel.manage", "Manage hostel blocks, rooms, and assignments"],
  ] as const) {
    await client.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
  }

  const role = await client.role.upsert({
    where: { tenantId_code: { tenantId, code: "INSTITUTION_ADMIN" } },
    update: { name: "Institution Admin" },
    create: {
      tenantId,
      code: "INSTITUTION_ADMIN",
      name: "Institution Admin",
      isSystem: true,
    },
  });
  const permissions = await client.permission.findMany({
    where: { key: { notIn: ["platform.manage", "tenants.manage"] } },
  });
  await client.rolePermission.deleteMany({ where: { roleId: role.id } });
  if (permissions.length) {
    await client.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
    });
  }

  for (const moduleKey of [
    "library",
    "inventory",
    "onlineExam",
    "questionBank",
    "testSeries",
    "lessonPlanning",
    "liveClasses",
    "ncertLibrary",
    "academicCalendar",
    "transport",
    "hostel",
  ] as const) {
    await client.tenantModuleSetting.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
      update: {},
      create: {
        tenantId,
        moduleKey,
        adminEnabled: true,
        studentEnabled: true,
        parentEnabled: true,
      },
    });
  }

  return role;
}

export async function ensureTenantRoles(tenantId: string, client: DbClient = prisma) {
  const permissions = await client.permission.findMany({
    select: { id: true, key: true },
  });
  const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));

  for (const definition of DEFAULT_TENANT_ROLES) {
    const role = await client.role.upsert({
      where: { tenantId_code: { tenantId, code: definition.code } },
      update: { name: definition.name },
      create: {
        tenantId,
        code: definition.code,
        name: definition.name,
        isSystem: true,
      },
    });

    await client.rolePermission.deleteMany({ where: { roleId: role.id } });
    const permissionIds = definition.permissions
      .map((key) => permissionByKey.get(key))
      .filter((id): id is string => Boolean(id));
    if (permissionIds.length) {
      await client.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      });
    }
  }
}
