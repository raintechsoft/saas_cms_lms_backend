import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

export type HostelBlockInput = {
  name: string;
  gender?: string | null;
  isActive?: boolean;
  notes?: string | null;
};

export type HostelRoomInput = {
  blockId: string;
  name: string;
  capacity?: number;
  isActive?: boolean;
  notes?: string | null;
};

function blockInclude() {
  return {
    _count: { select: { rooms: true } },
  } as const;
}

function roomInclude() {
  return {
    block: { select: { id: true, name: true } },
    _count: { select: { students: true } },
  } as const;
}

export async function listHostelBlocks(tenantId: string) {
  return prisma.hostelBlock.findMany({
    where: tenantScope(tenantId, {}),
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: blockInclude(),
  });
}

export async function createHostelBlock(tenantId: string, input: HostelBlockInput) {
  return prisma.hostelBlock.create({
    data: {
      tenantId,
      name: input.name.trim(),
      gender: input.gender?.trim() || null,
      isActive: input.isActive ?? true,
      notes: input.notes?.trim() || null,
    },
    include: blockInclude(),
  });
}

export async function updateHostelBlock(
  tenantId: string,
  id: string,
  input: Partial<HostelBlockInput>,
) {
  const found = await prisma.hostelBlock.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true, name: true },
  });
  if (!found) throw new AppError(404, "Hostel block not found", "HOSTEL_BLOCK_NOT_FOUND");

  const block = await prisma.hostelBlock.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.gender !== undefined ? { gender: input.gender?.trim() || null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    },
    include: blockInclude(),
  });

  if (input.name !== undefined && input.name.trim() !== found.name) {
    const rooms = await prisma.hostelRoom.findMany({
      where: tenantScope(tenantId, { blockId: id }),
      select: { id: true, name: true },
    });
    for (const room of rooms) {
      const label = `${block.name} · ${room.name}`;
      await prisma.student.updateMany({
        where: tenantScope(tenantId, { hostelRoomId: room.id }),
        data: { hostelRoom: label },
      });
    }
  }

  return block;
}

export async function deleteHostelBlock(tenantId: string, id: string) {
  const found = await prisma.hostelBlock.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true },
  });
  if (!found) throw new AppError(404, "Hostel block not found", "HOSTEL_BLOCK_NOT_FOUND");

  const roomIds = (
    await prisma.hostelRoom.findMany({
      where: tenantScope(tenantId, { blockId: id }),
      select: { id: true },
    })
  ).map((room) => room.id);

  if (roomIds.length) {
    await prisma.student.updateMany({
      where: tenantScope(tenantId, { hostelRoomId: { in: roomIds } }),
      data: {
        hostelOptIn: false,
        hostelRoomId: null,
        hostelRoom: null,
      },
    });
  }

  await prisma.hostelBlock.delete({ where: { id } });
}

export async function listHostelRooms(tenantId: string, blockId?: string) {
  if (blockId) {
    const block = await prisma.hostelBlock.findFirst({
      where: tenantScope(tenantId, { id: blockId }),
      select: { id: true },
    });
    if (!block) throw new AppError(404, "Hostel block not found", "HOSTEL_BLOCK_NOT_FOUND");
  }

  return prisma.hostelRoom.findMany({
    where: tenantScope(tenantId, blockId ? { blockId } : {}),
    orderBy: [{ block: { name: "asc" } }, { name: "asc" }],
    include: roomInclude(),
  });
}

export async function createHostelRoom(tenantId: string, input: HostelRoomInput) {
  const block = await prisma.hostelBlock.findFirst({
    where: tenantScope(tenantId, { id: input.blockId }),
    select: { id: true },
  });
  if (!block) throw new AppError(404, "Hostel block not found", "HOSTEL_BLOCK_NOT_FOUND");

  return prisma.hostelRoom.create({
    data: {
      tenantId,
      blockId: input.blockId,
      name: input.name.trim(),
      capacity: input.capacity ?? 1,
      isActive: input.isActive ?? true,
      notes: input.notes?.trim() || null,
    },
    include: roomInclude(),
  });
}

export async function updateHostelRoom(
  tenantId: string,
  id: string,
  input: Partial<Omit<HostelRoomInput, "blockId">> & { blockId?: string },
) {
  const found = await prisma.hostelRoom.findFirst({
    where: tenantScope(tenantId, { id }),
    include: { block: { select: { id: true, name: true } } },
  });
  if (!found) throw new AppError(404, "Hostel room not found", "HOSTEL_ROOM_NOT_FOUND");

  if (input.blockId && input.blockId !== found.blockId) {
    const block = await prisma.hostelBlock.findFirst({
      where: tenantScope(tenantId, { id: input.blockId }),
      select: { id: true },
    });
    if (!block) throw new AppError(404, "Hostel block not found", "HOSTEL_BLOCK_NOT_FOUND");
  }

  const room = await prisma.hostelRoom.update({
    where: { id },
    data: {
      ...(input.blockId !== undefined ? { blockId: input.blockId } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    },
    include: roomInclude(),
  });

  const label = `${room.block.name} · ${room.name}`;
  await prisma.student.updateMany({
    where: tenantScope(tenantId, { hostelRoomId: id }),
    data: { hostelRoom: label },
  });

  return room;
}

export async function deleteHostelRoom(tenantId: string, id: string) {
  const found = await prisma.hostelRoom.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true },
  });
  if (!found) throw new AppError(404, "Hostel room not found", "HOSTEL_ROOM_NOT_FOUND");

  await prisma.student.updateMany({
    where: tenantScope(tenantId, { hostelRoomId: id }),
    data: {
      hostelOptIn: false,
      hostelRoomId: null,
      hostelRoom: null,
    },
  });
  await prisma.hostelRoom.delete({ where: { id } });
}

export async function assignStudentToRoom(
  tenantId: string,
  studentId: string,
  roomId: string | null,
) {
  const student = await prisma.student.findFirst({
    where: tenantScope(tenantId, { id: studentId }),
    select: { id: true, hostelRoomId: true },
  });
  if (!student) throw new AppError(404, "Student not found", "STUDENT_NOT_FOUND");

  if (!roomId) {
    return prisma.student.update({
      where: { id: studentId },
      data: {
        hostelOptIn: false,
        hostelRoomId: null,
        hostelRoom: null,
      },
      select: {
        id: true,
        hostelOptIn: true,
        hostelRoomId: true,
        hostelRoom: true,
      },
    });
  }

  const room = await prisma.hostelRoom.findFirst({
    where: tenantScope(tenantId, { id: roomId, isActive: true }),
    include: { block: { select: { name: true } } },
  });
  if (!room) throw new AppError(404, "Hostel room not found", "HOSTEL_ROOM_NOT_FOUND");

  const occupied = await prisma.student.count({
    where: tenantScope(tenantId, {
      hostelRoomId: roomId,
      id: { not: studentId },
    }),
  });

  if (occupied >= room.capacity) {
    throw new AppError(409, "Hostel room is at capacity", "HOSTEL_ROOM_FULL");
  }

  const label = `${room.block.name} · ${room.name}`;
  return prisma.student.update({
    where: { id: studentId },
    data: {
      hostelOptIn: true,
      hostelRoomId: room.id,
      hostelRoom: label,
    },
    select: {
      id: true,
      hostelOptIn: true,
      hostelRoomId: true,
      hostelRoom: true,
    },
  });
}
