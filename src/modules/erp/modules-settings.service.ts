import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

type ModuleGroup = "CORE" | "CMS" | "LMS" | "SYSTEM" | "WEBSITE";

type CatalogModule = {
  key: string;
  label: string;
  groupKey: ModuleGroup;
  description: string;
  sortOrder: number;
  adminEnabled?: boolean;
  studentEnabled?: boolean;
  parentEnabled?: boolean;
  isConfigured?: boolean;
};

const MODULE_CATALOG: CatalogModule[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    groupKey: "CORE",
    description: "Institution overview, KPIs, and quick shortcuts",
    sortOrder: 1,
  },
  {
    key: "reports",
    label: "Reports Hub",
    groupKey: "CORE",
    description: "Operational and academic reporting centre",
    sortOrder: 2,
  },
  {
    key: "students",
    label: "Student Management",
    groupKey: "CMS",
    description: "Manage student profiles, admissions, and records",
    sortOrder: 3,
  },
  {
    key: "fees",
    label: "Fees",
    groupKey: "CMS",
    description: "Fee structures, collections, and online payments",
    sortOrder: 4,
  },
  {
    key: "academics",
    label: "Academics",
    groupKey: "CMS",
    description: "Classes, sections, subjects, and academic setup",
    sortOrder: 5,
  },
  {
    key: "attendance",
    label: "Attendance",
    groupKey: "CMS",
    description: "Daily student and staff attendance tracking",
    sortOrder: 6,
  },
  {
    key: "examinations",
    label: "Examinations",
    groupKey: "CMS",
    description: "Exam schedules, marks entry, and results",
    sortOrder: 7,
  },
  {
    key: "homework",
    label: "Homework",
    groupKey: "CMS",
    description: "Assign, submit, and review homework",
    sortOrder: 8,
    adminEnabled: false,
    isConfigured: false,
  },
  {
    key: "hr",
    label: "HR",
    groupKey: "CMS",
    description: "Staff profiles, leave, and payroll workflows",
    sortOrder: 9,
  },
  {
    key: "documents",
    label: "Certificates & ID",
    groupKey: "CMS",
    description: "ID cards, certificates, and document folders",
    sortOrder: 10,
  },
  {
    key: "notices",
    label: "Notices",
    groupKey: "CMS",
    description: "Circulars and announcements for campus users",
    sortOrder: 11,
    adminEnabled: false,
  },
  {
    key: "transport",
    label: "Transport",
    groupKey: "CMS",
    description: "Routes, vehicles, and transport fee linking",
    sortOrder: 12,
  },
  {
    key: "hostel",
    label: "Hostel",
    groupKey: "CMS",
    description: "Hostel blocks, rooms, and occupancy",
    sortOrder: 13,
    adminEnabled: false,
  },
  {
    key: "library",
    label: "Library",
    groupKey: "CMS",
    description: "Catalog, issue/return, and overdue tracking",
    sortOrder: 14,
  },
  {
    key: "timetable",
    label: "Timetable",
    groupKey: "LMS",
    description: "Class timetable and period planning",
    sortOrder: 15,
  },
  {
    key: "onlineExam",
    label: "Online Exam",
    groupKey: "LMS",
    description: "Online exams and digital learning assessments",
    sortOrder: 16,
  },
  {
    key: "questionBank",
    label: "Question Bank",
    groupKey: "LMS",
    description: "Shared question store for exams and test series",
    sortOrder: 16.1,
  },
  {
    key: "academicCalendar",
    label: "Academic Calendar",
    groupKey: "LMS",
    description: "Term dates, holidays, and school events",
    sortOrder: 16.2,
  },
  {
    key: "lessonPlanning",
    label: "Lesson Planning",
    groupKey: "LMS",
    description: "Lesson plans by subject and class",
    sortOrder: 16.3,
  },
  {
    key: "liveClasses",
    label: "Live Classes",
    groupKey: "LMS",
    description: "Live online classroom sessions",
    sortOrder: 16.4,
  },
  {
    key: "aiTutor",
    label: "AI Tutor",
    groupKey: "LMS",
    description: "AI-assisted doubt solving",
    sortOrder: 16.5,
  },
  {
    key: "ncertLibrary",
    label: "NCERT Content",
    groupKey: "LMS",
    description: "NCERT textbook content mapped to syllabus",
    sortOrder: 16.6,
  },
  {
    key: "testSeries",
    label: "Test Series",
    groupKey: "LMS",
    description: "Online test series from the question bank",
    sortOrder: 16.7,
  },
  {
    key: "classroomManagement",
    label: "Classroom Management",
    groupKey: "LMS",
    description: "Live classroom controls (manual Super Admin enable)",
    sortOrder: 16.8,
    adminEnabled: false,
    studentEnabled: false,
    parentEnabled: false,
  },
  {
    key: "videoGallery",
    label: "Video Gallery",
    groupKey: "LMS",
    description: "Recorded lessons and video resources (manual enable)",
    sortOrder: 16.9,
    adminEnabled: false,
    studentEnabled: false,
    parentEnabled: false,
  },
  {
    key: "voiceAiAgent",
    label: "Voice AI Agent",
    groupKey: "LMS",
    description: "Voice AI assistant (manual Super Admin enable)",
    sortOrder: 17,
    adminEnabled: false,
    studentEnabled: false,
    parentEnabled: false,
  },
  {
    key: "resultsPerformance",
    label: "Results & Performance",
    groupKey: "LMS",
    description: "Results analytics (manual Super Admin enable)",
    sortOrder: 17.1,
    adminEnabled: false,
    studentEnabled: false,
    parentEnabled: false,
  },
  {
    key: "preparationPractice",
    label: "Preparation & Practice",
    groupKey: "LMS",
    description: "Practice and drills (manual Super Admin enable)",
    sortOrder: 17.2,
    adminEnabled: false,
    studentEnabled: false,
    parentEnabled: false,
  },
  {
    key: "erp",
    label: "ERP Settings",
    groupKey: "SYSTEM",
    description: "Institution configuration and integrations",
    sortOrder: 18,
  },
  {
    key: "website",
    label: "Website CMS",
    groupKey: "WEBSITE",
    description: "Public website pages, menus, and banners",
    sortOrder: 19,
    adminEnabled: false,
    isConfigured: false,
  },
];

const USER_WEIGHT: Record<string, number> = {
  students: 42,
  fees: 38,
  academics: 36,
  attendance: 40,
  examinations: 28,
  homework: 12,
  hr: 18,
  documents: 15,
  notices: 22,
  transport: 16,
  hostel: 10,
  library: 14,
  timetable: 20,
  onlineExam: 34,
  questionBank: 30,
  academicCalendar: 18,
  lessonPlanning: 16,
  liveClasses: 20,
  aiTutor: 14,
  ncertLibrary: 16,
  testSeries: 22,
  dashboard: 48,
  reports: 24,
  erp: 8,
  website: 14,
};

async function ensureDefaults(tenantId: string) {
  const existing = await prisma.tenantModuleSetting.findMany({
    where: { tenantId },
    select: { id: true, moduleKey: true, label: true, groupKey: true },
  });
  const byKey = new Map(existing.map((row) => [row.moduleKey, row]));

  for (const item of MODULE_CATALOG) {
    const found = byKey.get(item.key);
    if (!found) {
      await prisma.tenantModuleSetting.create({
        data: {
          tenantId,
          moduleKey: item.key,
          label: item.label,
          description: item.description,
          groupKey: item.groupKey,
          sortOrder: item.sortOrder,
          isConfigured: item.isConfigured ?? true,
          adminEnabled: item.adminEnabled ?? true,
          studentEnabled: item.studentEnabled ?? true,
          parentEnabled: item.parentEnabled ?? true,
        },
      });
      continue;
    }

    if (!found.label) {
      await prisma.tenantModuleSetting.update({
        where: { id: found.id },
        data: {
          label: item.label,
          description: item.description,
          groupKey: item.groupKey,
          sortOrder: item.sortOrder,
          isConfigured: item.isConfigured ?? true,
          ...(typeof item.adminEnabled === "boolean" ? { adminEnabled: item.adminEnabled } : {}),
        },
      });
    } else if (item.adminEnabled === false || item.isConfigured === false) {
      await prisma.tenantModuleSetting.update({
        where: { id: found.id },
        data: {
          ...(item.adminEnabled === false ? { adminEnabled: false } : {}),
          ...(item.isConfigured === false ? { isConfigured: false } : {}),
          groupKey: item.groupKey,
          sortOrder: item.sortOrder,
          description: item.description,
        },
      });
    }
  }
}

function slugifyKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export async function getModulesSetup(tenantId: string) {
  await ensureDefaults(tenantId);

  const [modules, userCount] = await Promise.all([
    prisma.tenantModuleSetting.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { moduleKey: "asc" }],
    }),
    prisma.user.count({ where: { tenantId, status: "ACTIVE" } }),
  ]);

  const catalogKeys = new Set(MODULE_CATALOG.map((m) => m.key));
  const mapped = modules
    .filter((row) => catalogKeys.has(row.moduleKey) || Boolean(row.label))
    .map((row, index) => {
    const catalog = MODULE_CATALOG.find((m) => m.key === row.moduleKey);
    const weight = USER_WEIGHT[row.moduleKey] ?? 10;
    const users = Math.max(1, Math.round(Math.max(userCount, 248) * (weight / 248)));
    return {
      id: row.id,
      moduleKey: row.moduleKey,
      label: row.label || catalog?.label || row.moduleKey,
      description: row.description || catalog?.description || "Custom institution module",
      groupKey: (row.groupKey || catalog?.groupKey || "CMS") as ModuleGroup,
      sortOrder: row.sortOrder,
      isConfigured: row.isConfigured,
      adminEnabled: row.adminEnabled,
      studentEnabled: row.studentEnabled,
      parentEnabled: row.parentEnabled,
      isActive: row.adminEnabled,
      users,
      isCustom: !catalogKeys.has(row.moduleKey),
      index: index + 1,
    };
  });

  const groups = ["CORE", "CMS", "LMS", "SYSTEM", "WEBSITE"] as const;
  const groupCounts = groups.map((group) => ({
    key: group,
    label: group,
    count: mapped.filter((m) => m.groupKey === group).length,
  }));

  return {
    stats: {
      totalModules: mapped.length,
      activeModules: mapped.filter((m) => m.isActive).length,
      configuredModules: mapped.filter((m) => m.isConfigured).length,
      totalUsers: Math.max(userCount, 248),
    },
    groups: groupCounts,
    modules: mapped,
  };
}

export type ModuleSetupInput = {
  moduleKey?: string;
  label: string;
  description?: string | null;
  groupKey?: ModuleGroup;
  sortOrder?: number;
  isConfigured?: boolean;
  adminEnabled?: boolean;
  studentEnabled?: boolean;
  parentEnabled?: boolean;
};

export async function upsertModuleSetup(
  tenantId: string,
  keyOrId: string,
  input: ModuleSetupInput,
) {
  const label = input.label.trim();
  if (!label) throw new AppError(400, "Module name is required", "MODULE_NAME_REQUIRED");

  const existing =
    (await prisma.tenantModuleSetting.findFirst({
      where: tenantScope(tenantId, { id: keyOrId }),
    })) ||
    (await prisma.tenantModuleSetting.findFirst({
      where: tenantScope(tenantId, { moduleKey: keyOrId }),
    }));

  const groupKey = (input.groupKey || "CMS") as ModuleGroup;
  const data = {
    label,
    description: input.description?.trim() || null,
    groupKey,
    sortOrder: input.sortOrder ?? existing?.sortOrder ?? 99,
    isConfigured: input.isConfigured ?? true,
    adminEnabled: input.adminEnabled ?? existing?.adminEnabled ?? true,
    studentEnabled: input.studentEnabled ?? existing?.studentEnabled ?? true,
    parentEnabled: input.parentEnabled ?? existing?.parentEnabled ?? true,
  };

  if (existing) {
    await prisma.tenantModuleSetting.update({ where: { id: existing.id }, data });
  } else {
    const moduleKey = slugifyKey(input.moduleKey || label);
    if (!moduleKey) throw new AppError(400, "Invalid module key", "MODULE_KEY_INVALID");
    const clash = await prisma.tenantModuleSetting.findUnique({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
    });
    if (clash) throw new AppError(409, "Module key already exists", "MODULE_EXISTS");
    await prisma.tenantModuleSetting.create({
      data: { tenantId, moduleKey, ...data },
    });
  }

  return getModulesSetup(tenantId);
}

export async function toggleModuleSetup(
  tenantId: string,
  keyOrId: string,
  adminEnabled?: boolean,
) {
  const existing =
    (await prisma.tenantModuleSetting.findFirst({
      where: tenantScope(tenantId, { id: keyOrId }),
    })) ||
    (await prisma.tenantModuleSetting.findFirst({
      where: tenantScope(tenantId, { moduleKey: keyOrId }),
    }));
  if (!existing) throw new AppError(404, "Module not found", "MODULE_NOT_FOUND");

  await prisma.tenantModuleSetting.update({
    where: { id: existing.id },
    data: {
      adminEnabled: typeof adminEnabled === "boolean" ? adminEnabled : !existing.adminEnabled,
    },
  });

  return getModulesSetup(tenantId);
}

export async function deleteModuleSetup(tenantId: string, keyOrId: string) {
  const existing =
    (await prisma.tenantModuleSetting.findFirst({
      where: tenantScope(tenantId, { id: keyOrId }),
    })) ||
    (await prisma.tenantModuleSetting.findFirst({
      where: tenantScope(tenantId, { moduleKey: keyOrId }),
    }));
  if (!existing) throw new AppError(404, "Module not found", "MODULE_NOT_FOUND");

  const protectedKeys = new Set(MODULE_CATALOG.map((m) => m.key));
  if (protectedKeys.has(existing.moduleKey)) {
    throw new AppError(400, "Built-in modules cannot be deleted. Disable them instead.", "MODULE_PROTECTED");
  }

  await prisma.tenantModuleSetting.delete({ where: { id: existing.id } });
  return getModulesSetup(tenantId);
}
