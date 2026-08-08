import type { Request, Response } from "express";
import { InventoryMovementType } from "@prisma/client";
import { z } from "zod";
import {
  addInventoryStock,
  createInventoryCategory,
  createInventoryItem,
  deleteInventoryCategory,
  deleteInventoryItem,
  inventorySummary,
  issueInventoryItem,
  listInventoryCategories,
  listInventoryItems,
  listInventoryMovements,
  returnInventoryItem,
  updateInventoryCategory,
  updateInventoryItem,
} from "./inventory.service.js";

const idParams = z.object({ id: z.string().min(1) });

const categoryBody = z.object({
  name: z.string().trim().min(1).max(120),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

const itemBody = z.object({
  name: z.string().trim().min(1).max(200),
  categoryId: z.string().min(1).nullable().optional(),
  sku: z.string().trim().max(60).nullable().optional(),
  unit: z.string().trim().max(40).nullable().optional(),
  quantity: z.coerce.number().int().min(0).max(1_000_000).optional(),
  reorderLevel: z.coerce.number().int().min(0).max(1_000_000).optional(),
  location: z.string().trim().max(120).nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

const itemsQuery = z.object({
  q: z.string().optional(),
  categoryId: z.string().min(1).optional(),
  lowStockOnly: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
});

const movementsQuery = z.object({
  type: z.nativeEnum(InventoryMovementType).optional(),
  itemId: z.string().min(1).optional(),
  studentId: z.string().min(1).optional(),
  take: z.coerce.number().int().positive().max(500).optional(),
});

const stockBody = z.object({
  itemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1_000_000),
  note: z.string().trim().max(500).nullable().optional(),
});

const issueBody = z.object({
  itemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1_000_000),
  studentId: z.string().min(1).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export async function inventorySummaryController(req: Request, res: Response) {
  res.json({ data: await inventorySummary(req.auth!.tenantId!) });
}

export async function listInventoryCategoriesController(req: Request, res: Response) {
  res.json({ data: await listInventoryCategories(req.auth!.tenantId!) });
}

export async function createInventoryCategoryController(req: Request, res: Response) {
  res.status(201).json({
    data: await createInventoryCategory(req.auth!.tenantId!, categoryBody.parse(req.body)),
  });
}

export async function updateInventoryCategoryController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateInventoryCategory(
      req.auth!.tenantId!,
      id,
      categoryBody.partial().parse(req.body),
    ),
  });
}

export async function deleteInventoryCategoryController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteInventoryCategory(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function listInventoryItemsController(req: Request, res: Response) {
  const query = itemsQuery.parse(req.query);
  res.json({ data: await listInventoryItems(req.auth!.tenantId!, query) });
}

export async function createInventoryItemController(req: Request, res: Response) {
  res.status(201).json({
    data: await createInventoryItem(req.auth!.tenantId!, itemBody.parse(req.body)),
  });
}

export async function updateInventoryItemController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateInventoryItem(req.auth!.tenantId!, id, itemBody.partial().parse(req.body)),
  });
}

export async function deleteInventoryItemController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteInventoryItem(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function listInventoryMovementsController(req: Request, res: Response) {
  const query = movementsQuery.parse(req.query);
  res.json({ data: await listInventoryMovements(req.auth!.tenantId!, query) });
}

export async function addInventoryStockController(req: Request, res: Response) {
  const body = stockBody.parse(req.body);
  res.status(201).json({
    data: await addInventoryStock(req.auth!.tenantId!, {
      ...body,
      createdById: req.auth!.userId,
    }),
  });
}

export async function issueInventoryItemController(req: Request, res: Response) {
  const body = issueBody.parse(req.body);
  res.status(201).json({
    data: await issueInventoryItem(req.auth!.tenantId!, {
      ...body,
      createdById: req.auth!.userId,
    }),
  });
}

export async function returnInventoryItemController(req: Request, res: Response) {
  const body = issueBody.parse(req.body);
  res.status(201).json({
    data: await returnInventoryItem(req.auth!.tenantId!, {
      ...body,
      createdById: req.auth!.userId,
    }),
  });
}
