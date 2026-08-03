import {
  DiscountType,
  EnrollmentStatus,
  FeeAssignmentStatus,
  FeeFineType,
  FeeInvoiceStatus,
  PaymentStatus,
  Prisma,
  StudentStatus,
  type PaymentMode,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

interface FeeMasterInput {
  academicSessionId: string;
  classSectionId?: string | null;
  feeGroupId: string;
  feeTypeId: string;
  amount: number;
  dueDate: Date;
  fineType: FeeFineType;
  fineValue: number;
  graceDays: number;
  isCustom?: boolean;
  fineRanges?: Array<{
    startDate: Date;
    endDate?: Date | null;
    amount: number;
    perDay?: boolean;
  }>;
}

interface PaymentItemInput {
  assignmentId: string;
  amount: number;
  /** Optional collect-time overrides (PDF Collect Fees modal). */
  discountAmount?: number;
  fineAmount?: number;
}

interface InvoiceInput {
  studentId: string;
  academicSessionId: string;
  dueDate: Date;
  assignmentIds: string[];
  note?: string | null;
}

function money(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value ?? 0);
}

function calculateDiscount(
  type: DiscountType | undefined,
  value: Prisma.Decimal | undefined,
  base: number,
) {
  if (!type || !value) return 0;
  const discount = type === DiscountType.PERCENTAGE
    ? base * money(value) / 100
    : money(value);
  return Math.min(base, Math.max(0, discount));
}

function calculateFine(
  fineType: FeeFineType,
  fineValue: Prisma.Decimal,
  base: number,
  dueDate: Date,
  graceDays: number,
  asOf: Date,
  ranges: Array<{
    startDate: Date;
    endDate: Date | null;
    amount: Prisma.Decimal;
    perDay: boolean;
  }> = [],
) {
  const effectiveDue = new Date(dueDate);
  effectiveDue.setUTCDate(effectiveDue.getUTCDate() + graceDays);
  if (fineType === FeeFineType.NONE || asOf <= effectiveDue) return 0;
  if (fineType === FeeFineType.PERCENTAGE) return base * money(fineValue) / 100;
  if (fineType === FeeFineType.PER_DAY) {
    const days = Math.max(
      1,
      Math.ceil((asOf.getTime() - effectiveDue.getTime()) / 86_400_000),
    );
    return days * money(fineValue);
  }
  if (fineType === FeeFineType.DATE_RANGE) {
    const range = ranges.find(
      (item) =>
        asOf >= item.startDate &&
        (!item.endDate || asOf <= item.endDate),
    );
    if (!range) return 0;
    if (!range.perDay) return money(range.amount);
    const days = Math.max(
      1,
      Math.ceil((asOf.getTime() - range.startDate.getTime()) / 86_400_000) + 1,
    );
    return days * money(range.amount);
  }
  return money(fineValue);
}

const assignmentInclude = {
  feeMaster: {
    include: {
      feeType: true,
      feeGroup: true,
      academicSession: true,
      fineRanges: { orderBy: { startDate: "asc" as const } },
    },
  },
  discount: true,
  paymentItems: {
    where: { payment: { status: PaymentStatus.COLLECTED } },
    include: { payment: true },
  },
} satisfies Prisma.StudentFeeAssignmentInclude;

function toDue(assignment: Prisma.StudentFeeAssignmentGetPayload<{
  include: typeof assignmentInclude;
}>, asOf: Date) {
  const base = money(assignment.customAmount ?? assignment.feeMaster.amount)
    + money(assignment.carryForwardAmount);
  const discount = calculateDiscount(
    assignment.discount?.type,
    assignment.discount?.value,
    base,
  );
  const fine = calculateFine(
    assignment.feeMaster.fineType,
    assignment.feeMaster.fineValue,
    base,
    assignment.feeMaster.dueDate,
    assignment.feeMaster.graceDays,
    asOf,
    assignment.feeMaster.fineRanges,
  );
  const paid = assignment.paymentItems.reduce(
    (sum, item) => sum + money(item.paidAmount),
    0,
  );
  const balance = Math.max(0, base - discount + fine - paid);
  return { ...assignment, totals: { base, discount, fine, paid, balance } };
}

async function ensureDefaultReceiptBook(tenantId: string) {
  const existing = await prisma.feeReceiptBook.findFirst({
    where: tenantScope(tenantId, {}),
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  if (existing) {
    if (!existing.isDefault) {
      return prisma.feeReceiptBook.update({
        where: { id: existing.id },
        data: { isDefault: true },
      });
    }
    return existing;
  }
  return prisma.feeReceiptBook.create({
    data: {
      tenantId,
      name: "Main",
      prefix: "RCPT-",
      isDefault: true,
    },
  });
}

export async function getFeeSetup(tenantId: string) {
  const currentSession = await prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { isCurrent: true }),
  });
  await ensureDefaultReceiptBook(tenantId);
  const [types, groups, discounts, receiptBooks, classSections, masters, setting] =
    await Promise.all([
      prisma.feeType.findMany({
        where: tenantScope(tenantId, {}),
        include: { _count: { select: { feeMasters: true, groupItems: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.feeGroup.findMany({
        where: tenantScope(tenantId, {}),
        include: {
          items: { include: { feeType: true } },
          _count: { select: { feeMasters: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.feeDiscount.findMany({
        where: tenantScope(tenantId, {}),
        include: { _count: { select: { assignments: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.feeReceiptBook.findMany({
        where: tenantScope(tenantId, {}),
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      }),
      currentSession
        ? prisma.classSection.findMany({
            where: tenantScope(tenantId, { academicSessionId: currentSession.id }),
            include: {
              academicClass: true,
              section: true,
              enrollments: {
                where: { status: "ACTIVE" },
                include: {
                  student: {
                    select: {
                      id: true,
                      admissionNumber: true,
                      firstName: true,
                      lastName: true,
                      rteEnabled: true,
                      siblingGroupId: true,
                      photoUrl: true,
                    },
                  },
                },
              },
            },
            orderBy: [
              { academicClass: { sortOrder: "asc" } },
              { section: { name: "asc" } },
            ],
          })
        : Promise.resolve([]),
      currentSession
        ? prisma.feeMaster.findMany({
            where: tenantScope(tenantId, { academicSessionId: currentSession.id }),
            include: {
              feeType: true,
              feeGroup: true,
              classSection: { include: { academicClass: true, section: true } },
              fineRanges: { orderBy: { startDate: "asc" } },
              _count: { select: { assignments: true } },
            },
            orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }],
          })
        : Promise.resolve([]),
      prisma.tenantFeeSetting.upsert({
        where: { tenantId },
        create: { tenantId },
        update: {},
      }),
    ]);
  const groupIds = groups.map((group) => group.id);
  // FeePaymentItem has no tenantId / feeMaster — scope via payment + assignment.
  const collectedItems =
    groupIds.length > 0
      ? await prisma.feePaymentItem.findMany({
          where: {
            payment: { tenantId, status: PaymentStatus.COLLECTED },
            assignment: { feeMaster: { feeGroupId: { in: groupIds } } },
          },
          select: {
            assignment: { select: { feeMaster: { select: { feeGroupId: true } } } },
          },
        })
      : [];

  const collectedByGroup = new Map<string, number>();
  for (const item of collectedItems) {
    const feeGroupId = item.assignment.feeMaster.feeGroupId;
    collectedByGroup.set(feeGroupId, (collectedByGroup.get(feeGroupId) ?? 0) + 1);
  }

  return {
    currentSession,
    types: types.map((type) => ({
      ...type,
      canDelete: type._count.feeMasters === 0 && type._count.groupItems === 0,
      masterCount: type._count.feeMasters,
      groupCount: type._count.groupItems,
    })),
    groups: groups.map((group) => {
      const collectedPaymentCount = collectedByGroup.get(group.id) ?? 0;
      const masterCount = group._count.feeMasters;
      return {
        id: group.id,
        tenantId: group.tenantId,
        name: group.name,
        description: group.description,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        items: group.items,
        masterCount,
        collectedPaymentCount,
        // PDF: hide delete after any collected fee for that group.
        // Also lock when masters exist so structure stays consistent.
        canDelete: collectedPaymentCount === 0 && masterCount === 0,
      };
    }),
    discounts,
    receiptBooks,
    classSections,
    masters,
    setting,
  };
}

export function createFeeType(
  tenantId: string,
  input: { name: string; code?: string | null; description?: string | null },
) {
  return prisma.feeType.create({ data: { tenantId, ...input } });
}

export async function createFeeGroup(
  tenantId: string,
  input: { name: string; description?: string | null; feeTypeIds: string[] },
) {
  const count = await prisma.feeType.count({
    where: tenantScope(tenantId, { id: { in: input.feeTypeIds } }),
  });
  if (count !== new Set(input.feeTypeIds).size) {
    throw new AppError(400, "One or more fee types are invalid", "INVALID_FEE_TYPE");
  }
  return prisma.feeGroup.create({
    data: {
      tenantId,
      name: input.name,
      description: input.description,
      items: {
        create: [...new Set(input.feeTypeIds)].map((feeTypeId) => ({ feeTypeId })),
      },
    },
    include: { items: { include: { feeType: true } } },
  });
}

export function createFeeDiscount(
  tenantId: string,
  input: {
    name: string;
    code?: string | null;
    category?: string | null;
    description?: string | null;
    type: DiscountType;
    value: number;
  },
) {
  if (input.type === DiscountType.PERCENTAGE && input.value > 100) {
    throw new AppError(400, "Percentage discount cannot exceed 100", "INVALID_DISCOUNT");
  }
  return prisma.feeDiscount.create({
    data: {
      tenantId,
      name: input.name,
      code: input.code?.trim() || null,
      category: input.category?.trim() || null,
      description: input.description?.trim() || null,
      type: input.type,
      value: input.value,
    },
  });
}

export async function createReceiptBook(
  tenantId: string,
  input: { name: string; prefix: string; nextNumber?: number; isDefault: boolean },
) {
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.feeReceiptBook.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.feeReceiptBook.create({
      data: {
        tenantId,
        name: input.name,
        prefix: input.prefix,
        nextNumber: input.nextNumber ?? 1,
        isDefault: input.isDefault,
      },
    });
  });
}

export async function createFeeMaster(tenantId: string, input: FeeMasterInput) {
  if (input.fineType === FeeFineType.PERCENTAGE && input.fineValue > 100) {
    throw new AppError(400, "Percentage fine cannot exceed 100", "INVALID_FINE");
  }
  const [session, group, type, classSection, groupItem] = await Promise.all([
    prisma.academicSession.findFirst({
      where: tenantScope(tenantId, { id: input.academicSessionId }),
    }),
    prisma.feeGroup.findFirst({ where: tenantScope(tenantId, { id: input.feeGroupId }) }),
    prisma.feeType.findFirst({ where: tenantScope(tenantId, { id: input.feeTypeId }) }),
    input.classSectionId
      ? prisma.classSection.findFirst({
          where: tenantScope(tenantId, {
            id: input.classSectionId,
            academicSessionId: input.academicSessionId,
          }),
        })
      : Promise.resolve(true),
    prisma.feeGroupItem.findUnique({
      where: {
        feeGroupId_feeTypeId: {
          feeGroupId: input.feeGroupId,
          feeTypeId: input.feeTypeId,
        },
      },
    }),
  ]);
  if (!session || !group || !type || !classSection || !groupItem) {
    throw new AppError(400, "Fee master references are invalid", "INVALID_FEE_MASTER");
  }
  const maxSort = await prisma.feeMaster.aggregate({
    where: tenantScope(tenantId, { academicSessionId: input.academicSessionId }),
    _max: { sortOrder: true },
  });
  const { fineRanges = [], ...masterData } = input;
  return prisma.feeMaster.create({
    data: {
      tenantId,
      ...masterData,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      fineRanges: fineRanges.length
        ? {
            create: fineRanges.map((range) => ({
              tenantId,
              startDate: range.startDate,
              endDate: range.endDate ?? null,
              amount: range.amount,
              perDay: range.perDay ?? false,
            })),
          }
        : undefined,
    },
    include: {
      feeType: true,
      feeGroup: true,
      classSection: { include: { academicClass: true, section: true } },
      fineRanges: { orderBy: { startDate: "asc" } },
      _count: { select: { assignments: true } },
    },
  });
}

export async function createCustomFee(
  tenantId: string,
  input: {
    name: string;
    amount: number;
    description?: string | null;
    target: "ALL" | "INDIVIDUAL" | "CLASS";
    classSectionId?: string | null;
    academicSessionId?: string;
    dueDate?: Date;
  },
) {
  const session =
    (input.academicSessionId
      ? await prisma.academicSession.findFirst({
          where: tenantScope(tenantId, { id: input.academicSessionId }),
        })
      : null) ??
    (await prisma.academicSession.findFirst({
      where: tenantScope(tenantId, { isCurrent: true }),
    }));
  if (!session) throw new AppError(400, "No academic session found", "SESSION_NOT_FOUND");

  if (input.target === "CLASS") {
    if (!input.classSectionId) {
      throw new AppError(400, "Class section is required", "CLASS_SECTION_REQUIRED");
    }
    const classSection = await prisma.classSection.findFirst({
      where: tenantScope(tenantId, {
        id: input.classSectionId,
        academicSessionId: session.id,
      }),
    });
    if (!classSection) {
      throw new AppError(400, "Invalid class section", "INVALID_CLASS_SECTION");
    }
  }

  const dueDate =
    input.dueDate ??
    (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 30);
      return d;
    })();

  const codePrefix =
    input.target === "ALL"
      ? "CUSTOM_ALL"
      : input.target === "INDIVIDUAL"
        ? "CUSTOM_IND"
        : "CUSTOM_CLS";

  return prisma.$transaction(async (tx) => {
    const feeType = await tx.feeType.create({
      data: {
        tenantId,
        name: input.name.trim(),
        code: `${codePrefix}_${Date.now().toString(36).toUpperCase()}`,
        description: input.description?.trim() || null,
        isActive: true,
      },
    });

    const feeGroup = await tx.feeGroup.upsert({
      where: { tenantId_name: { tenantId, name: "Custom Fees" } },
      update: {},
      create: {
        tenantId,
        name: "Custom Fees",
        description: "Individually configured custom fee categories",
      },
    });

    await tx.feeGroupItem.upsert({
      where: {
        feeGroupId_feeTypeId: { feeGroupId: feeGroup.id, feeTypeId: feeType.id },
      },
      update: {},
      create: { feeGroupId: feeGroup.id, feeTypeId: feeType.id },
    });

    return tx.feeMaster.create({
      data: {
        tenantId,
        academicSessionId: session.id,
        classSectionId: input.target === "CLASS" ? input.classSectionId! : null,
        feeGroupId: feeGroup.id,
        feeTypeId: feeType.id,
        amount: input.amount,
        dueDate,
        fineType: FeeFineType.NONE,
        fineValue: 0,
        graceDays: 0,
        isCustom: true,
      },
      include: {
        feeType: true,
        feeGroup: true,
        classSection: { include: { academicClass: true, section: true } },
        _count: { select: { assignments: true } },
      },
    });
  });
}

export async function setCustomFeeActive(tenantId: string, masterId: string, isActive: boolean) {
  const master = await requireFeeMaster(tenantId, masterId);
  if (!master.isCustom) {
    throw new AppError(400, "Only custom fees can be toggled here", "NOT_CUSTOM_FEE");
  }
  await prisma.feeType.update({
    where: { id: master.feeTypeId },
    data: { isActive },
  });
  return requireFeeMaster(tenantId, masterId);
}

async function requireFeeType(tenantId: string, id: string) {
  const row = await prisma.feeType.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!row) throw new AppError(404, "Fee type not found", "FEE_TYPE_NOT_FOUND");
  return row;
}

async function requireFeeGroup(tenantId: string, id: string) {
  const row = await prisma.feeGroup.findFirst({
    where: tenantScope(tenantId, { id }),
    include: { items: { include: { feeType: true } }, _count: { select: { feeMasters: true } } },
  });
  if (!row) throw new AppError(404, "Fee group not found", "FEE_GROUP_NOT_FOUND");
  return row;
}

async function requireFeeDiscount(tenantId: string, id: string) {
  const row = await prisma.feeDiscount.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!row) throw new AppError(404, "Fee discount not found", "FEE_DISCOUNT_NOT_FOUND");
  return row;
}

async function requireReceiptBook(tenantId: string, id: string) {
  const row = await prisma.feeReceiptBook.findFirst({
    where: tenantScope(tenantId, { id }),
    include: { _count: { select: { payments: true } } },
  });
  if (!row) throw new AppError(404, "Receipt book not found", "RECEIPT_BOOK_NOT_FOUND");
  return row;
}

async function requireFeeMaster(tenantId: string, id: string) {
  const row = await prisma.feeMaster.findFirst({
    where: tenantScope(tenantId, { id }),
    include: {
      feeType: true,
      feeGroup: true,
      classSection: { include: { academicClass: true, section: true } },
      _count: { select: { assignments: true } },
    },
  });
  if (!row) throw new AppError(404, "Fee master not found", "FEE_MASTER_NOT_FOUND");
  return row;
}

export async function updateFeeType(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    code?: string | null;
    description?: string | null;
    isActive?: boolean;
  },
) {
  await requireFeeType(tenantId, id);
  return prisma.feeType.update({
    where: { id },
    data: {
      name: input.name,
      code: input.code === undefined ? undefined : input.code,
      description: input.description === undefined ? undefined : input.description,
      isActive: input.isActive,
    },
  });
}

export async function deleteFeeType(tenantId: string, id: string) {
  const row = await prisma.feeType.findFirst({
    where: tenantScope(tenantId, { id }),
    include: {
      _count: { select: { feeMasters: true, groupItems: true } },
    },
  });
  if (!row) throw new AppError(404, "Fee type not found", "FEE_TYPE_NOT_FOUND");
  if (row._count.feeMasters > 0 || row._count.groupItems > 0) {
    // Soft-disable when referenced so history stays intact.
    return prisma.feeType.update({
      where: { id },
      data: { isActive: false },
    });
  }
  await prisma.feeType.delete({ where: { id } });
  return { id, deleted: true as const };
}

export async function updateFeeGroup(
  tenantId: string,
  id: string,
  input: { name?: string; description?: string | null; feeTypeIds?: string[] },
) {
  await requireFeeGroup(tenantId, id);
  if (input.feeTypeIds) {
    const count = await prisma.feeType.count({
      where: tenantScope(tenantId, { id: { in: input.feeTypeIds } }),
    });
    if (count !== new Set(input.feeTypeIds).size) {
      throw new AppError(400, "One or more fee types are invalid", "INVALID_FEE_TYPE");
    }
  }

  return prisma.$transaction(async (tx) => {
    if (input.feeTypeIds) {
      await tx.feeGroupItem.deleteMany({ where: { feeGroupId: id } });
      await tx.feeGroupItem.createMany({
        data: [...new Set(input.feeTypeIds)].map((feeTypeId) => ({ feeGroupId: id, feeTypeId })),
      });
    }
    return tx.feeGroup.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description === undefined ? undefined : input.description,
      },
      include: { items: { include: { feeType: true } } },
    });
  });
}

export async function deleteFeeGroup(tenantId: string, id: string) {
  const row = await requireFeeGroup(tenantId, id);
  const collectedPaymentCount = await prisma.feePaymentItem.count({
    where: {
      payment: { tenantId, status: PaymentStatus.COLLECTED },
      assignment: { feeMaster: { feeGroupId: id } },
    },
  });
  if (collectedPaymentCount > 0) {
    throw new AppError(
      409,
      "Cannot delete this fees class group because student fees have already been collected for it",
      "FEE_GROUP_HAS_COLLECTIONS",
    );
  }
  if (row._count.feeMasters > 0) {
    throw new AppError(
      409,
      "Cannot delete this fees class group while fee master entries still use it",
      "FEE_GROUP_IN_USE",
    );
  }
  await prisma.feeGroup.delete({ where: { id } });
}

export async function updateFeeDiscount(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    code?: string | null;
    category?: string | null;
    description?: string | null;
    type?: DiscountType;
    value?: number;
    isActive?: boolean;
  },
) {
  await requireFeeDiscount(tenantId, id);
  const type = input.type;
  const value = input.value;
  if (type === DiscountType.PERCENTAGE && value !== undefined && value > 100) {
    throw new AppError(400, "Percentage discount cannot exceed 100", "INVALID_DISCOUNT");
  }
  return prisma.feeDiscount.update({
    where: { id },
    data: {
      name: input.name,
      code: input.code === undefined ? undefined : input.code?.trim() || null,
      category: input.category === undefined ? undefined : input.category?.trim() || null,
      description: input.description === undefined ? undefined : input.description?.trim() || null,
      type,
      value,
      isActive: input.isActive,
    },
  });
}

export async function deleteFeeDiscount(tenantId: string, id: string) {
  const row = await prisma.feeDiscount.findFirst({
    where: tenantScope(tenantId, { id }),
    include: { _count: { select: { assignments: true } } },
  });
  if (!row) throw new AppError(404, "Fee discount not found", "FEE_DISCOUNT_NOT_FOUND");
  if (row._count.assignments > 0) {
    return prisma.feeDiscount.update({
      where: { id },
      data: { isActive: false },
    });
  }
  await prisma.feeDiscount.delete({ where: { id } });
  return { id, deleted: true as const };
}

export async function updateReceiptBook(
  tenantId: string,
  id: string,
  input: { name?: string; prefix?: string; nextNumber?: number; isDefault?: boolean },
) {
  await requireReceiptBook(tenantId, id);
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.feeReceiptBook.updateMany({
        where: { tenantId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }
    return tx.feeReceiptBook.update({
      where: { id },
      data: {
        name: input.name,
        prefix: input.prefix,
        nextNumber: input.nextNumber,
        isDefault: input.isDefault,
      },
    });
  });
}

export async function deleteReceiptBook(tenantId: string, id: string) {
  const row = await requireReceiptBook(tenantId, id);
  if (row._count.payments > 0) {
    throw new AppError(409, "Receipt book has payments and cannot be deleted", "RECEIPT_BOOK_IN_USE");
  }
  if (row.isDefault) {
    throw new AppError(409, "Set another default receipt book before deleting this one", "DEFAULT_RECEIPT_BOOK");
  }
  await prisma.feeReceiptBook.delete({ where: { id } });
}

export async function updateFeeMaster(
  tenantId: string,
  id: string,
  input: Partial<FeeMasterInput>,
) {
  const existing = await requireFeeMaster(tenantId, id);
  const next = {
    academicSessionId: input.academicSessionId ?? existing.academicSessionId,
    classSectionId:
      input.classSectionId !== undefined ? input.classSectionId : existing.classSectionId,
    feeGroupId: input.feeGroupId ?? existing.feeGroupId,
    feeTypeId: input.feeTypeId ?? existing.feeTypeId,
    amount: input.amount ?? Number(existing.amount),
    dueDate: input.dueDate ?? existing.dueDate,
    fineType: input.fineType ?? existing.fineType,
    fineValue: input.fineValue ?? Number(existing.fineValue),
    graceDays: input.graceDays ?? existing.graceDays,
    isCustom: input.isCustom ?? existing.isCustom,
    fineRanges: input.fineRanges,
  };

  if (next.fineType === FeeFineType.PERCENTAGE && next.fineValue > 100) {
    throw new AppError(400, "Percentage fine cannot exceed 100", "INVALID_FINE");
  }

  const [session, group, type, classSection, groupItem] = await Promise.all([
    prisma.academicSession.findFirst({
      where: tenantScope(tenantId, { id: next.academicSessionId }),
    }),
    prisma.feeGroup.findFirst({ where: tenantScope(tenantId, { id: next.feeGroupId }) }),
    prisma.feeType.findFirst({ where: tenantScope(tenantId, { id: next.feeTypeId }) }),
    next.classSectionId
      ? prisma.classSection.findFirst({
          where: tenantScope(tenantId, {
            id: next.classSectionId,
            academicSessionId: next.academicSessionId,
          }),
        })
      : Promise.resolve(true),
    prisma.feeGroupItem.findUnique({
      where: {
        feeGroupId_feeTypeId: {
          feeGroupId: next.feeGroupId,
          feeTypeId: next.feeTypeId,
        },
      },
    }),
  ]);
  if (!session || !group || !type || !classSection || !groupItem) {
    throw new AppError(400, "Fee master references are invalid", "INVALID_FEE_MASTER");
  }

  const { fineRanges, ...masterData } = next;
  return prisma.$transaction(async (tx) => {
    if (fineRanges !== undefined) {
      await tx.feeFineRange.deleteMany({ where: { feeMasterId: id, tenantId } });
    }
    return tx.feeMaster.update({
      where: { id },
      data: {
        ...masterData,
        fineRanges:
          fineRanges === undefined || !fineRanges.length
            ? undefined
            : {
                create: fineRanges.map((range) => ({
                  tenantId,
                  startDate: range.startDate,
                  endDate: range.endDate ?? null,
                  amount: range.amount,
                  perDay: range.perDay ?? false,
                })),
              },
      },
      include: {
        feeType: true,
        feeGroup: true,
        classSection: { include: { academicClass: true, section: true } },
        fineRanges: { orderBy: { startDate: "asc" } },
        _count: { select: { assignments: true } },
      },
    });
  });
}

export async function deleteFeeMaster(tenantId: string, id: string) {
  const row = await requireFeeMaster(tenantId, id);
  const paidAssignments = await prisma.studentFeeAssignment.count({
    where: tenantScope(tenantId, {
      feeMasterId: id,
      paymentItems: { some: {} },
    }),
  });
  if (paidAssignments > 0) {
    throw new AppError(409, "Fee master has collected payments and cannot be deleted", "FEE_MASTER_IN_USE");
  }
  // Assignments without payments are removed via cascade from FeeMaster.
  if (row._count.assignments > 0) {
    await prisma.studentFeeAssignment.deleteMany({
      where: tenantScope(tenantId, { feeMasterId: id, paymentItems: { none: {} } }),
    });
  }
  await prisma.feeMaster.delete({ where: { id } });
}

export async function assignFeeMaster(
  tenantId: string,
  masterId: string,
  enrollmentIds?: string[],
) {
  const master = await prisma.feeMaster.findFirst({
    where: tenantScope(tenantId, { id: masterId }),
  });
  if (!master) throw new AppError(404, "Fee master not found", "FEE_MASTER_NOT_FOUND");

  const selectedIds = enrollmentIds !== undefined ? [...new Set(enrollmentIds)] : null;

  const enrollments =
    selectedIds && selectedIds.length === 0
      ? []
      : await prisma.studentEnrollment.findMany({
          where: tenantScope(tenantId, {
            academicSessionId: master.academicSessionId,
            status: EnrollmentStatus.ACTIVE,
            student: { status: StudentStatus.ACTIVE },
            ...(selectedIds?.length
              ? { id: { in: selectedIds } }
              : master.classSectionId
                ? { classSectionId: master.classSectionId }
                : {}),
          }),
          select: { id: true },
        });
  if (selectedIds && selectedIds.length > 0 && enrollments.length !== selectedIds.length) {
    throw new AppError(
      400,
      "One or more students cannot be assigned (disabled or invalid)",
      "INVALID_ENROLLMENT",
    );
  }
  if (!selectedIds && !enrollments.length) {
    throw new AppError(400, "No eligible students found", "NO_ELIGIBLE_STUDENTS");
  }

  // Block assigning students who already have collections on this master.
  if (selectedIds?.length) {
    const blocked = await prisma.studentFeeAssignment.findMany({
      where: tenantScope(tenantId, {
        feeMasterId: masterId,
        studentEnrollmentId: { in: selectedIds },
        paymentItems: { some: { payment: { status: PaymentStatus.COLLECTED } } },
      }),
      select: { id: true },
    });
    if (blocked.length) {
      throw new AppError(
        409,
        "Cannot change assignment for students with collected fees — revert payment first",
        "FEE_ALREADY_COLLECTED",
      );
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    if (selectedIds) {
      // Remove unpaid assignments that were unchecked (PDF: change group only if not collected).
      await tx.studentFeeAssignment.deleteMany({
        where: tenantScope(tenantId, {
          feeMasterId: masterId,
          studentEnrollmentId: { notIn: selectedIds },
          paymentItems: { none: {} },
        }),
      });
    }
    if (!enrollments.length) {
      return { count: 0 };
    }
    const created = await tx.studentFeeAssignment.createMany({
      data: enrollments.map(({ id }) => ({
        tenantId,
        studentEnrollmentId: id,
        feeMasterId: master.id,
      })),
      skipDuplicates: true,
    });
    return created;
  });

  return { assigned: result.count, eligible: enrollments.length };
}

export async function listFeeMasterAssignCandidates(tenantId: string, masterId: string) {
  const master = await prisma.feeMaster.findFirst({
    where: tenantScope(tenantId, { id: masterId }),
    include: {
      feeType: true,
      feeGroup: true,
      classSection: { include: { academicClass: true, section: true } },
    },
  });
  if (!master) throw new AppError(404, "Fee master not found", "FEE_MASTER_NOT_FOUND");

  const enrollments = await prisma.studentEnrollment.findMany({
    where: tenantScope(tenantId, {
      academicSessionId: master.academicSessionId,
      ...(master.classSectionId ? { classSectionId: master.classSectionId } : {}),
    }),
    include: {
      student: {
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      },
      classSection: { include: { academicClass: true, section: true } },
      feeAssignments: {
        where: { feeMasterId: masterId },
        include: {
          paymentItems: {
            where: { payment: { status: PaymentStatus.COLLECTED } },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
    orderBy: [
      { student: { firstName: "asc" } },
      { student: { lastName: "asc" } },
    ],
  });

  const students = enrollments.map((enrollment) => {
    const assignment = enrollment.feeAssignments[0];
    const collected = Boolean(assignment?.paymentItems.length);
    const studentDisabled = enrollment.student.status !== "ACTIVE";
    const enrollmentDisabled = enrollment.status !== EnrollmentStatus.ACTIVE;
    const disabled = studentDisabled || enrollmentDisabled;
    const assigned = Boolean(assignment);
    // PDF: no checkbox when fees already collected or student is disabled.
    const canSelect = !collected && !disabled;
    return {
      enrollmentId: enrollment.id,
      student: enrollment.student,
      classSection: enrollment.classSection,
      assigned,
      assignmentId: assignment?.id ?? null,
      collected,
      disabled,
      canSelect,
      selected: assigned && canSelect,
      lockReason: collected
        ? ("COLLECTED" as const)
        : disabled
          ? ("DISABLED" as const)
          : null,
    };
  });

  return {
    master: {
      id: master.id,
      amount: master.amount,
      dueDate: master.dueDate,
      feeType: master.feeType,
      feeGroup: master.feeGroup,
      classSection: master.classSection,
    },
    students,
    summary: {
      total: students.length,
      selectable: students.filter((s) => s.canSelect).length,
      assigned: students.filter((s) => s.assigned).length,
      collected: students.filter((s) => s.collected).length,
      disabled: students.filter((s) => s.disabled).length,
    },
  };
}

export async function reorderFeeMasters(tenantId: string, orderedIds: string[]) {
  const uniqueIds = [...new Set(orderedIds)];
  if (!uniqueIds.length || uniqueIds.length !== orderedIds.length) {
    throw new AppError(400, "Provide a unique ordered list of fee masters", "INVALID_REORDER");
  }
  const masters = await prisma.feeMaster.findMany({
    where: tenantScope(tenantId, { id: { in: uniqueIds } }),
    select: { id: true, academicSessionId: true },
  });
  if (masters.length !== uniqueIds.length) {
    throw new AppError(404, "One or more fee masters were not found", "FEE_MASTER_NOT_FOUND");
  }
  const sessionIds = new Set(masters.map((m) => m.academicSessionId));
  if (sessionIds.size !== 1) {
    throw new AppError(400, "All fee masters must belong to the same session", "INVALID_REORDER");
  }
  await prisma.$transaction(
    uniqueIds.map((id, index) =>
      prisma.feeMaster.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );
  return { reordered: uniqueIds.length };
}

export async function updateAssignmentDiscount(
  tenantId: string,
  assignmentId: string,
  discountId: string | null,
) {
  const [assignment, discount] = await Promise.all([
    prisma.studentFeeAssignment.findFirst({
      where: tenantScope(tenantId, { id: assignmentId }),
    }),
    discountId
      ? prisma.feeDiscount.findFirst({
          where: tenantScope(tenantId, { id: discountId, isActive: true }),
        })
      : Promise.resolve(true),
  ]);
  if (!assignment || !discount) {
    throw new AppError(400, "Assignment or discount is invalid", "INVALID_DISCOUNT_ASSIGNMENT");
  }
  return prisma.studentFeeAssignment.update({
    where: { id: assignmentId },
    data: { discountId },
  });
}

export async function createFeeInvoice(
  tenantId: string,
  userId: string,
  input: InvoiceInput,
) {
  const uniqueIds = [...new Set(input.assignmentIds)];
  if (!uniqueIds.length || uniqueIds.length !== input.assignmentIds.length) {
    throw new AppError(400, "Select unique fee assignments", "INVALID_INVOICE_ITEMS");
  }

  return prisma.$transaction(
    async (tx) => {
      const [student, session, existingItem] = await Promise.all([
        tx.student.findFirst({ where: tenantScope(tenantId, { id: input.studentId }) }),
        tx.academicSession.findFirst({
          where: tenantScope(tenantId, { id: input.academicSessionId }),
        }),
        tx.feeInvoiceItem.findFirst({
          where: {
            assignmentId: { in: uniqueIds },
            invoice: {
              tenantId,
              status: { in: [FeeInvoiceStatus.DUE, FeeInvoiceStatus.OVERDUE] },
            },
          },
          select: { id: true },
        }),
      ]);
      if (!student || !session) {
        throw new AppError(400, "Invoice references are invalid", "INVALID_INVOICE");
      }
      if (existingItem) {
        throw new AppError(
          409,
          "One or more selected fees already have an open invoice",
          "INVOICE_ALREADY_EXISTS",
        );
      }

      const calculated = [];
      for (const assignmentId of uniqueIds) {
        const due = await getAssignmentDue(tx, tenantId, assignmentId, new Date());
        const enrollment = await tx.studentEnrollment.findFirst({
          where: tenantScope(tenantId, {
            id: due.studentEnrollmentId,
            studentId: input.studentId,
            academicSessionId: input.academicSessionId,
          }),
        });
        if (!enrollment || due.totals.balance <= 0) {
          throw new AppError(
            400,
            "Invoice item does not belong to this student/session or has no balance",
            "INVALID_INVOICE_ITEM",
          );
        }
        calculated.push({ due, amount: due.totals.balance });
      }

      const subtotal = calculated.reduce((sum, row) => sum + row.due.totals.base, 0);
      const discountAmount = calculated.reduce(
        (sum, row) => sum + row.due.totals.discount,
        0,
      );
      const fineAmount = calculated.reduce((sum, row) => sum + row.due.totals.fine, 0);
      const total = calculated.reduce((sum, row) => sum + row.amount, 0);
      const year = new Date().getFullYear();
      const latest = await tx.feeInvoice.findFirst({
        where: {
          tenantId,
          invoiceNumber: { startsWith: `INV-${year}-` },
        },
        orderBy: { invoiceNumber: "desc" },
        select: { invoiceNumber: true },
      });
      let nextSeq = 1;
      if (latest?.invoiceNumber) {
        const part = latest.invoiceNumber.split("-").pop();
        const parsed = Number(part);
        if (Number.isFinite(parsed)) nextSeq = parsed + 1;
      }
      const invoiceNumber = `INV-${year}-${String(nextSeq).padStart(6, "0")}`;

      return tx.feeInvoice.create({
        data: {
          tenantId,
          academicSessionId: input.academicSessionId,
          studentId: input.studentId,
          invoiceNumber,
          dueDate: input.dueDate,
          subtotal,
          discountAmount,
          fineAmount,
          total,
          note: input.note ?? null,
          createdById: userId,
          items: {
            create: calculated.map(({ due, amount }) => ({
              assignmentId: due.id,
              description: due.feeMaster.feeType.name,
              baseAmount: due.totals.base,
              discount: due.totals.discount,
              fine: due.totals.fine,
              amount,
            })),
          },
        },
        include: {
          student: true,
          academicSession: true,
          items: {
            include: {
              assignment: {
                include: { feeMaster: { include: { feeType: true } } },
              },
            },
          },
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function listFeeInvoices(
  tenantId: string,
  input: {
    academicSessionId?: string;
    status?: FeeInvoiceStatus;
    query?: string;
  },
) {
  const now = new Date();
  await Promise.all([
    prisma.feeInvoice.updateMany({
      where: tenantScope(tenantId, {
        status: FeeInvoiceStatus.DUE,
        dueDate: { lt: now },
      }),
      data: { status: FeeInvoiceStatus.OVERDUE },
    }),
    prisma.feeInvoice.updateMany({
      where: tenantScope(tenantId, {
        status: FeeInvoiceStatus.OVERDUE,
        dueDate: { gte: now },
      }),
      data: { status: FeeInvoiceStatus.DUE },
    }),
  ]);

  const query = input.query?.trim();
  return prisma.feeInvoice.findMany({
    where: tenantScope(tenantId, {
      ...(input.academicSessionId ? { academicSessionId: input.academicSessionId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(query
        ? {
            OR: [
              {
                invoiceNumber: {
                  contains: query,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                student: {
                  admissionNumber: {
                    contains: query,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
              {
                student: {
                  firstName: {
                    contains: query,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
              {
                student: {
                  lastName: {
                    contains: query,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
            ],
          }
        : {}),
    }),
    include: {
      student: true,
      academicSession: true,
      items: {
        include: {
          assignment: {
            include: { feeMaster: { include: { feeType: true, feeGroup: true } } },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 500,
  });
}

export async function getFeeInvoice(tenantId: string, id: string) {
  const invoice = await prisma.feeInvoice.findFirst({
    where: tenantScope(tenantId, { id }),
    include: {
      student: true,
      academicSession: true,
      items: {
        include: {
          assignment: {
            include: { feeMaster: { include: { feeType: true, feeGroup: true } } },
          },
        },
      },
    },
  });
  if (!invoice) throw new AppError(404, "Invoice not found", "INVOICE_NOT_FOUND");
  return invoice;
}

export async function setFeeInvoiceStatus(
  tenantId: string,
  id: string,
  status: FeeInvoiceStatus,
) {
  const invoice = await prisma.feeInvoice.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!invoice) throw new AppError(404, "Invoice not found", "INVOICE_NOT_FOUND");
  if (status === FeeInvoiceStatus.PAID && money(invoice.paidAmount) < money(invoice.total)) {
    throw new AppError(409, "Invoice still has an outstanding balance", "INVOICE_NOT_PAID");
  }
  return prisma.feeInvoice.update({ where: { id }, data: { status } });
}

export async function listStudentFees(
  tenantId: string,
  studentId: string,
  sessionId?: string,
  asOf = new Date(),
) {
  const student = await prisma.student.findFirst({
    where: tenantScope(tenantId, { id: studentId }),
    select: {
      id: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      rteEnabled: true,
      siblingGroupId: true,
      guardianPhone: true,
      fatherPhone: true,
      motherPhone: true,
      enrollments: {
        where: sessionId ? { academicSessionId: sessionId } : { academicSession: { isCurrent: true } },
        include: {
          classSection: { include: { academicClass: true, section: true } },
          feeAssignments: {
            where: { status: FeeAssignmentStatus.ACTIVE },
            include: assignmentInclude,
          },
        },
      },
    },
  });
  if (!student) throw new AppError(404, "Student not found", "STUDENT_NOT_FOUND");
  const assignments = student.enrollments
    .flatMap((enrollment) =>
      enrollment.feeAssignments.map((assignment) => ({
        ...toDue(assignment, asOf),
        enrollment: {
          id: enrollment.id,
          classSection: enrollment.classSection,
        },
      })),
    )
    .sort((a, b) => {
      const order = (a.feeMaster.sortOrder ?? 0) - (b.feeMaster.sortOrder ?? 0);
      if (order !== 0) return order;
      return new Date(a.feeMaster.dueDate).getTime() - new Date(b.feeMaster.dueDate).getTime();
    });
  const totals = assignments.reduce(
    (sum, item) => ({
      base: sum.base + item.totals.base,
      discount: sum.discount + item.totals.discount,
      fine: sum.fine + item.totals.fine,
      paid: sum.paid + item.totals.paid,
      balance: sum.balance + item.totals.balance,
    }),
    { base: 0, discount: 0, fine: 0, paid: 0, balance: 0 },
  );
  return { student, assignments, totals };
}

async function getAssignmentDue(
  db: DbClient,
  tenantId: string,
  assignmentId: string,
  asOf: Date,
) {
  const assignment = await db.studentFeeAssignment.findFirst({
    where: tenantScope(tenantId, {
      id: assignmentId,
      status: FeeAssignmentStatus.ACTIVE,
    }),
    include: assignmentInclude,
  });
  if (!assignment) {
    throw new AppError(400, "Fee assignment is invalid", "INVALID_FEE_ASSIGNMENT");
  }
  return toDue(assignment, asOf);
}

export async function collectPayment(
  tenantId: string,
  userId: string,
  input: {
    studentId: string;
    academicSessionId: string;
    receiptBookId?: string;
    paymentDate: Date;
    paymentMode: PaymentMode;
    note?: string | null;
    items: PaymentItemInput[];
  },
) {
  return prisma.$transaction(
    async (tx) => {
      const [student, session, receiptBook] = await Promise.all([
        tx.student.findFirst({ where: tenantScope(tenantId, { id: input.studentId }) }),
        tx.academicSession.findFirst({
          where: tenantScope(tenantId, { id: input.academicSessionId }),
        }),
        tx.feeReceiptBook.findFirst({
          where: tenantScope(tenantId, input.receiptBookId
            ? { id: input.receiptBookId }
            : { isDefault: true }),
        }),
      ]);
      if (!student || !session || !receiptBook) {
        throw new AppError(400, "Payment references are invalid", "INVALID_PAYMENT");
      }

      const uniqueItems = new Map(input.items.map((item) => [item.assignmentId, item]));
      if (uniqueItems.size !== input.items.length) {
        throw new AppError(400, "Duplicate fee assignment in payment", "DUPLICATE_PAYMENT_ITEM");
      }
      const calculated = [];
      for (const item of input.items) {
        const due = await getAssignmentDue(tx, tenantId, item.assignmentId, input.paymentDate);
        if (
          due.studentEnrollmentId === undefined ||
          item.amount <= 0 ||
          item.amount > due.totals.balance + 0.001
        ) {
          throw new AppError(400, "Payment exceeds the outstanding balance", "INVALID_AMOUNT");
        }
        const enrollment = await tx.studentEnrollment.findFirst({
          where: tenantScope(tenantId, {
            id: due.studentEnrollmentId,
            studentId: input.studentId,
            academicSessionId: input.academicSessionId,
          }),
        });
        if (!enrollment) {
          throw new AppError(400, "Fee does not belong to this student/session", "PAYMENT_SCOPE");
        }
        calculated.push({ item, due });
      }

      const updatedBook = await tx.feeReceiptBook.update({
        where: { id: receiptBook.id },
        data: { nextNumber: { increment: 1 } },
      });
      const sequence = updatedBook.nextNumber - 1;
      const receiptNumber = `${updatedBook.prefix}${String(sequence).padStart(6, "0")}`;
      const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const amount = calculated.reduce((sum, { item }) => sum + item.amount, 0);

      const payment = await tx.feePayment.create({
        data: {
          tenantId,
          studentId: input.studentId,
          academicSessionId: input.academicSessionId,
          receiptBookId: receiptBook.id,
          receiptNumber,
          paymentId,
          paymentDate: input.paymentDate,
          paymentMode: input.paymentMode,
          amount,
          note: input.note,
          createdById: userId,
          items: {
            create: calculated.map(({ item, due }) => ({
              assignmentId: item.assignmentId,
              baseAmount: due.totals.base,
              discountAmount:
                item.discountAmount !== undefined ? item.discountAmount : due.totals.discount,
              fineAmount: item.fineAmount !== undefined ? item.fineAmount : due.totals.fine,
              paidAmount: item.amount,
            })),
          },
        },
        include: {
          student: true,
          academicSession: true,
          receiptBook: true,
          items: {
            include: {
              assignment: {
                include: { feeMaster: { include: { feeType: true, feeGroup: true } } },
              },
            },
          },
        },
      });

      const invoiceItems = await tx.feeInvoiceItem.findMany({
        where: {
          assignmentId: { in: calculated.map(({ item }) => item.assignmentId) },
          invoice: {
            tenantId,
            status: { in: [FeeInvoiceStatus.DUE, FeeInvoiceStatus.OVERDUE] },
          },
        },
        include: { invoice: true },
      });
      const paidByAssignment = new Map(
        calculated.map(({ item }) => [item.assignmentId, item.amount]),
      );
      const increments = new Map<string, { amount: number; total: number; paid: number }>();
      for (const invoiceItem of invoiceItems) {
        const increment = paidByAssignment.get(invoiceItem.assignmentId) ?? 0;
        const current = increments.get(invoiceItem.invoiceId) ?? {
          amount: 0,
          total: money(invoiceItem.invoice.total),
          paid: money(invoiceItem.invoice.paidAmount),
        };
        current.amount += increment;
        increments.set(invoiceItem.invoiceId, current);
      }
      for (const [invoiceId, values] of increments) {
        const nextPaid = Math.min(values.total, values.paid + values.amount);
        await tx.feeInvoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: nextPaid,
            status:
              nextPaid >= values.total
                ? FeeInvoiceStatus.PAID
                : undefined,
          },
        });
      }

      return payment;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function searchPayments(tenantId: string, query?: string) {
  return prisma.feePayment.findMany({
    where: tenantScope(tenantId, query
      ? {
          OR: [
            { paymentId: { contains: query } },
            { receiptNumber: { contains: query } },
            { student: { admissionNumber: { contains: query } } },
            { student: { firstName: { contains: query } } },
          ],
        }
      : {}),
    include: {
      student: {
        include: {
          enrollments: {
            where: { status: EnrollmentStatus.ACTIVE },
            orderBy: { enrolledAt: "desc" },
            take: 1,
            include: {
              classSection: { include: { academicClass: true, section: true } },
            },
          },
        },
      },
      academicSession: true,
      createdBy: { select: { firstName: true, lastName: true } },
      items: {
        include: {
          assignment: {
            include: { feeMaster: { include: { feeType: true } } },
          },
        },
      },
    },
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function getFeePayment(tenantId: string, id: string) {
  const payment = await prisma.feePayment.findFirst({
    where: tenantScope(tenantId, {
      OR: [{ id }, { paymentId: id }],
    }),
    include: {
      student: true,
      academicSession: true,
      createdBy: { select: { firstName: true, lastName: true } },
      items: {
        include: {
          assignment: {
            include: { feeMaster: { include: { feeType: true } } },
          },
        },
      },
    },
  });
  if (!payment) throw new AppError(404, "Payment not found", "PAYMENT_NOT_FOUND");
  return payment;
}

export async function revertPayment(
  tenantId: string,
  paymentId: string,
  reason: string,
) {
  const payment = await prisma.feePayment.findFirst({
    where: tenantScope(tenantId, { id: paymentId }),
    include: { items: true },
  });
  if (!payment) throw new AppError(404, "Payment not found", "PAYMENT_NOT_FOUND");
  if (payment.status === PaymentStatus.REVERTED) {
    throw new AppError(409, "Payment is already reverted", "PAYMENT_REVERTED");
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.feePayment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.REVERTED, revertedAt: new Date(), revertReason: reason },
    });
    const invoiceItems = await tx.feeInvoiceItem.findMany({
      where: {
        assignmentId: { in: payment.items.map((item) => item.assignmentId) },
        invoice: { tenantId, status: { not: FeeInvoiceStatus.CANCELLED } },
      },
      include: { invoice: true },
    });
    const revertedByAssignment = new Map(
      payment.items.map((item) => [item.assignmentId, money(item.paidAmount)]),
    );
    const decrements = new Map<string, number>();
    for (const item of invoiceItems) {
      decrements.set(
        item.invoiceId,
        (decrements.get(item.invoiceId) ?? 0) +
          (revertedByAssignment.get(item.assignmentId) ?? 0),
      );
    }
    for (const [invoiceId, decrement] of decrements) {
      const invoice = invoiceItems.find((item) => item.invoiceId === invoiceId)!.invoice;
      const nextPaid = Math.max(0, money(invoice.paidAmount) - decrement);
      await tx.feeInvoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: nextPaid,
          status:
            invoice.dueDate < new Date()
              ? FeeInvoiceStatus.OVERDUE
              : FeeInvoiceStatus.DUE,
        },
      });
    }
    return updated;
  });
}

export async function getFeeSummary(
  tenantId: string,
  sessionId: string,
  asOf = new Date(),
) {
  const assignments = await prisma.studentFeeAssignment.findMany({
    where: tenantScope(tenantId, {
      status: FeeAssignmentStatus.ACTIVE,
      feeMaster: { academicSessionId: sessionId },
    }),
    include: {
      ...assignmentInclude,
      studentEnrollment: {
        include: {
          student: {
            select: {
              id: true,
              admissionNumber: true,
              firstName: true,
              lastName: true,
              guardianPhone: true,
              fatherPhone: true,
              motherPhone: true,
            },
          },
        },
      },
    },
  });
  const dues = assignments.map((assignment) => {
    const student = assignment.studentEnrollment.student;
    const parentContact =
      student.guardianPhone?.trim() ||
      student.fatherPhone?.trim() ||
      student.motherPhone?.trim() ||
      null;
    return {
      ...toDue(assignment, asOf),
      student: {
        id: student.id,
        admissionNumber: student.admissionNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        guardianPhone: student.guardianPhone,
        fatherPhone: student.fatherPhone,
        motherPhone: student.motherPhone,
        parentContact,
      },
    };
  });
  const totals = dues.reduce(
    (sum, item) => ({
      assigned: sum.assigned + item.totals.base,
      discounts: sum.discounts + item.totals.discount,
      fines: sum.fines + item.totals.fine,
      collected: sum.collected + item.totals.paid,
      due: sum.due + item.totals.balance,
    }),
    { assigned: 0, discounts: 0, fines: 0, collected: 0, due: 0 },
  );
  return { totals, dues };
}

export async function carryForwardPreviousDues(
  tenantId: string,
  input: {
    fromSessionId: string;
    targetEnrollmentId: string;
    dueDate: Date;
    asOf?: Date;
    amount?: number;
  },
) {
  const targetEnrollment = await prisma.studentEnrollment.findFirst({
    where: tenantScope(tenantId, { id: input.targetEnrollmentId }),
  });
  if (!targetEnrollment) {
    throw new AppError(400, "Target enrolment is invalid", "INVALID_ENROLLMENT");
  }
  const previousAssignments = await prisma.studentFeeAssignment.findMany({
    where: tenantScope(tenantId, {
      status: FeeAssignmentStatus.ACTIVE,
      studentEnrollment: {
        studentId: targetEnrollment.studentId,
        academicSessionId: input.fromSessionId,
      },
    }),
    include: assignmentInclude,
  });
  const calculatedAmount = previousAssignments.reduce(
    (sum, assignment) => sum + toDue(assignment, input.asOf ?? new Date()).totals.balance,
    0,
  );
  const amount = input.amount ?? calculatedAmount;
  if (amount <= 0) {
    throw new AppError(409, "No previous-session balance to carry forward", "NO_BALANCE_DUE");
  }

  return prisma.$transaction(async (tx) => {
    const feeType = await tx.feeType.upsert({
      where: { tenantId_name: { tenantId, name: "Previous Session Due" } },
      update: { isActive: true },
      create: {
        tenantId,
        name: "Previous Session Due",
        code: "PREV_DUE",
        description: "Outstanding balance carried from a previous academic session",
      },
    });
    const feeGroup = await tx.feeGroup.upsert({
      where: { tenantId_name: { tenantId, name: "Carry Forward" } },
      update: {},
      create: { tenantId, name: "Carry Forward" },
    });
    await tx.feeGroupItem.upsert({
      where: {
        feeGroupId_feeTypeId: { feeGroupId: feeGroup.id, feeTypeId: feeType.id },
      },
      update: {},
      create: { feeGroupId: feeGroup.id, feeTypeId: feeType.id },
    });
    const master = await tx.feeMaster.upsert({
      where: {
        tenantId_academicSessionId_classSectionId_feeGroupId_feeTypeId_dueDate: {
          tenantId,
          academicSessionId: targetEnrollment.academicSessionId,
          classSectionId: targetEnrollment.classSectionId,
          feeGroupId: feeGroup.id,
          feeTypeId: feeType.id,
          dueDate: input.dueDate,
        },
      },
      update: {},
      create: {
        tenantId,
        academicSessionId: targetEnrollment.academicSessionId,
        classSectionId: targetEnrollment.classSectionId,
        feeGroupId: feeGroup.id,
        feeTypeId: feeType.id,
        amount: 0,
        dueDate: input.dueDate,
        isCustom: true,
      },
    });
    const assignment = await tx.studentFeeAssignment.upsert({
      where: {
        tenantId_studentEnrollmentId_feeMasterId: {
          tenantId,
          studentEnrollmentId: targetEnrollment.id,
          feeMasterId: master.id,
        },
      },
      update: { carryForwardAmount: amount, status: FeeAssignmentStatus.ACTIVE },
      create: {
        tenantId,
        studentEnrollmentId: targetEnrollment.id,
        feeMasterId: master.id,
        carryForwardAmount: amount,
      },
    });
    return { amount, assignment };
  });
}
