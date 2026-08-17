import { InventoryMovementType, Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

export type InventoryCategoryInput = {
  name: string;
  isActive?: boolean;
  notes?: string | null;
};

export type InventoryItemInput = {
  name: string;
  categoryId?: string | null;
  sku?: string | null;
  unit?: string | null;
  quantity?: number;
  reorderLevel?: number;
  location?: string | null;
  isActive?: boolean;
  notes?: string | null;
};

function itemInclude() {
  return {
    category: { select: { id: true, name: true } },
    _count: { select: { movements: true } },
  } as const;
}

function movementInclude() {
  return {
    item: {
      select: { id: true, name: true, sku: true, unit: true, quantity: true },
    },
    student: {
      select: {
        id: true,
        admissionNumber: true,
        firstName: true,
        lastName: true,
      },
    },
    createdBy: { select: { id: true, firstName: true, lastName: true } },
  } as const;
}

export async function listInventoryCategories(tenantId: string) {
  return prisma.inventoryCategory.findMany({
    where: tenantScope(tenantId, {}),
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { items: true } } },
  });
}

export async function createInventoryCategory(tenantId: string, input: InventoryCategoryInput) {
  return prisma.inventoryCategory.create({
    data: {
      tenantId,
      name: input.name.trim(),
      isActive: input.isActive ?? true,
      notes: input.notes?.trim() || null,
    },
    include: { _count: { select: { items: true } } },
  });
}

export async function updateInventoryCategory(
  tenantId: string,
  id: string,
  input: Partial<InventoryCategoryInput>,
) {
  const found = await prisma.inventoryCategory.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true },
  });
  if (!found) throw new AppError(404, "Inventory category not found", "INVENTORY_CATEGORY_NOT_FOUND");

  return prisma.inventoryCategory.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    },
    include: { _count: { select: { items: true } } },
  });
}

export async function deleteInventoryCategory(tenantId: string, id: string) {
  const found = await prisma.inventoryCategory.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true },
  });
  if (!found) throw new AppError(404, "Inventory category not found", "INVENTORY_CATEGORY_NOT_FOUND");
  await prisma.inventoryItem.updateMany({
    where: tenantScope(tenantId, { categoryId: id }),
    data: { categoryId: null },
  });
  await prisma.inventoryCategory.delete({ where: { id } });
}

export async function listInventoryItems(
  tenantId: string,
  query?: { q?: string; categoryId?: string; lowStockOnly?: boolean },
) {
  const q = query?.q?.trim();
  const items = await prisma.inventoryItem.findMany({
    where: tenantScope(tenantId, {
      ...(query?.categoryId ? { categoryId: query.categoryId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { sku: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { location: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    }),
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: itemInclude(),
  });

  if (query?.lowStockOnly) {
    return items.filter((item) => item.quantity <= item.reorderLevel);
  }
  return items;
}

export async function createInventoryItem(tenantId: string, input: InventoryItemInput) {
  if (input.categoryId) {
    const category = await prisma.inventoryCategory.findFirst({
      where: tenantScope(tenantId, { id: input.categoryId }),
      select: { id: true },
    });
    if (!category) {
      throw new AppError(404, "Inventory category not found", "INVENTORY_CATEGORY_NOT_FOUND");
    }
  }

  const quantity = Math.max(0, input.quantity ?? 0);
  const item = await prisma.inventoryItem.create({
    data: {
      tenantId,
      categoryId: input.categoryId || null,
      name: input.name.trim(),
      sku: input.sku?.trim() || null,
      unit: input.unit?.trim() || "pcs",
      quantity,
      reorderLevel: Math.max(0, input.reorderLevel ?? 0),
      location: input.location?.trim() || null,
      isActive: input.isActive ?? true,
      notes: input.notes?.trim() || null,
    },
    include: itemInclude(),
  });

  if (quantity > 0) {
    await prisma.inventoryMovement.create({
      data: {
        tenantId,
        itemId: item.id,
        type: InventoryMovementType.ADD,
        quantity,
        note: "Initial stock",
      },
    });
  }

  return item;
}

export async function updateInventoryItem(
  tenantId: string,
  id: string,
  input: Partial<InventoryItemInput>,
) {
  const found = await prisma.inventoryItem.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!found) throw new AppError(404, "Inventory item not found", "INVENTORY_ITEM_NOT_FOUND");

  if (input.categoryId) {
    const category = await prisma.inventoryCategory.findFirst({
      where: tenantScope(tenantId, { id: input.categoryId }),
      select: { id: true },
    });
    if (!category) {
      throw new AppError(404, "Inventory category not found", "INVENTORY_CATEGORY_NOT_FOUND");
    }
  }

  return prisma.inventoryItem.update({
    where: { id },
    data: {
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId || null } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.sku !== undefined ? { sku: input.sku?.trim() || null } : {}),
      ...(input.unit !== undefined ? { unit: input.unit?.trim() || "pcs" } : {}),
      ...(input.reorderLevel !== undefined ? { reorderLevel: Math.max(0, input.reorderLevel) } : {}),
      ...(input.location !== undefined ? { location: input.location?.trim() || null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      // quantity changes go through movements, not direct update
    },
    include: itemInclude(),
  });
}

export async function deleteInventoryItem(tenantId: string, id: string) {
  const found = await prisma.inventoryItem.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true },
  });
  if (!found) throw new AppError(404, "Inventory item not found", "INVENTORY_ITEM_NOT_FOUND");
  await prisma.inventoryMovement.deleteMany({ where: tenantScope(tenantId, { itemId: id }) });
  await prisma.inventoryItem.delete({ where: { id } });
}

export async function listInventoryMovements(
  tenantId: string,
  query?: {
    type?: InventoryMovementType;
    itemId?: string;
    studentId?: string;
    take?: number;
  },
) {
  return prisma.inventoryMovement.findMany({
    where: tenantScope(tenantId, {
      ...(query?.type ? { type: query.type } : {}),
      ...(query?.itemId ? { itemId: query.itemId } : {}),
      ...(query?.studentId ? { studentId: query.studentId } : {}),
    }),
    include: movementInclude(),
    orderBy: { createdAt: "desc" },
    take: query?.take ?? 200,
  });
}

export async function addInventoryStock(
  tenantId: string,
  input: {
    itemId: string;
    quantity: number;
    note?: string | null;
    createdById?: string | null;
  },
) {
  const qty = Math.floor(input.quantity);
  if (qty < 1) throw new AppError(400, "Quantity must be at least 1", "INVENTORY_QTY_INVALID");

  const item = await prisma.inventoryItem.findFirst({
    where: tenantScope(tenantId, { id: input.itemId, isActive: true }),
  });
  if (!item) throw new AppError(404, "Inventory item not found", "INVENTORY_ITEM_NOT_FOUND");

  const [movement] = await prisma.$transaction([
    prisma.inventoryMovement.create({
      data: {
        tenantId,
        itemId: item.id,
        type: InventoryMovementType.ADD,
        quantity: qty,
        note: input.note?.trim() || null,
        createdById: input.createdById || null,
      },
      include: movementInclude(),
    }),
    prisma.inventoryItem.update({
      where: { id: item.id },
      data: { quantity: { increment: qty } },
    }),
  ]);
  return movement;
}

export async function issueInventoryItem(
  tenantId: string,
  input: {
    itemId: string;
    quantity: number;
    studentId?: string | null;
    note?: string | null;
    createdById?: string | null;
  },
) {
  const qty = Math.floor(input.quantity);
  if (qty < 1) throw new AppError(400, "Quantity must be at least 1", "INVENTORY_QTY_INVALID");

  const item = await prisma.inventoryItem.findFirst({
    where: tenantScope(tenantId, { id: input.itemId, isActive: true }),
  });
  if (!item) throw new AppError(404, "Inventory item not found", "INVENTORY_ITEM_NOT_FOUND");
  if (item.quantity < qty) {
    throw new AppError(409, "Insufficient stock", "INVENTORY_INSUFFICIENT_STOCK");
  }

  if (input.studentId) {
    const student = await prisma.student.findFirst({
      where: tenantScope(tenantId, { id: input.studentId }),
      select: { id: true },
    });
    if (!student) throw new AppError(404, "Student not found", "STUDENT_NOT_FOUND");
  }

  const [movement] = await prisma.$transaction([
    prisma.inventoryMovement.create({
      data: {
        tenantId,
        itemId: item.id,
        type: InventoryMovementType.ISSUE,
        quantity: qty,
        studentId: input.studentId || null,
        note: input.note?.trim() || null,
        createdById: input.createdById || null,
      },
      include: movementInclude(),
    }),
    prisma.inventoryItem.update({
      where: { id: item.id },
      data: { quantity: { decrement: qty } },
    }),
  ]);
  return movement;
}

export async function returnInventoryItem(
  tenantId: string,
  input: {
    itemId: string;
    quantity: number;
    studentId?: string | null;
    note?: string | null;
    createdById?: string | null;
  },
) {
  const qty = Math.floor(input.quantity);
  if (qty < 1) throw new AppError(400, "Quantity must be at least 1", "INVENTORY_QTY_INVALID");

  const item = await prisma.inventoryItem.findFirst({
    where: tenantScope(tenantId, { id: input.itemId }),
  });
  if (!item) throw new AppError(404, "Inventory item not found", "INVENTORY_ITEM_NOT_FOUND");

  const [movement] = await prisma.$transaction([
    prisma.inventoryMovement.create({
      data: {
        tenantId,
        itemId: item.id,
        type: InventoryMovementType.RETURN,
        quantity: qty,
        studentId: input.studentId || null,
        note: input.note?.trim() || null,
        createdById: input.createdById || null,
      },
      include: movementInclude(),
    }),
    prisma.inventoryItem.update({
      where: { id: item.id },
      data: { quantity: { increment: qty } },
    }),
  ]);
  return movement;
}

export async function inventorySummary(tenantId: string) {
  const [items, categories, issued, lowStockRows, stockAgg] = await Promise.all([
    prisma.inventoryItem.count({ where: tenantScope(tenantId, { isActive: true }) }),
    prisma.inventoryCategory.count({ where: tenantScope(tenantId, { isActive: true }) }),
    prisma.inventoryMovement.count({
      where: tenantScope(tenantId, { type: InventoryMovementType.ISSUE }),
    }),
    prisma.inventoryItem.findMany({
      where: tenantScope(tenantId, { isActive: true }),
      select: { quantity: true, reorderLevel: true },
    }),
    prisma.inventoryItem.aggregate({
      where: tenantScope(tenantId, { isActive: true }),
      _sum: { quantity: true },
    }),
  ]);

  return {
    items,
    categories,
    totalQuantity: stockAgg._sum.quantity ?? 0,
    issued,
    lowStock: lowStockRows.filter((row) => row.quantity <= row.reorderLevel).length,
  };
}
