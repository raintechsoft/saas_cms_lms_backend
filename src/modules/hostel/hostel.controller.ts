import type { Request, Response } from "express";
import { z } from "zod";
import {
  assignStudentToRoom,
  createHostelBlock,
  createHostelRoom,
  deleteHostelBlock,
  deleteHostelRoom,
  listHostelBlocks,
  listHostelRooms,
  updateHostelBlock,
  updateHostelRoom,
} from "./hostel.service.js";

const idParams = z.object({ id: z.string().min(1) });
const roomsQuery = z.object({ blockId: z.string().min(1).optional() });

const blockBody = z.object({
  name: z.string().trim().min(1).max(120),
  gender: z.string().trim().max(20).nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

const roomBody = z.object({
  blockId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  capacity: z.coerce.number().int().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

const roomUpdateBody = roomBody.omit({ blockId: true }).partial().extend({
  blockId: z.string().min(1).optional(),
});

const assignBody = z.object({
  studentId: z.string().min(1),
  roomId: z.string().min(1).nullable(),
});

export async function listHostelBlocksController(req: Request, res: Response) {
  res.json({ data: await listHostelBlocks(req.auth!.tenantId!) });
}

export async function createHostelBlockController(req: Request, res: Response) {
  res.status(201).json({
    data: await createHostelBlock(req.auth!.tenantId!, blockBody.parse(req.body)),
  });
}

export async function updateHostelBlockController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateHostelBlock(req.auth!.tenantId!, id, blockBody.partial().parse(req.body)),
  });
}

export async function deleteHostelBlockController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteHostelBlock(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function listHostelRoomsController(req: Request, res: Response) {
  const { blockId } = roomsQuery.parse(req.query);
  res.json({ data: await listHostelRooms(req.auth!.tenantId!, blockId) });
}

export async function createHostelRoomController(req: Request, res: Response) {
  res.status(201).json({
    data: await createHostelRoom(req.auth!.tenantId!, roomBody.parse(req.body)),
  });
}

export async function updateHostelRoomController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateHostelRoom(req.auth!.tenantId!, id, roomUpdateBody.parse(req.body)),
  });
}

export async function deleteHostelRoomController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteHostelRoom(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function assignHostelStudentController(req: Request, res: Response) {
  const body = assignBody.parse(req.body);
  res.json({
    data: await assignStudentToRoom(req.auth!.tenantId!, body.studentId, body.roomId),
  });
}
