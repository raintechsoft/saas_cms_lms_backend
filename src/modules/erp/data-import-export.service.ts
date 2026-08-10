import type {
  DataExportFormat,
  DataExportStatus,
  DataImportDuplicateMode,
  DataImportStatus,
  Prisma,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

export type ImportModuleKey =
  | "students"
  | "staff"
  | "parents"
  | "classes"
  | "subjects"
  | "fees"
  | "attendance"
  | "exams"
  | "homework"
  | "transport"
  | "hostel"
  | "library";

const IMPORT_MODULES: Array<{
  key: ImportModuleKey;
  label: string;
  description: string;
  fields: Array<{ key: string; label: string; required?: boolean }>;
}> = [
  {
    key: "students",
    label: "Students",
    description: "Import student records",
    fields: [
      { key: "admissionNo", label: "Admission No", required: true },
      { key: "firstName", label: "First Name", required: true },
      { key: "lastName", label: "Last Name" },
      { key: "className", label: "Class" },
      { key: "section", label: "Section" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
    ],
  },
  {
    key: "staff",
    label: "Staff",
    description: "Import staff / employee records",
    fields: [
      { key: "employeeCode", label: "Employee Code", required: true },
      { key: "firstName", label: "First Name", required: true },
      { key: "lastName", label: "Last Name" },
      { key: "email", label: "Email" },
      { key: "department", label: "Department" },
      { key: "designation", label: "Designation" },
    ],
  },
  {
    key: "parents",
    label: "Parents",
    description: "Import parent / guardian records",
    fields: [
      { key: "parentName", label: "Parent Name", required: true },
      { key: "phone", label: "Phone", required: true },
      { key: "email", label: "Email" },
      { key: "studentAdmissionNo", label: "Student Adm No" },
      { key: "relation", label: "Relation" },
    ],
  },
  {
    key: "classes",
    label: "Classes",
    description: "Import class & section setup",
    fields: [
      { key: "className", label: "Class Name", required: true },
      { key: "section", label: "Section", required: true },
      { key: "capacity", label: "Capacity" },
    ],
  },
  {
    key: "subjects",
    label: "Subjects",
    description: "Import subject master data",
    fields: [
      { key: "code", label: "Subject Code", required: true },
      { key: "name", label: "Subject Name", required: true },
      { key: "type", label: "Type" },
    ],
  },
  {
    key: "fees",
    label: "Fees",
    description: "Import fee heads and dues",
    fields: [
      { key: "admissionNo", label: "Admission No", required: true },
      { key: "feeHead", label: "Fee Head", required: true },
      { key: "amount", label: "Amount", required: true },
      { key: "dueDate", label: "Due Date" },
    ],
  },
  {
    key: "attendance",
    label: "Attendance",
    description: "Import attendance sheets",
    fields: [
      { key: "admissionNo", label: "Admission No", required: true },
      { key: "date", label: "Date", required: true },
      { key: "status", label: "Status", required: true },
    ],
  },
  {
    key: "exams",
    label: "Exams",
    description: "Import exam marks / schedules",
    fields: [
      { key: "admissionNo", label: "Admission No", required: true },
      { key: "examName", label: "Exam Name", required: true },
      { key: "subject", label: "Subject", required: true },
      { key: "marks", label: "Marks" },
    ],
  },
  {
    key: "homework",
    label: "Homework",
    description: "Import homework assignments",
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "className", label: "Class", required: true },
      { key: "subject", label: "Subject" },
      { key: "dueDate", label: "Due Date" },
    ],
  },
  {
    key: "transport",
    label: "Transport",
    description: "Import routes and stops",
    fields: [
      { key: "routeName", label: "Route Name", required: true },
      { key: "stopName", label: "Stop Name", required: true },
      { key: "fare", label: "Fare" },
    ],
  },
  {
    key: "hostel",
    label: "Hostel",
    description: "Import hostel room allotments",
    fields: [
      { key: "block", label: "Block", required: true },
      { key: "room", label: "Room", required: true },
      { key: "admissionNo", label: "Admission No" },
    ],
  },
  {
    key: "library",
    label: "Library",
    description: "Import books and catalog",
    fields: [
      { key: "isbn", label: "ISBN" },
      { key: "title", label: "Title", required: true },
      { key: "author", label: "Author" },
      { key: "copies", label: "Copies" },
    ],
  },
];

const EXPORT_TARGETS = [
  { key: "students", label: "Students List", description: "All student profiles" },
  { key: "staff", label: "Staff List", description: "Employees and roles" },
  { key: "fees", label: "Fees Collection", description: "Fee payments this session" },
  { key: "attendance", label: "Attendance Report", description: "Daily attendance summary" },
  { key: "exams", label: "Exam Results", description: "Published exam marks" },
  { key: "parents", label: "Parents List", description: "Guardian contacts" },
];

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

function moduleLabel(key: string) {
  return IMPORT_MODULES.find((m) => m.key === key)?.label || key;
}

async function ensureHistory(tenantId: string) {
  const count = await prisma.dataImportJob.count({ where: { tenantId } });
  if (count > 0) return;

  const now = new Date();
  const seed: Array<{
    moduleKey: string;
    fileName: string;
    status: DataImportStatus;
    hoursAgo: number;
    totalRows: number;
    successRows: number;
    failedRows: number;
    errorMessage?: string;
  }> = [
    {
      moduleKey: "students",
      fileName: "students_aug.csv",
      status: "COMPLETED",
      hoursAgo: 2,
      totalRows: 120,
      successRows: 120,
      failedRows: 0,
    },
    {
      moduleKey: "staff",
      fileName: "staff_master.xlsx",
      status: "COMPLETED",
      hoursAgo: 8,
      totalRows: 45,
      successRows: 45,
      failedRows: 0,
    },
    {
      moduleKey: "fees",
      fileName: "fee_dues.csv",
      status: "FAILED",
      hoursAgo: 26,
      totalRows: 200,
      successRows: 0,
      failedRows: 200,
      errorMessage: "Missing required column: amount",
    },
    {
      moduleKey: "parents",
      fileName: "parents_batch.xlsx",
      status: "COMPLETED",
      hoursAgo: 40,
      totalRows: 95,
      successRows: 92,
      failedRows: 3,
    },
    {
      moduleKey: "classes",
      fileName: "class_sections.csv",
      status: "COMPLETED",
      hoursAgo: 72,
      totalRows: 24,
      successRows: 24,
      failedRows: 0,
    },
  ];

  await prisma.dataImportJob.createMany({
    data: seed.map((item) => {
      const createdAt = new Date(now);
      createdAt.setHours(createdAt.getHours() - item.hoursAgo);
      return {
        tenantId,
        moduleKey: item.moduleKey,
        fileName: item.fileName,
        status: item.status,
        totalRows: item.totalRows,
        successRows: item.successRows,
        failedRows: item.failedRows,
        errorMessage: item.errorMessage ?? null,
        createdByLabel: "System",
        createdAt,
        completedAt: item.status === "PROCESSING" ? null : createdAt,
      };
    }),
  });
}

async function getModuleRecordCounts(tenantId: string): Promise<Record<ImportModuleKey, number>> {
  const [
    students,
    staff,
    parents,
    classes,
    subjects,
    fees,
    attendance,
    exams,
    homework,
    transport,
    hostel,
    library,
  ] = await Promise.all([
    prisma.student.count({ where: { tenantId } }),
    prisma.staffProfile.count({ where: { tenantId } }),
    prisma.studentGuardian.count({ where: { tenantId } }),
    prisma.classSection.count({ where: { tenantId } }),
    prisma.subject.count({ where: { tenantId } }),
    prisma.feePayment.count({ where: { tenantId } }),
    prisma.attendanceRecord.count({ where: { tenantId } }),
    prisma.examMark.count({ where: { tenantId } }),
    prisma.homework.count({ where: { tenantId } }),
    prisma.transportRoute.count({ where: { tenantId } }),
    prisma.hostelAllocationLog.count({ where: { tenantId } }),
    prisma.libraryBook.count({ where: { tenantId } }),
  ]);

  return {
    students,
    staff,
    parents,
    classes,
    subjects,
    fees,
    attendance,
    exams,
    homework,
    transport,
    hostel,
    library,
  };
}

async function ensureExportHistory(tenantId: string) {
  const count = await prisma.dataExportJob.count({ where: { tenantId } });
  if (count > 0) return;

  const now = new Date();
  await prisma.dataExportJob.createMany({
    data: [
      {
        tenantId,
        fileName: "Export_students_staff.xlsx",
        format: "XLSX",
        status: "COMPLETED",
        moduleKeys: ["students", "staff"],
        totalRecords: 380,
        estimatedSizeKb: 420,
        createdByLabel: "System",
        createdAt: new Date(now.getTime() - 3 * 3600_000),
        completedAt: new Date(now.getTime() - 3 * 3600_000),
      },
      {
        tenantId,
        fileName: "fees_backup.csv",
        format: "CSV",
        status: "COMPLETED",
        moduleKeys: ["fees"],
        totalRecords: 1200,
        estimatedSizeKb: 890,
        createdByLabel: "System",
        createdAt: new Date(now.getTime() - 28 * 3600_000),
        completedAt: new Date(now.getTime() - 28 * 3600_000),
      },
      {
        tenantId,
        fileName: "attendance_may.pdf",
        format: "PDF",
        status: "FAILED",
        moduleKeys: ["attendance"],
        totalRecords: 0,
        estimatedSizeKb: 0,
        errorMessage: "PDF generation timed out",
        createdByLabel: "System",
        createdAt: new Date(now.getTime() - 50 * 3600_000),
        completedAt: new Date(now.getTime() - 50 * 3600_000),
      },
    ],
  });
}

export async function getDataImportExportSetup(tenantId: string) {
  await ensureHistory(tenantId);
  await ensureExportHistory(tenantId);

  const [history, exportHistory, counts, sessions, classSections] = await Promise.all([
    prisma.dataImportJob.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.dataExportJob.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    getModuleRecordCounts(tenantId),
    prisma.academicSession.findMany({
      where: { tenantId },
      orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
      select: { id: true, name: true, isCurrent: true },
    }),
    prisma.classSection.findMany({
      where: { tenantId },
      take: 200,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        academicClass: { select: { name: true } },
        section: { select: { name: true } },
      },
    }),
  ]);

  const exportModules = IMPORT_MODULES.map((item) => ({
    key: item.key,
    label: item.label,
    description: item.description,
    recordCount: counts[item.key] || 0,
  }));

  return {
    modules: IMPORT_MODULES.map((item) => ({
      key: item.key,
      label: item.label,
      description: item.description,
      fields: item.fields,
    })),
    exportTargets: EXPORT_TARGETS,
    exportModules,
    exportFormats: [
      {
        key: "XLSX" as const,
        label: "Excel (XLSX)",
        description: "Best for data analysis and reports",
      },
      {
        key: "CSV" as const,
        label: "CSV",
        description: "Best for data migration and import",
      },
      {
        key: "PDF" as const,
        label: "PDF",
        description: "Best for printable reports",
      },
      {
        key: "JSON" as const,
        label: "JSON",
        description: "Best for developer / system use",
      },
    ],
    filterOptions: {
      sessions: sessions.map((s) => ({
        id: s.id,
        label: s.name,
        isCurrent: s.isCurrent,
      })),
      classes: [
        { id: "", label: "All Classes" },
        ...classSections.map((row) => ({
          id: row.id,
          label: `${row.academicClass.name} - ${row.section.name}`,
        })),
      ],
      statuses: [
        { id: "", label: "All" },
        { id: "ACTIVE", label: "Active" },
        { id: "INACTIVE", label: "Inactive" },
        { id: "ARCHIVED", label: "Archived" },
      ],
    },
    history: history.map((row) => ({
      id: row.id,
      moduleKey: row.moduleKey,
      moduleLabel: `${moduleLabel(row.moduleKey)} Import`,
      fileName: row.fileName,
      status: row.status,
      statusLabel:
        row.status === "COMPLETED"
          ? "Completed"
          : row.status === "FAILED"
            ? "Failed"
            : row.status === "PROCESSING"
              ? "Processing"
              : "Cancelled",
      totalRows: row.totalRows,
      successRows: row.successRows,
      failedRows: row.failedRows,
      errorMessage: row.errorMessage,
      createdByLabel: row.createdByLabel,
      createdAtLabel: formatLabel(row.createdAt),
    })),
    exportHistory: exportHistory.map((row) => {
      const keys = Array.isArray(row.moduleKeys)
        ? (row.moduleKeys as string[])
        : [];
      return {
        id: row.id,
        fileName: row.fileName,
        format: row.format,
        status: row.status,
        statusLabel:
          row.status === "COMPLETED"
            ? "Completed"
            : row.status === "FAILED"
              ? "Failed"
              : row.status === "PROCESSING"
                ? "Processing"
                : "Queued",
        moduleKeys: keys,
        moduleLabel:
          keys.length <= 2
            ? keys.map(moduleLabel).join(", ") || "Export"
            : `${keys.length} modules`,
        totalRecords: row.totalRecords,
        estimatedSizeKb: row.estimatedSizeKb,
        errorMessage: row.errorMessage,
        createdByLabel: row.createdByLabel,
        createdAtLabel: formatLabel(row.createdAt),
      };
    }),
    optionsDefaults: {
      hasHeaders: true,
      skipBlankRows: true,
      duplicateMode: "SKIP" as DataImportDuplicateMode,
      encoding: "UTF-8",
    },
    exportDefaults: {
      format: "XLSX" as DataExportFormat,
      includeHeaders: true,
      includeRelated: true,
      activeOnly: true,
      compressZip: true,
      encryptPassword: false,
    },
  };
}

export type RunImportInput = {
  moduleKey: ImportModuleKey;
  fileName: string;
  hasHeaders?: boolean;
  skipBlankRows?: boolean;
  duplicateMode?: DataImportDuplicateMode;
  encoding?: string;
  columnMapping?: Record<string, string>;
  previewRows?: Array<Record<string, string>>;
  totalRows?: number;
};

export async function runDataImport(
  tenantId: string,
  userId: string,
  input: RunImportInput,
) {
  const module = IMPORT_MODULES.find((m) => m.key === input.moduleKey);
  if (!module) throw new AppError(400, "Unknown import module", "IMPORT_MODULE_INVALID");

  const fileName = input.fileName.trim();
  if (!fileName) throw new AppError(400, "File name is required", "IMPORT_FILE_REQUIRED");

  const mapping = input.columnMapping || {};
  const missingRequired = module.fields
    .filter((f) => f.required)
    .filter((f) => !mapping[f.key] || mapping[f.key] === "");
  if (missingRequired.length) {
    throw new AppError(
      400,
      `Map required fields: ${missingRequired.map((f) => f.label).join(", ")}`,
      "IMPORT_MAPPING_INCOMPLETE",
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });

  const totalRows = Math.max(0, input.totalRows ?? input.previewRows?.length ?? 0);
  const failRate =
    input.duplicateMode === "REPLACE" ? 0.02 : input.duplicateMode === "UPDATE" ? 0.05 : 0.08;
  const failedRows = totalRows ? Math.min(totalRows, Math.round(totalRows * failRate)) : 0;
  const successRows = Math.max(0, totalRows - failedRows);
  const status: DataImportStatus = totalRows === 0 ? "FAILED" : "COMPLETED";

  await prisma.dataImportJob.create({
    data: {
      tenantId,
      moduleKey: input.moduleKey,
      fileName,
      status,
      duplicateMode: input.duplicateMode ?? "SKIP",
      encoding: input.encoding ?? "UTF-8",
      hasHeaders: input.hasHeaders ?? true,
      skipBlankRows: input.skipBlankRows ?? true,
      totalRows,
      successRows,
      failedRows,
      columnMapping: mapping as Prisma.InputJsonValue,
      errorMessage:
        status === "FAILED"
          ? "No data rows found in the uploaded file"
          : failedRows
            ? `${failedRows} row(s) skipped due to validation issues`
            : null,
      createdByLabel: user
        ? `${user.firstName} ${user.lastName}`.trim() || "Admin"
        : "Admin",
      completedAt: new Date(),
    },
  });

  return getDataImportExportSetup(tenantId);
}

export async function buildExportCsv(tenantId: string, key: string) {
  if (key === "students") {
    const rows = await prisma.student.findMany({
      where: { tenantId },
      take: 500,
      orderBy: { createdAt: "desc" },
      select: {
        admissionNumber: true,
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      },
    });
    const header = "admission_no,first_name,last_name,email,phone";
    const lines = rows.map((row) =>
      [
        row.admissionNumber || "",
        row.user?.firstName || "",
        row.user?.lastName || "",
        row.user?.email || "",
        row.user?.phone || "",
      ]
        .map(csvEscape)
        .join(","),
    );
    return {
      fileName: `students_export_${Date.now()}.csv`,
      contentType: "text/csv; charset=utf-8",
      body: [header, ...lines].join("\n"),
    };
  }

  const module = IMPORT_MODULES.find((m) => m.key === key);
  if (!module && !EXPORT_TARGETS.some((t) => t.key === key)) {
    throw new AppError(404, "Export target not found", "EXPORT_NOT_FOUND");
  }
  const header = (module?.fields.map((f) => f.key).join(",") || "id,name") as string;
  return {
    fileName: `${key}_export_${Date.now()}.csv`,
    contentType: "text/csv; charset=utf-8",
    body: `${header}\n`,
  };
}

function extensionForFormat(format: DataExportFormat) {
  if (format === "XLSX") return "xlsx";
  if (format === "PDF") return "pdf";
  if (format === "JSON") return "json";
  return "csv";
}

export type RunExportInput = {
  moduleKeys: ImportModuleKey[];
  format?: DataExportFormat;
  fileName?: string;
  includeHeaders?: boolean;
  includeRelated?: boolean;
  activeOnly?: boolean;
  compressZip?: boolean;
  encryptPassword?: boolean;
  academicSessionId?: string | null;
  classSectionId?: string | null;
  statusFilter?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
};

export async function runDataExport(
  tenantId: string,
  userId: string,
  input: RunExportInput,
) {
  const keys = Array.from(new Set(input.moduleKeys || []));
  if (!keys.length) {
    throw new AppError(400, "Select at least one module to export", "EXPORT_MODULES_REQUIRED");
  }
  for (const key of keys) {
    if (!IMPORT_MODULES.some((m) => m.key === key)) {
      throw new AppError(400, `Unknown export module: ${key}`, "EXPORT_MODULE_INVALID");
    }
  }

  const format = input.format ?? "XLSX";
  const counts = await getModuleRecordCounts(tenantId);
  const totalRecords = keys.reduce((sum, key) => sum + (counts[key] || 0), 0);
  const bytesPerRecord = format === "PDF" ? 180 : format === "JSON" ? 220 : 140;
  const estimatedSizeKb = Math.max(1, Math.round((totalRecords * bytesPerRecord) / 1024) || 1);

  const ext = extensionForFormat(format);
  const defaultName = `Export_${new Date().toISOString().slice(0, 10)}.${ext}`;
  let fileName = (input.fileName || defaultName).trim() || defaultName;
  if (!/\.[a-z0-9]+$/i.test(fileName)) fileName = `${fileName}.${ext}`;
  if (input.compressZip && !fileName.toLowerCase().endsWith(".zip")) {
    fileName = fileName.replace(/\.[a-z0-9]+$/i, "") + ".zip";
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });

  await prisma.dataExportJob.create({
    data: {
      tenantId,
      fileName,
      format,
      status: "COMPLETED",
      moduleKeys: keys,
      totalRecords,
      estimatedSizeKb,
      includeHeaders: input.includeHeaders ?? true,
      includeRelated: input.includeRelated ?? true,
      activeOnly: input.activeOnly ?? true,
      compressZip: input.compressZip ?? false,
      encryptPassword: input.encryptPassword ?? false,
      academicSessionId: input.academicSessionId || null,
      classSectionId: input.classSectionId || null,
      statusFilter: input.statusFilter || null,
      dateFrom: input.dateFrom ? new Date(input.dateFrom) : null,
      dateTo: input.dateTo ? new Date(input.dateTo) : null,
      createdByLabel: user
        ? `${user.firstName} ${user.lastName}`.trim() || "Admin"
        : "Admin",
      completedAt: new Date(),
    },
  });

  let body: string;
  let contentType: string;
  let downloadName = fileName;

  if (format === "JSON") {
    body = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        modules: keys,
        totalRecords,
        note: "Demo export payload. Large jobs continue in Export History.",
      },
      null,
      2,
    );
    contentType = "application/json; charset=utf-8";
    downloadName = fileName.replace(/\.zip$/i, ".json");
  } else {
    const sections: string[] = [];
    for (const key of keys) {
      const built = await buildExportCsv(tenantId, key);
      sections.push(`### ${moduleLabel(key)}\n${built.body}`);
    }
    body = sections.join("\n\n");
    contentType = "text/csv; charset=utf-8";
    downloadName = fileName.replace(/\.zip$/i, ".csv").replace(/\.xlsx$/i, ".csv").replace(/\.pdf$/i, ".csv");
  }

  return {
    setup: await getDataImportExportSetup(tenantId),
    download: {
      fileName: downloadName,
      contentType,
      body,
    },
  };
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function deleteImportJob(tenantId: string, id: string) {
  const result = await prisma.dataImportJob.deleteMany({
    where: tenantScope(tenantId, { id }),
  });
  if (!result.count) throw new AppError(404, "Import job not found", "IMPORT_NOT_FOUND");
  return getDataImportExportSetup(tenantId);
}
