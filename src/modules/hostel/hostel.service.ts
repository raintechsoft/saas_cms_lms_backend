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

export type HostelBedInput = {
  roomId: string;
  label: string;
  isActive?: boolean;
};

function genderBucket(value: string): "M" | "F" | "X" {
  const normalized = value.trim().toUpperCase();
  if (["MIXED", "ANY", "ALL", "OTHER", "X"].includes(normalized)) return "X";
  if (["M", "MALE", "BOY", "BOYS"].includes(normalized)) return "M";
  if (["F", "FEMALE", "GIRL", "GIRLS"].includes(normalized)) return "F";
  return "X";
}

function gendersCompatible(blockGender: string, studentGender: string) {
  const block = genderBucket(blockGender);
  const student = genderBucket(studentGender);
  if (block === "X" || student === "X") return true;
  return block === student;
}

function blockInclude() {
  return {
    _count: { select: { rooms: true } },
  } as const;
}

function roomInclude() {
  return {
    block: { select: { id: true, name: true, gender: true } },
    beds: {
      where: { isActive: true },
      orderBy: { label: "asc" as const },
      include: {
        student: {
          select: { id: true, admissionNumber: true, firstName: true, lastName: true },
        },
      },
    },
    _count: { select: { students: true, beds: true } },
  } as const;
}

async function ensureBedsForCapacity(tenantId: string, roomId: string, capacity: number) {
  const existing = await prisma.hostelBed.findMany({
    where: tenantScope(tenantId, { roomId }),
    orderBy: { label: "asc" },
  });
  if (existing.length >= capacity) return existing;

  const toCreate = [];
  for (let i = existing.length + 1; i <= capacity; i += 1) {
    toCreate.push({
      tenantId,
      roomId,
      label: `Bed ${i}`,
      isActive: true,
    });
  }
  if (toCreate.length) {
    await prisma.hostelBed.createMany({ data: toCreate });
  }
  return prisma.hostelBed.findMany({
    where: tenantScope(tenantId, { roomId }),
    orderBy: { label: "asc" },
  });
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
        hostelBedId: null,
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

  const capacity = Math.max(1, input.capacity ?? 1);
  const room = await prisma.hostelRoom.create({
    data: {
      tenantId,
      blockId: input.blockId,
      name: input.name.trim(),
      capacity,
      isActive: input.isActive ?? true,
      notes: input.notes?.trim() || null,
    },
    include: roomInclude(),
  });
  await ensureBedsForCapacity(tenantId, room.id, capacity);
  return prisma.hostelRoom.findFirstOrThrow({
    where: { id: room.id },
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
      ...(input.capacity !== undefined ? { capacity: Math.max(1, input.capacity) } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    },
    include: roomInclude(),
  });

  if (input.capacity !== undefined) {
    await ensureBedsForCapacity(tenantId, id, Math.max(1, input.capacity));
  }

  const label = `${room.block.name} · ${room.name}`;
  await prisma.student.updateMany({
    where: tenantScope(tenantId, { hostelRoomId: id }),
    data: { hostelRoom: label },
  });

  return prisma.hostelRoom.findFirstOrThrow({
    where: { id },
    include: roomInclude(),
  });
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
      hostelBedId: null,
    },
  });
  await prisma.hostelRoom.delete({ where: { id } });
}

export async function listHostelBeds(tenantId: string, roomId?: string) {
  return prisma.hostelBed.findMany({
    where: tenantScope(tenantId, roomId ? { roomId } : {}),
    include: {
      room: { include: { block: { select: { id: true, name: true } } } },
      student: {
        select: { id: true, admissionNumber: true, firstName: true, lastName: true },
      },
    },
    orderBy: [{ room: { name: "asc" } }, { label: "asc" }],
  });
}

export async function createHostelBed(tenantId: string, input: HostelBedInput) {
  const room = await prisma.hostelRoom.findFirst({
    where: tenantScope(tenantId, { id: input.roomId }),
    select: { id: true, capacity: true },
  });
  if (!room) throw new AppError(404, "Hostel room not found", "HOSTEL_ROOM_NOT_FOUND");

  const bedCount = await prisma.hostelBed.count({
    where: tenantScope(tenantId, { roomId: room.id, isActive: true }),
  });
  if (bedCount >= room.capacity) {
    throw new AppError(409, "Room already has beds equal to capacity", "HOSTEL_BED_CAPACITY");
  }

  return prisma.hostelBed.create({
    data: {
      tenantId,
      roomId: input.roomId,
      label: input.label.trim(),
      isActive: input.isActive ?? true,
    },
    include: {
      room: { include: { block: { select: { id: true, name: true } } } },
      student: {
        select: { id: true, admissionNumber: true, firstName: true, lastName: true },
      },
    },
  });
}

export async function deleteHostelBed(tenantId: string, id: string) {
  const bed = await prisma.hostelBed.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true },
  });
  if (!bed) throw new AppError(404, "Hostel bed not found", "HOSTEL_BED_NOT_FOUND");

  await prisma.student.updateMany({
    where: tenantScope(tenantId, { hostelBedId: id }),
    data: { hostelBedId: null },
  });
  await prisma.hostelBed.delete({ where: { id } });
}

export async function listRoomStudents(tenantId: string, roomId: string) {
  const room = await prisma.hostelRoom.findFirst({
    where: tenantScope(tenantId, { id: roomId }),
    include: {
      block: { select: { id: true, name: true, gender: true } },
      beds: {
        orderBy: { label: "asc" },
        include: {
          student: {
            select: { id: true, admissionNumber: true, firstName: true, lastName: true },
          },
        },
      },
    },
  });
  if (!room) throw new AppError(404, "Hostel room not found", "HOSTEL_ROOM_NOT_FOUND");

  const students = await prisma.student.findMany({
    where: tenantScope(tenantId, { hostelRoomId: roomId }),
    select: {
      id: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      gender: true,
      hostelRoom: true,
      hostelBedId: true,
      hostelBedRef: { select: { id: true, label: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return { room, students };
}

export async function listHostelAllocationLogs(
  tenantId: string,
  query?: { studentId?: string; roomId?: string; take?: number },
) {
  return prisma.hostelAllocationLog.findMany({
    where: tenantScope(tenantId, {
      ...(query?.studentId ? { studentId: query.studentId } : {}),
      ...(query?.roomId ? { hostelRoomId: query.roomId } : {}),
    }),
    include: {
      student: {
        select: { id: true, admissionNumber: true, firstName: true, lastName: true },
      },
      hostelRoom: {
        select: { id: true, name: true, block: { select: { name: true } } },
      },
      assignedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: query?.take ?? 100,
  });
}

export async function assignStudentToRoom(
  tenantId: string,
  studentId: string,
  roomId: string | null,
  options?: {
    bedId?: string | null;
    assignedById?: string | null;
    note?: string | null;
    enforceGender?: boolean;
  },
) {
  const student = await prisma.student.findFirst({
    where: tenantScope(tenantId, { id: studentId }),
    select: {
      id: true,
      gender: true,
      hostelRoomId: true,
      hostelBedId: true,
      hostelRoom: true,
    },
  });
  if (!student) throw new AppError(404, "Student not found", "STUDENT_NOT_FOUND");

  if (!roomId) {
    const updated = await prisma.student.update({
      where: { id: studentId },
      data: {
        hostelOptIn: false,
        hostelRoomId: null,
        hostelRoom: null,
        hostelBedId: null,
      },
      select: {
        id: true,
        hostelOptIn: true,
        hostelRoomId: true,
        hostelRoom: true,
        hostelBedId: true,
      },
    });
    await prisma.hostelAllocationLog.create({
      data: {
        tenantId,
        studentId,
        hostelRoomId: student.hostelRoomId,
        hostelBedId: student.hostelBedId,
        roomLabel: student.hostelRoom,
        action: "CLEARED",
        note: options?.note?.trim() || null,
        assignedById: options?.assignedById || null,
      },
    });
    return updated;
  }

  const room = await prisma.hostelRoom.findFirst({
    where: tenantScope(tenantId, { id: roomId, isActive: true }),
    include: { block: { select: { name: true, gender: true } } },
  });
  if (!room) throw new AppError(404, "Hostel room not found", "HOSTEL_ROOM_NOT_FOUND");

  if (
    options?.enforceGender !== false &&
    room.block.gender &&
    student.gender &&
    !gendersCompatible(room.block.gender, student.gender)
  ) {
    throw new AppError(
      409,
      `Block is for ${room.block.gender}; student gender is ${student.gender}`,
      "HOSTEL_GENDER_MISMATCH",
    );
  }

  const occupied = await prisma.student.count({
    where: tenantScope(tenantId, {
      hostelRoomId: roomId,
      id: { not: studentId },
    }),
  });
  if (occupied >= room.capacity) {
    throw new AppError(409, "Hostel room is at capacity", "HOSTEL_ROOM_FULL");
  }

  let bedId = options?.bedId?.trim() || null;
  if (bedId) {
    const bed = await prisma.hostelBed.findFirst({
      where: tenantScope(tenantId, { id: bedId, roomId, isActive: true }),
      include: { student: { select: { id: true } } },
    });
    if (!bed) throw new AppError(404, "Hostel bed not found", "HOSTEL_BED_NOT_FOUND");
    if (bed.student && bed.student.id !== studentId) {
      throw new AppError(409, "Hostel bed is already occupied", "HOSTEL_BED_OCCUPIED");
    }
  } else {
    await ensureBedsForCapacity(tenantId, roomId, room.capacity);
    const freeBed = await prisma.hostelBed.findFirst({
      where: tenantScope(tenantId, {
        roomId,
        isActive: true,
        student: null,
      }),
      orderBy: { label: "asc" },
    });
    bedId = freeBed?.id ?? null;
  }

  const label = `${room.block.name} · ${room.name}${bedId ? "" : ""}`;
  const bed = bedId
    ? await prisma.hostelBed.findFirst({
        where: { id: bedId },
        select: { label: true },
      })
    : null;
  const fullLabel = bed ? `${label} · ${bed.label}` : label;

  const updated = await prisma.student.update({
    where: { id: studentId },
    data: {
      hostelOptIn: true,
      hostelRoomId: room.id,
      hostelRoom: fullLabel,
      hostelBedId: bedId,
    },
    select: {
      id: true,
      hostelOptIn: true,
      hostelRoomId: true,
      hostelRoom: true,
      hostelBedId: true,
    },
  });

  await prisma.hostelAllocationLog.create({
    data: {
      tenantId,
      studentId,
      hostelRoomId: room.id,
      hostelBedId: bedId,
      roomLabel: fullLabel,
      action: student.hostelRoomId === room.id ? "UPDATED" : "ASSIGNED",
      note: options?.note?.trim() || null,
      assignedById: options?.assignedById || null,
    },
  });

  return updated;
}
