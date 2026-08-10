import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

type CatalogShortcut = {
  actionKey: string;
  label: string;
  module: string;
  category: string;
  defaultShortcut: string;
  description: string;
  icon: string;
};

const CATALOG: CatalogShortcut[] = [
  { actionKey: "common.save", label: "Save", module: "Common", category: "General", defaultShortcut: "Ctrl+S", description: "Save the current form or page.", icon: "save" },
  { actionKey: "common.search", label: "Global Search", module: "Common", category: "General", defaultShortcut: "Ctrl+K", description: "Open global search across the system.", icon: "search" },
  { actionKey: "common.refresh", label: "Refresh", module: "Common", category: "General", defaultShortcut: "F5", description: "Reload the current page data.", icon: "refresh" },
  { actionKey: "common.print", label: "Print", module: "Common", category: "General", defaultShortcut: "Ctrl+P", description: "Print the current view or document.", icon: "print" },
  { actionKey: "common.help", label: "Help", module: "Common", category: "General", defaultShortcut: "F1", description: "Open help and documentation.", icon: "help" },
  { actionKey: "common.close", label: "Close Panel", module: "Common", category: "General", defaultShortcut: "Esc", description: "Close the open modal or side panel.", icon: "close" },
  { actionKey: "common.new", label: "Quick Create", module: "Common", category: "Create", defaultShortcut: "Ctrl+Shift+N", description: "Open quick create menu.", icon: "add" },
  { actionKey: "common.delete", label: "Delete", module: "Common", category: "Actions", defaultShortcut: "Del", description: "Delete the selected record.", icon: "delete" },
  { actionKey: "common.select_all", label: "Select All", module: "Common", category: "Actions", defaultShortcut: "Ctrl+A", description: "Select all rows in the current table.", icon: "select" },
  { actionKey: "common.undo", label: "Undo", module: "Common", category: "Actions", defaultShortcut: "Ctrl+Z", description: "Undo the last change where supported.", icon: "undo" },
  { actionKey: "students.add", label: "Add New Student", module: "Student Management", category: "Create", defaultShortcut: "Ctrl+N", description: "Open the add student form.", icon: "person_add" },
  { actionKey: "students.list", label: "Student List", module: "Student Management", category: "Navigation", defaultShortcut: "Alt+S", description: "Go to the student list page.", icon: "people" },
  { actionKey: "students.search", label: "Search Students", module: "Student Management", category: "Actions", defaultShortcut: "Ctrl+F", description: "Focus student search box.", icon: "search" },
  { actionKey: "students.profile", label: "Open Student Profile", module: "Student Management", category: "Navigation", defaultShortcut: "Alt+P", description: "Open profile for the selected student.", icon: "person" },
  { actionKey: "students.promote", label: "Promote Students", module: "Student Management", category: "Actions", defaultShortcut: "Ctrl+Shift+P", description: "Open student promotion workflow.", icon: "upgrade" },
  { actionKey: "students.export", label: "Export Students", module: "Student Management", category: "Actions", defaultShortcut: "Ctrl+E", description: "Export student records.", icon: "download" },
  { actionKey: "attendance.mark", label: "Mark Attendance", module: "Attendance", category: "Actions", defaultShortcut: "Ctrl+M", description: "Open attendance marking screen.", icon: "event" },
  { actionKey: "attendance.today", label: "Today Attendance", module: "Attendance", category: "Navigation", defaultShortcut: "Alt+A", description: "Jump to today's attendance view.", icon: "today" },
  { actionKey: "attendance.report", label: "Attendance Report", module: "Attendance", category: "Reports", defaultShortcut: "Ctrl+Shift+A", description: "Open attendance reports.", icon: "report" },
  { actionKey: "fees.collect", label: "Collect Fees", module: "Fees", category: "Actions", defaultShortcut: "Ctrl+B", description: "Open fee collection screen.", icon: "payments" },
  { actionKey: "fees.invoice", label: "Create Invoice", module: "Fees", category: "Create", defaultShortcut: "Ctrl+I", description: "Create a new fee invoice.", icon: "receipt" },
  { actionKey: "fees.receipt", label: "Print Receipt", module: "Fees", category: "Actions", defaultShortcut: "Ctrl+Shift+R", description: "Print the selected fee receipt.", icon: "print" },
  { actionKey: "fees.report", label: "Fee Report", module: "Fees", category: "Reports", defaultShortcut: "Alt+F", description: "Open fee collection reports.", icon: "report" },
  { actionKey: "academics.classes", label: "Class & Section", module: "Academics", category: "Navigation", defaultShortcut: "Alt+C", description: "Open class and section setup.", icon: "school" },
  { actionKey: "academics.subjects", label: "Subject Setup", module: "Academics", category: "Navigation", defaultShortcut: "Alt+U", description: "Open subject setup page.", icon: "menu_book" },
  { actionKey: "academics.timetable", label: "Timetable", module: "Academics", category: "Navigation", defaultShortcut: "Alt+T", description: "Open timetable view.", icon: "schedule" },
  { actionKey: "exams.create", label: "Create Exam", module: "Examinations", category: "Create", defaultShortcut: "Ctrl+Shift+E", description: "Create a new exam group or exam.", icon: "assignment" },
  { actionKey: "exams.marks", label: "Enter Marks", module: "Examinations", category: "Actions", defaultShortcut: "Ctrl+Shift+M", description: "Open marks entry screen.", icon: "edit" },
  { actionKey: "exams.results", label: "View Results", module: "Examinations", category: "Reports", defaultShortcut: "Alt+R", description: "Open exam results view.", icon: "analytics" },
  { actionKey: "homework.add", label: "Assign Homework", module: "Homework", category: "Create", defaultShortcut: "Ctrl+H", description: "Create and assign homework.", icon: "homework" },
  { actionKey: "homework.review", label: "Review Submissions", module: "Homework", category: "Actions", defaultShortcut: "Ctrl+Shift+H", description: "Review homework submissions.", icon: "rate_review" },
  { actionKey: "hr.add_staff", label: "Add Staff", module: "Staff & HR", category: "Create", defaultShortcut: "Ctrl+Shift+S", description: "Open add staff form.", icon: "badge" },
  { actionKey: "hr.attendance", label: "Staff Attendance", module: "Staff & HR", category: "Actions", defaultShortcut: "Alt+H", description: "Open staff attendance page.", icon: "event" },
  { actionKey: "hr.leave", label: "Leave Requests", module: "Staff & HR", category: "Actions", defaultShortcut: "Ctrl+L", description: "Open staff leave requests.", icon: "event_busy" },
  { actionKey: "hr.payroll", label: "Generate Payroll", module: "Staff & HR", category: "Actions", defaultShortcut: "Ctrl+Shift+Y", description: "Open payroll generation.", icon: "payments" },
  { actionKey: "library.issue", label: "Issue Book", module: "Library", category: "Actions", defaultShortcut: "Ctrl+Shift+L", description: "Issue a library book.", icon: "library" },
  { actionKey: "library.return", label: "Return Book", module: "Library", category: "Actions", defaultShortcut: "Ctrl+Shift+B", description: "Return a borrowed book.", icon: "library" },
  { actionKey: "transport.assign", label: "Assign Transport", module: "Transport", category: "Actions", defaultShortcut: "Alt+X", description: "Assign student to transport route.", icon: "bus" },
  { actionKey: "hostel.allocate", label: "Allocate Hostel", module: "Hostel", category: "Actions", defaultShortcut: "Alt+O", description: "Allocate hostel bed to student.", icon: "hostel" },
  { actionKey: "reports.hub", label: "Reports Hub", module: "Reports", category: "Navigation", defaultShortcut: "Alt+G", description: "Open the reports hub.", icon: "report" },
  { actionKey: "dashboard.open", label: "Dashboard", module: "Common", category: "Navigation", defaultShortcut: "Alt+D", description: "Go to the main dashboard.", icon: "dashboard" },
  { actionKey: "erp.settings", label: "ERP Settings", module: "Common", category: "Navigation", defaultShortcut: "Alt+E", description: "Open ERP settings.", icon: "settings" },
  { actionKey: "notices.add", label: "Add Notice", module: "Communication", category: "Create", defaultShortcut: "Ctrl+Shift+O", description: "Create a new notice.", icon: "campaign" },
  { actionKey: "documents.upload", label: "Upload Document", module: "Documents", category: "Create", defaultShortcut: "Ctrl+U", description: "Upload a student or staff document.", icon: "upload" },
  { actionKey: "inventory.add", label: "Add Inventory Item", module: "Inventory", category: "Create", defaultShortcut: "Ctrl+Shift+I", description: "Add a new inventory item.", icon: "inventory" },
  { actionKey: "online_exam.create", label: "Create Online Exam", module: "Online Exam", category: "Create", defaultShortcut: "Ctrl+Shift+Q", description: "Create a new online exam.", icon: "quiz" },
  { actionKey: "calendar.open", label: "Academic Calendar", module: "Academics", category: "Navigation", defaultShortcut: "Alt+Y", description: "Open academic calendar.", icon: "calendar" },
  { actionKey: "settings.profile", label: "My Profile", module: "Common", category: "Navigation", defaultShortcut: "Alt+M", description: "Open the signed-in user profile.", icon: "person" },
];

export type ShortcutSaveItem = {
  actionKey: string;
  shortcut: string;
  isEnabled?: boolean;
};

function normalizeShortcut(value: string) {
  return value
    .trim()
    .replace(/\s*\+\s*/g, "+")
    .replace(/\s+/g, " ")
    .split("+")
    .map((part) => {
      const token = part.trim();
      const lower = token.toLowerCase();
      if (lower === "ctrl" || lower === "control") return "Ctrl";
      if (lower === "alt") return "Alt";
      if (lower === "shift") return "Shift";
      if (lower === "meta" || lower === "cmd" || lower === "command") return "Meta";
      if (lower === "esc" || lower === "escape") return "Esc";
      if (lower === "del" || lower === "delete") return "Del";
      if (/^f\d{1,2}$/i.test(token)) return token.toUpperCase();
      return token.length === 1 ? token.toUpperCase() : token;
    })
    .join("+");
}

function mapSetup(tenantId: string, overrides: Array<{ actionKey: string; shortcut: string; isEnabled: boolean }>) {
  const overrideMap = new Map(overrides.map((row) => [row.actionKey, row]));
  const shortcuts = CATALOG.map((item, index) => {
    const override = overrideMap.get(item.actionKey);
    const shortcut = override ? normalizeShortcut(override.shortcut) : item.defaultShortcut;
    const isEnabled = override?.isEnabled ?? true;
    const isCustom = Boolean(override) && normalizeShortcut(override!.shortcut) !== item.defaultShortcut;
    return {
      id: item.actionKey,
      index: index + 1,
      actionKey: item.actionKey,
      label: item.label,
      module: item.module,
      category: item.category,
      shortcut,
      defaultShortcut: item.defaultShortcut,
      description: item.description,
      icon: item.icon,
      isEnabled,
      isCustom,
      status: isCustom ? "CUSTOM" : "ACTIVE",
    };
  });

  return {
    shortcuts,
    modules: [...new Set(CATALOG.map((item) => item.module))],
    categories: [...new Set(CATALOG.map((item) => item.category))],
    stats: {
      total: shortcuts.length,
      active: shortcuts.filter((item) => item.isEnabled).length,
      custom: shortcuts.filter((item) => item.isCustom).length,
      defaultCount: shortcuts.filter((item) => !item.isCustom).length,
    },
    tenantId,
  };
}

export async function getShortcutKeysSetup(tenantId: string) {
  const overrides = await prisma.shortcutKeySetting.findMany({
    where: { tenantId },
    select: { actionKey: true, shortcut: true, isEnabled: true },
  });
  return mapSetup(tenantId, overrides);
}

export async function saveShortcutKeys(tenantId: string, items: ShortcutSaveItem[]) {
  const catalogKeys = new Set(CATALOG.map((item) => item.actionKey));
  const defaults = new Map(CATALOG.map((item) => [item.actionKey, item.defaultShortcut]));

  const normalized = items.map((item) => {
    if (!catalogKeys.has(item.actionKey)) {
      throw new AppError(400, `Unknown shortcut action "${item.actionKey}"`, "INVALID_SHORTCUT_ACTION");
    }
    const shortcut = normalizeShortcut(item.shortcut);
    if (!shortcut) {
      throw new AppError(400, "Shortcut key is required", "SHORTCUT_REQUIRED");
    }
    return {
      actionKey: item.actionKey,
      shortcut,
      isEnabled: item.isEnabled ?? true,
    };
  });

  const enabledShortcuts = normalized.filter((item) => item.isEnabled).map((item) => item.shortcut);
  const uniqueCheck = new Set(enabledShortcuts);
  if (uniqueCheck.size !== enabledShortcuts.length) {
    throw new AppError(409, "Duplicate shortcut keys found. Each shortcut must be unique.", "SHORTCUT_CONFLICT");
  }

  await prisma.$transaction(async (tx) => {
    await tx.shortcutKeySetting.deleteMany({ where: { tenantId } });

    const toCreate = normalized.filter((item) => {
      const defaultShortcut = defaults.get(item.actionKey)!;
      return !item.isEnabled || item.shortcut !== defaultShortcut;
    });

    if (toCreate.length) {
      await tx.shortcutKeySetting.createMany({
        data: toCreate.map((item) => ({
          tenantId,
          actionKey: item.actionKey,
          shortcut: item.shortcut,
          isEnabled: item.isEnabled,
        })),
      });
    }
  });

  return getShortcutKeysSetup(tenantId);
}

export async function resetShortcutKeys(tenantId: string, actionKey?: string) {
  if (actionKey) {
    if (!CATALOG.some((item) => item.actionKey === actionKey)) {
      throw new AppError(404, "Shortcut action not found", "SHORTCUT_NOT_FOUND");
    }
    await prisma.shortcutKeySetting.deleteMany({
      where: { tenantId, actionKey },
    });
  } else {
    await prisma.shortcutKeySetting.deleteMany({ where: { tenantId } });
  }
  return getShortcutKeysSetup(tenantId);
}
