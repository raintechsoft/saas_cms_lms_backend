import type {
  LibraryBarcodeType,
  LibraryFineType,
  Prisma,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import {
  createLibraryCategory,
  deleteLibraryCategory,
  librarySummary,
  updateLibraryCategory,
} from "../library/library.service.js";

async function ensureSettings(tenantId: string) {
  const existing = await prisma.tenantLibrarySetting.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return prisma.tenantLibrarySetting.create({ data: { tenantId } });
}

async function ensureMemberTypes(tenantId: string) {
  const count = await prisma.libraryMemberType.count({ where: { tenantId } });
  if (count > 0) {
    return prisma.libraryMemberType.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  await prisma.libraryMemberType.createMany({
    data: [
      {
        tenantId,
        name: "Student",
        color: "#10B981",
        maxBooks: 3,
        issuePeriodDays: 14,
        maxRenewals: 1,
        finePerDay: 5,
        sortOrder: 1,
      },
      {
        tenantId,
        name: "Teacher",
        color: "#3B82F6",
        maxBooks: 8,
        issuePeriodDays: 30,
        maxRenewals: 3,
        finePerDay: 2,
        sortOrder: 2,
      },
      {
        tenantId,
        name: "Staff",
        color: "#F59E0B",
        maxBooks: 5,
        issuePeriodDays: 21,
        maxRenewals: 2,
        finePerDay: 3,
        sortOrder: 3,
      },
      {
        tenantId,
        name: "External Member",
        color: "#8B5CF6",
        maxBooks: 2,
        issuePeriodDays: 7,
        maxRenewals: 0,
        finePerDay: 10,
        sortOrder: 4,
      },
    ],
  });

  return prisma.libraryMemberType.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

async function ensureCategories(tenantId: string) {
  const count = await prisma.libraryCategory.count({ where: { tenantId } });
  if (count > 0) {
    return prisma.libraryCategory.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      include: { _count: { select: { books: true } } },
    });
  }

  const fiction = await prisma.libraryCategory.create({
    data: { tenantId, name: "Fiction", isActive: true },
  });
  const nonFiction = await prisma.libraryCategory.create({
    data: { tenantId, name: "Non-Fiction", isActive: true },
  });
  await prisma.libraryCategory.createMany({
    data: [
      { tenantId, parentId: fiction.id, name: "Adventure", isActive: true },
      { tenantId, parentId: fiction.id, name: "Mystery", isActive: true },
      { tenantId, parentId: fiction.id, name: "Science Fiction", isActive: true },
      { tenantId, parentId: nonFiction.id, name: "Biography", isActive: true },
      { tenantId, parentId: nonFiction.id, name: "History", isActive: true },
      { tenantId, parentId: nonFiction.id, name: "Self-Help", isActive: true },
      { tenantId, name: "Reference", isActive: true },
      { tenantId, name: "Academic", isActive: true },
    ],
  });

  return prisma.libraryCategory.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    include: { _count: { select: { books: true } } },
  });
}

function mapSettings(row: {
  moduleEnabled: boolean;
  libraryName: string;
  accessionPrefix: string;
  defaultIssuePeriodDays: number;
  allowRenewals: boolean;
  maxBooksPerMember: number;
  maxRenewalsPerBook: number;
  reservationValidityDays: number;
  returnGracePeriodDays: number;
  fineType: LibraryFineType;
  fineAmount: { toString(): string } | number;
  maxFinePerBook: { toString(): string } | number;
  processingFee: { toString(): string } | number;
  enableReservations: boolean;
  dueDateReminders: boolean;
  notifyOnOverdue: boolean;
  allowFineExemptions: boolean;
  autoCalculateFine: boolean;
  showAvailabilityToStudents: boolean;
  allowMemberSelfRegistration: boolean;
  barcodeType: LibraryBarcodeType;
  barcodePrefix: string;
  barcodeStartingNumber: number;
}) {
  return {
    moduleEnabled: row.moduleEnabled,
    libraryName: row.libraryName,
    accessionPrefix: row.accessionPrefix,
    defaultIssuePeriodDays: row.defaultIssuePeriodDays,
    allowRenewals: row.allowRenewals,
    maxBooksPerMember: row.maxBooksPerMember,
    maxRenewalsPerBook: row.maxRenewalsPerBook,
    reservationValidityDays: row.reservationValidityDays,
    returnGracePeriodDays: row.returnGracePeriodDays,
    fineType: row.fineType,
    fineAmount: Number(row.fineAmount),
    maxFinePerBook: Number(row.maxFinePerBook),
    processingFee: Number(row.processingFee),
    enableReservations: row.enableReservations,
    dueDateReminders: row.dueDateReminders,
    notifyOnOverdue: row.notifyOnOverdue,
    allowFineExemptions: row.allowFineExemptions,
    autoCalculateFine: row.autoCalculateFine,
    showAvailabilityToStudents: row.showAvailabilityToStudents,
    allowMemberSelfRegistration: row.allowMemberSelfRegistration,
    barcodeType: row.barcodeType,
    barcodePrefix: row.barcodePrefix,
    barcodeStartingNumber: row.barcodeStartingNumber,
  };
}

function buildCategoryTree(
  rows: Array<{
    id: string;
    parentId: string | null;
    name: string;
    isActive: boolean;
    _count: { books: number };
  }>,
) {
  const byParent = new Map<string | null, typeof rows>();
  for (const row of rows) {
    // Treat self-parent / missing parents as roots so the UI still renders.
    const key =
      !row.parentId || row.parentId === row.id || !rows.some((r) => r.id === row.parentId)
        ? null
        : row.parentId;
    const list = byParent.get(key) || [];
    list.push(row);
    byParent.set(key, list);
  }

  function walk(
    parentId: string | null,
    seen: Set<string>,
  ): Array<{
    id: string;
    name: string;
    isActive: boolean;
    bookCount: number;
    children: ReturnType<typeof walk>;
  }> {
    return (byParent.get(parentId) || [])
      .filter((row) => !seen.has(row.id))
      .map((row) => {
        const next = new Set(seen);
        next.add(row.id);
        return {
          id: row.id,
          name: row.name,
          isActive: row.isActive,
          bookCount: row._count.books,
          children: walk(row.id, next),
        };
      });
  }

  return walk(null, new Set());
}

async function assertValidCategoryParent(
  tenantId: string,
  categoryId: string | undefined,
  parentId: string | null | undefined,
) {
  if (parentId === undefined || parentId === null) return;
  if (categoryId && parentId === categoryId) {
    throw new AppError(400, "Category cannot be its own parent", "LIBRARY_PARENT_INVALID");
  }

  const parent = await prisma.libraryCategory.findFirst({
    where: tenantScope(tenantId, { id: parentId }),
    select: { id: true, parentId: true },
  });
  if (!parent) {
    throw new AppError(400, "Parent category is invalid", "LIBRARY_PARENT_INVALID");
  }

  // Walk ancestors to block cycles (A -> B -> A).
  let cursor: string | null = parent.parentId;
  const guard = new Set<string>([parent.id]);
  while (cursor) {
    if (categoryId && cursor === categoryId) {
      throw new AppError(
        400,
        "Parent category would create a cycle",
        "LIBRARY_PARENT_CYCLE",
      );
    }
    if (guard.has(cursor)) break;
    guard.add(cursor);
    const next: { parentId: string | null } | null = await prisma.libraryCategory.findFirst({
      where: tenantScope(tenantId, { id: cursor }),
      select: { parentId: true },
    });
    cursor = next?.parentId ?? null;
  }
}

export async function getLibrarySettingsSetup(tenantId: string) {
  // Heal accidental self-parent rows so categories cannot vanish from the tree UI.
  await prisma.$executeRaw`
    UPDATE library_categories
    SET parent_id = NULL
    WHERE tenant_id = ${tenantId} AND parent_id IS NOT NULL AND parent_id = id
  `;

  const [settings, memberTypes, categories, summary, studentCount, staffCount] =
    await Promise.all([
      ensureSettings(tenantId),
      ensureMemberTypes(tenantId),
      ensureCategories(tenantId),
      librarySummary(tenantId),
      prisma.student.count({ where: { tenantId } }),
      prisma.staffProfile.count({ where: { tenantId } }),
    ]);

  const membersEstimate = Math.max(studentCount + staffCount, summary.issued + 50);

  return {
    settings: mapSettings(settings),
    memberTypes: memberTypes.map((m, index) => ({
      id: m.id,
      name: m.name,
      color: m.color,
      maxBooks: m.maxBooks,
      issuePeriodDays: m.issuePeriodDays,
      maxRenewals: m.maxRenewals,
      finePerDay: Number(m.finePerDay),
      sortOrder: m.sortOrder || index + 1,
      isActive: m.isActive,
    })),
    categories: buildCategoryTree(categories),
    flatCategories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      isActive: c.isActive,
      bookCount: c._count.books,
    })),
    overview: {
      totalBooks: Math.max(summary.totalCopies || summary.books, summary.books),
      totalMembers: membersEstimate,
      issuedBooks: summary.issued,
      overdueBooks: summary.overdue,
    },
    quickActions: [
      { key: "add-book", label: "Add New Book", href: "/library" },
      { key: "add-member", label: "Add New Member", href: "/library" },
      { key: "issue", label: "Issue Book", href: "/library" },
      { key: "return", label: "Return Book", href: "/library" },
      { key: "reserve", label: "Reserve Book", href: "/library" },
      { key: "barcode", label: "Print Barcode Labels", href: "/library" },
      { key: "stock", label: "Stock Verification", href: "/library" },
    ],
    note: "Library settings will be applied across all branches and users of this institution.",
  };
}

export type SaveLibrarySettingsInput = {
  moduleEnabled?: boolean;
  libraryName?: string;
  accessionPrefix?: string;
  defaultIssuePeriodDays?: number;
  allowRenewals?: boolean;
  maxBooksPerMember?: number;
  maxRenewalsPerBook?: number;
  reservationValidityDays?: number;
  returnGracePeriodDays?: number;
  fineType?: LibraryFineType;
  fineAmount?: number;
  maxFinePerBook?: number;
  processingFee?: number;
  enableReservations?: boolean;
  dueDateReminders?: boolean;
  notifyOnOverdue?: boolean;
  allowFineExemptions?: boolean;
  autoCalculateFine?: boolean;
  showAvailabilityToStudents?: boolean;
  allowMemberSelfRegistration?: boolean;
  barcodeType?: LibraryBarcodeType;
  barcodePrefix?: string;
  barcodeStartingNumber?: number;
};

export async function saveLibrarySettings(tenantId: string, input: SaveLibrarySettingsInput) {
  await ensureSettings(tenantId);
  const data: Prisma.TenantLibrarySettingUpdateInput = {};
  const assign = <K extends keyof SaveLibrarySettingsInput>(key: K) => {
    if (input[key] !== undefined) {
      (data as Record<string, unknown>)[key as string] = input[key];
    }
  };
  assign("moduleEnabled");
  if (input.libraryName !== undefined) data.libraryName = input.libraryName.trim() || "School Central Library";
  if (input.accessionPrefix !== undefined) {
    data.accessionPrefix = input.accessionPrefix.trim() || "LIB-";
  }
  assign("defaultIssuePeriodDays");
  assign("allowRenewals");
  assign("maxBooksPerMember");
  assign("maxRenewalsPerBook");
  assign("reservationValidityDays");
  assign("returnGracePeriodDays");
  assign("fineType");
  assign("fineAmount");
  assign("maxFinePerBook");
  assign("processingFee");
  assign("enableReservations");
  assign("dueDateReminders");
  assign("notifyOnOverdue");
  assign("allowFineExemptions");
  assign("autoCalculateFine");
  assign("showAvailabilityToStudents");
  assign("allowMemberSelfRegistration");
  assign("barcodeType");
  if (input.barcodePrefix !== undefined) data.barcodePrefix = input.barcodePrefix.trim() || "LIB";
  assign("barcodeStartingNumber");

  await prisma.tenantLibrarySetting.update({ where: { tenantId }, data });
  return getLibrarySettingsSetup(tenantId);
}

export type MemberTypeInput = {
  name: string;
  color?: string;
  maxBooks?: number;
  issuePeriodDays?: number;
  maxRenewals?: number;
  finePerDay?: number;
  sortOrder?: number;
  isActive?: boolean;
};

export async function upsertLibraryMemberType(
  tenantId: string,
  input: MemberTypeInput & { id?: string },
) {
  const name = input.name.trim();
  if (!name) throw new AppError(400, "Member type name is required", "MEMBER_TYPE_NAME_REQUIRED");

  if (input.id) {
    const existing = await prisma.libraryMemberType.findFirst({
      where: tenantScope(tenantId, { id: input.id }),
    });
    if (!existing) throw new AppError(404, "Member type not found", "MEMBER_TYPE_NOT_FOUND");
    await prisma.libraryMemberType.update({
      where: { id: input.id },
      data: {
        name,
        color: input.color || existing.color,
        maxBooks: input.maxBooks ?? existing.maxBooks,
        issuePeriodDays: input.issuePeriodDays ?? existing.issuePeriodDays,
        maxRenewals: input.maxRenewals ?? existing.maxRenewals,
        finePerDay: input.finePerDay ?? existing.finePerDay,
        sortOrder: input.sortOrder ?? existing.sortOrder,
        isActive: input.isActive ?? existing.isActive,
      },
    });
  } else {
    const count = await prisma.libraryMemberType.count({ where: { tenantId } });
    await prisma.libraryMemberType.create({
      data: {
        tenantId,
        name,
        color: input.color || "#10B981",
        maxBooks: input.maxBooks ?? 5,
        issuePeriodDays: input.issuePeriodDays ?? 14,
        maxRenewals: input.maxRenewals ?? 2,
        finePerDay: input.finePerDay ?? 5,
        sortOrder: input.sortOrder ?? count + 1,
        isActive: input.isActive ?? true,
      },
    });
  }

  return getLibrarySettingsSetup(tenantId);
}

export async function deleteLibraryMemberType(tenantId: string, id: string) {
  const result = await prisma.libraryMemberType.deleteMany({
    where: tenantScope(tenantId, { id }),
  });
  if (!result.count) throw new AppError(404, "Member type not found", "MEMBER_TYPE_NOT_FOUND");
  return getLibrarySettingsSetup(tenantId);
}

export async function upsertLibrarySettingsCategory(
  tenantId: string,
  input: { id?: string; name: string; parentId?: string | null; isActive?: boolean },
) {
  await assertValidCategoryParent(tenantId, input.id, input.parentId);

  if (input.id) {
    await updateLibraryCategory(tenantId, input.id, {
      name: input.name,
      parentId: input.parentId,
      isActive: input.isActive,
    });
  } else {
    await createLibraryCategory(tenantId, {
      name: input.name,
      parentId: input.parentId,
      isActive: input.isActive,
    });
  }
  return getLibrarySettingsSetup(tenantId);
}

export async function deleteLibrarySettingsCategory(tenantId: string, id: string) {
  await deleteLibraryCategory(tenantId, id);
  return getLibrarySettingsSetup(tenantId);
}

export function previewNextBarcode(prefix: string, startingNumber: number) {
  return `${prefix}${String(startingNumber).padStart(4, "0")}`;
}
