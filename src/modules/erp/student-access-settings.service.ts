import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

export const STUDENT_PORTAL_PERMISSIONS = [
  { key: "VIEW_PROFILE", label: "View Profile" },
  { key: "UPDATE_PROFILE", label: "Update Profile" },
  { key: "VIEW_ATTENDANCE", label: "View Attendance" },
  { key: "VIEW_TIMETABLE", label: "View Timetable" },
  { key: "VIEW_EXAM_RESULTS", label: "View Exam Results" },
  { key: "VIEW_FEES", label: "View Fees" },
  { key: "VIEW_HOMEWORK", label: "View Homework" },
  { key: "DOWNLOAD_STUDY_MATERIAL", label: "Download Study Material" },
  { key: "VIEW_NOTICES", label: "View Notices" },
  { key: "RAISE_SUPPORT_TICKET", label: "Raise Support Ticket" },
  { key: "APPLY_LEAVE", label: "Apply Leave" },
  { key: "ONLINE_PAYMENTS", label: "Online Payments" },
  { key: "VIEW_LIBRARY", label: "View Library" },
  { key: "BOOK_TRANSPORT", label: "Book Transport" },
  { key: "VIEW_HOSTEL", label: "View Hostel Info" },
] as const;

export type StudentPortalPermissionKey = (typeof STUDENT_PORTAL_PERMISSIONS)[number]["key"];

const DEFAULT_ENABLED: StudentPortalPermissionKey[] = [
  "VIEW_PROFILE",
  "UPDATE_PROFILE",
  "VIEW_ATTENDANCE",
  "VIEW_TIMETABLE",
  "VIEW_EXAM_RESULTS",
  "VIEW_FEES",
  "VIEW_HOMEWORK",
  "DOWNLOAD_STUDY_MATERIAL",
  "VIEW_NOTICES",
  "RAISE_SUPPORT_TICKET",
  "APPLY_LEAVE",
  "ONLINE_PAYMENTS",
];

const ALL_KEYS = new Set(STUDENT_PORTAL_PERMISSIONS.map((item) => item.key));

export type StudentAccessSettingsInput = {
  disableStudentLogin?: boolean;
  allowProfileEditing?: boolean;
  profileEditFrom?: Date | string | null;
  profileEditTo?: Date | string | null;
  selectedClassIds?: string[];
  enabledPermissions?: string[];
};

function defaultProfileWindow(now = new Date()) {
  const year = now.getUTCFullYear();
  return {
    from: new Date(Date.UTC(year, 4, 1)),
    to: new Date(Date.UTC(year, 6, 31)),
  };
}

function toDateOnly(value: Date | string | null | undefined) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "Invalid date value", "INVALID_DATE");
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function normalizePermissions(keys?: string[]) {
  if (!keys) return [...DEFAULT_ENABLED];
  return [...new Set(keys.map((key) => key.trim().toUpperCase()).filter((key) => ALL_KEYS.has(key as StudentPortalPermissionKey)))];
}

async function getOrCreateSetting(tenantId: string) {
  const existing = await prisma.tenantStudentAccessSetting.findUnique({ where: { tenantId } });
  if (existing) {
    if (!existing.enabledPermissions.length) {
      return prisma.tenantStudentAccessSetting.update({
        where: { tenantId },
        data: { enabledPermissions: DEFAULT_ENABLED },
      });
    }
    return existing;
  }

  const window = defaultProfileWindow();
  return prisma.tenantStudentAccessSetting.create({
    data: {
      tenantId,
      disableStudentLogin: false,
      allowProfileEditing: true,
      profileEditFrom: window.from,
      profileEditTo: window.to,
      selectedClassIds: [],
      enabledPermissions: DEFAULT_ENABLED,
    },
  });
}

function mapSettings(row: Awaited<ReturnType<typeof getOrCreateSetting>>) {
  return {
    disableStudentLogin: row.disableStudentLogin,
    allowProfileEditing: row.allowProfileEditing,
    profileEditFrom: row.profileEditFrom,
    profileEditTo: row.profileEditTo,
    selectedClassIds: row.selectedClassIds,
    enabledPermissions: row.enabledPermissions,
  };
}

export async function getStudentAccessSettingsSetup(tenantId: string) {
  const [settings, classes] = await Promise.all([
    getOrCreateSetting(tenantId),
    prisma.academicClass.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        sortOrder: true,
        _count: { select: { classSections: true } },
      },
    }),
  ]);

  const validIds = new Set(classes.map((item) => item.id));
  const selectedClassIds = settings.selectedClassIds.filter((id) => validIds.has(id));

  return {
    settings: {
      ...mapSettings(settings),
      selectedClassIds,
    },
    classes: classes.map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      sortOrder: item.sortOrder,
      sectionCount: item._count.classSections,
      label: item._count.classSections > 0 ? `${item.name} - All Sections` : item.name,
    })),
    permissionCatalog: STUDENT_PORTAL_PERMISSIONS.map((item) => ({ ...item })),
  };
}

export async function updateStudentAccessSettings(
  tenantId: string,
  input: StudentAccessSettingsInput,
) {
  await getOrCreateSetting(tenantId);

  const profileEditFrom =
    input.profileEditFrom !== undefined ? toDateOnly(input.profileEditFrom) : undefined;
  const profileEditTo =
    input.profileEditTo !== undefined ? toDateOnly(input.profileEditTo) : undefined;

  if (profileEditFrom && profileEditTo && profileEditFrom > profileEditTo) {
    throw new AppError(400, "Profile edit From date cannot be after To date", "INVALID_DATE_RANGE");
  }

  let selectedClassIds: string[] | undefined;
  if (input.selectedClassIds) {
    const classes = await prisma.academicClass.findMany({
      where: { tenantId, id: { in: input.selectedClassIds } },
      select: { id: true },
    });
    const valid = new Set(classes.map((item) => item.id));
    selectedClassIds = input.selectedClassIds.filter((id) => valid.has(id));
  }

  const row = await prisma.tenantStudentAccessSetting.update({
    where: { tenantId },
    data: {
      ...(input.disableStudentLogin != null
        ? { disableStudentLogin: input.disableStudentLogin }
        : {}),
      ...(input.allowProfileEditing != null
        ? { allowProfileEditing: input.allowProfileEditing }
        : {}),
      ...(profileEditFrom !== undefined ? { profileEditFrom } : {}),
      ...(profileEditTo !== undefined ? { profileEditTo } : {}),
      ...(selectedClassIds !== undefined ? { selectedClassIds } : {}),
      ...(input.enabledPermissions !== undefined
        ? { enabledPermissions: normalizePermissions(input.enabledPermissions) }
        : {}),
    },
  });

  return mapSettings(row);
}

export async function assertStudentLoginAllowed(tenantId: string) {
  const settings = await prisma.tenantStudentAccessSetting.findUnique({
    where: { tenantId },
    select: { disableStudentLogin: true },
  });
  if (settings?.disableStudentLogin) {
    throw new AppError(
      403,
      "Student login is currently disabled for this school",
      "STUDENT_LOGIN_DISABLED",
    );
  }
}
