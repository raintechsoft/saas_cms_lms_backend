/**
 * Tenant module keys shared by Super Admin persistence, requireModule gating,
 * and ERP module catalog alignment.
 *
 * Keys must stay in sync with frontend CAMPUS_NAV `moduleKey` values and
 * Super Admin LMS_MODULE_OPTIONS / CMS_MODULE_OPTIONS.
 */

/** Not licensed on subscription plans — Super Admin must force-enable per tenant. */
export const MANUAL_ENABLE_MODULE_KEYS = [
  "classroomManagement",
  "videoGallery",
  "voiceAiAgent",
  "resultsPerformance",
  "preparationPractice",
] as const;

export type ManualEnableModuleKey = (typeof MANUAL_ENABLE_MODULE_KEYS)[number];

export const MANUAL_ENABLE_MODULE_KEY_SET: ReadonlySet<string> = new Set(MANUAL_ENABLE_MODULE_KEYS);

/** Every module Super Admin can toggle / that campus may gate via requireModule. */
export const TENANT_MODULE_KEYS = [
  // CMS / shared operational
  "students",
  "academics",
  "attendance",
  "notices",
  "examinations",
  "homework",
  "fees",
  "hr",
  "documents",
  "erp",
  "timetable",
  "reports",
  "transport",
  "hostel",
  "library",
  "inventory",
  "onlineExam",
  // LMS product line
  "academicCalendar",
  "lessonPlanning",
  "liveClasses",
  "aiTutor",
  "ncertLibrary",
  "questionBank",
  "testSeries",
  ...MANUAL_ENABLE_MODULE_KEYS,
] as const;

export type TenantModuleKey = (typeof TENANT_MODULE_KEYS)[number];

export function isManualEnableModuleKey(moduleKey: string): boolean {
  return MANUAL_ENABLE_MODULE_KEY_SET.has(moduleKey);
}
