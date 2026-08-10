import {
  MultiFeeBookHeadFrequency,
  MultiFeeBookTarget,
  MultiFeeBookType,
} from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  copyMultiFeeBook,
  createMultiFeeBook,
  deleteMultiFeeBook,
  getMultiFeeBookSetup,
  updateMultiFeeBook,
} from "./multi-fee-book.service.js";

const idParams = z.object({ id: z.string().min(1) });

const headSchema = z.object({
  feeTypeId: z.string().min(1),
  amount: z.coerce.number().min(0).max(10_000_000),
  frequency: z.nativeEnum(MultiFeeBookHeadFrequency),
});

const bookBody = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  academicSessionId: z.string().min(1),
  type: z.nativeEnum(MultiFeeBookType).optional(),
  target: z.nativeEnum(MultiFeeBookTarget).optional(),
  isActive: z.boolean().optional(),
  classIds: z.array(z.string().min(1)).max(200).optional(),
  heads: z.array(headSchema).max(100).optional(),
});

const bookUpdateBody = bookBody.partial().extend({
  academicSessionId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120).optional(),
});

export async function getMultiFeeBookSetupController(req: Request, res: Response) {
  res.json({ data: await getMultiFeeBookSetup(req.auth!.tenantId!) });
}

export async function createMultiFeeBookController(req: Request, res: Response) {
  res.status(201).json({
    data: await createMultiFeeBook(
      req.auth!.tenantId!,
      req.auth!.userId,
      bookBody.parse(req.body),
    ),
  });
}

export async function updateMultiFeeBookController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateMultiFeeBook(
      req.auth!.tenantId!,
      id,
      bookUpdateBody.parse(req.body),
    ),
  });
}

export async function copyMultiFeeBookController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.status(201).json({
    data: await copyMultiFeeBook(req.auth!.tenantId!, req.auth!.userId, id),
  });
}

export async function deleteMultiFeeBookController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteMultiFeeBook(req.auth!.tenantId!, id) });
}
