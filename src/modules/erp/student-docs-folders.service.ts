import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

const DEFAULT_FOLDERS = [
  { name: "Admission Documents", description: "Admission forms and related documents.", sortOrder: 1 },
  { name: "Personal Documents", description: "ID proofs, photos, and personal records.", sortOrder: 2 },
  { name: "Academic Documents", description: "Report cards, marksheets, and certificates.", sortOrder: 3 },
  { name: "Medical Records", description: "Health and medical certificates.", sortOrder: 4 },
  { name: "Fee Receipts", description: "Fee invoices and payment receipts.", sortOrder: 5 },
  { name: "Transfer Certificates", description: "TC and migration related files.", sortOrder: 6 },
];

const STORAGE_LIMIT_BYTES = 50 * 1024 * 1024 * 1024; // 50 GB

export type FolderInput = {
  name: string;
  description?: string | null;
  parentId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}

function classifyMime(mimeType: string | null | undefined) {
  const mime = (mimeType ?? "").toLowerCase();
  if (mime.startsWith("image/")) return "images" as const;
  if (
    mime.includes("pdf") ||
    mime.includes("msword") ||
    mime.includes("officedocument") ||
    mime.includes("text/")
  ) {
    return "documents" as const;
  }
  return "others" as const;
}

async function ensureDefaults(tenantId: string) {
  const count = await prisma.studentDocumentFolder.count({
    where: { tenantId, deletedAt: null },
  });
  if (count > 0) return;
  await prisma.studentDocumentFolder.createMany({
    data: DEFAULT_FOLDERS.map((item) => ({
      tenantId,
      name: item.name,
      description: item.description,
      sortOrder: item.sortOrder,
      isActive: true,
    })),
  });
}

async function assertUniqueName(
  tenantId: string,
  name: string,
  parentId: string | null | undefined,
  excludeId?: string,
) {
  const exists = await prisma.studentDocumentFolder.findFirst({
    where: tenantScope(tenantId, {
      name,
      parentId: parentId ?? null,
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    }),
    select: { id: true },
  });
  if (exists) {
    throw new AppError(409, `Folder "${name}" already exists`, "FOLDER_EXISTS");
  }
}

export async function getStudentDocsFoldersSetup(tenantId: string) {
  await ensureDefaults(tenantId);

  const [folders, docs] = await Promise.all([
    prisma.studentDocumentFolder.findMany({
      where: { tenantId },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { children: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.studentDocument.findMany({
      where: { tenantId },
      select: {
        folderId: true,
        sizeBytes: true,
        mimeType: true,
        deletedAt: true,
      },
    }),
  ]);

  const activeDocs = docs.filter((item) => !item.deletedAt);
  const sizeByFolder = new Map<string, { count: number; bytes: number }>();
  let documentsBytes = 0;
  let imagesBytes = 0;
  let othersBytes = 0;
  let totalBytes = 0;

  for (const doc of activeDocs) {
    const size = doc.sizeBytes ?? 0;
    totalBytes += size;
    const bucket = classifyMime(doc.mimeType);
    if (bucket === "images") imagesBytes += size;
    else if (bucket === "documents") documentsBytes += size;
    else othersBytes += size;

    const current = sizeByFolder.get(doc.folderId) ?? { count: 0, bytes: 0 };
    current.count += 1;
    current.bytes += size;
    sizeByFolder.set(doc.folderId, current);
  }

  const mapped = folders.map((folder, index) => {
    const stats = sizeByFolder.get(folder.id) ?? { count: 0, bytes: 0 };
    return {
      id: folder.id,
      name: folder.name,
      description: folder.description,
      parentId: folder.parentId,
      parentName: folder.parent?.name ?? null,
      isActive: folder.isActive,
      sortOrder: folder.sortOrder,
      deletedAt: folder.deletedAt,
      documentCount: stats.count,
      sizeBytes: stats.bytes,
      sizeLabel: formatBytes(stats.bytes),
      childrenCount: folder._count.children,
      index: index + 1,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    };
  });

  const activeFolders = mapped.filter((item) => !item.deletedAt);
  const recycled = mapped.filter((item) => item.deletedAt);

  return {
    folders: activeFolders,
    recycleBin: recycled,
    parents: activeFolders.map((item) => ({ id: item.id, name: item.name })),
    stats: {
      totalFolders: activeFolders.length,
      activeFolders: activeFolders.filter((item) => item.isActive).length,
      totalDocuments: activeDocs.length,
      totalSizeBytes: totalBytes,
      totalSizeLabel: formatBytes(totalBytes),
      recycleCount: recycled.length,
    },
    storage: {
      usedBytes: totalBytes,
      limitBytes: STORAGE_LIMIT_BYTES,
      usedLabel: formatBytes(totalBytes),
      limitLabel: formatBytes(STORAGE_LIMIT_BYTES),
      usedPercent: Math.min(100, Math.round((totalBytes / STORAGE_LIMIT_BYTES) * 1000) / 10),
      breakdown: [
        {
          key: "documents",
          label: "Documents",
          bytes: documentsBytes,
          labelSize: formatBytes(documentsBytes),
          percent: totalBytes ? Math.round((documentsBytes / totalBytes) * 1000) / 10 : 0,
        },
        {
          key: "images",
          label: "Images",
          bytes: imagesBytes,
          labelSize: formatBytes(imagesBytes),
          percent: totalBytes ? Math.round((imagesBytes / totalBytes) * 1000) / 10 : 0,
        },
        {
          key: "others",
          label: "Others",
          bytes: othersBytes,
          labelSize: formatBytes(othersBytes),
          percent: totalBytes ? Math.round((othersBytes / totalBytes) * 1000) / 10 : 0,
        },
      ],
    },
  };
}

export async function createStudentDocsFolder(tenantId: string, input: FolderInput) {
  const name = input.name.trim();
  const parentId = input.parentId ?? null;
  await assertUniqueName(tenantId, name, parentId);

  if (parentId) {
    const parent = await prisma.studentDocumentFolder.findFirst({
      where: tenantScope(tenantId, { id: parentId, deletedAt: null }),
    });
    if (!parent) throw new AppError(400, "Parent folder is invalid", "INVALID_FOLDER");
  }

  const maxSort = await prisma.studentDocumentFolder.aggregate({
    where: { tenantId, deletedAt: null },
    _max: { sortOrder: true },
  });

  return prisma.studentDocumentFolder.create({
    data: {
      tenantId,
      name,
      description: input.description?.trim() || null,
      parentId,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
}

export async function updateStudentDocsFolder(
  tenantId: string,
  id: string,
  input: Partial<FolderInput>,
) {
  const found = await prisma.studentDocumentFolder.findFirst({
    where: tenantScope(tenantId, { id, deletedAt: null }),
  });
  if (!found) throw new AppError(404, "Folder not found", "FOLDER_NOT_FOUND");

  const parentId = input.parentId === undefined ? found.parentId : input.parentId;
  if (parentId === id) {
    throw new AppError(400, "Folder cannot be its own parent", "INVALID_PARENT");
  }
  if (input.name != null || input.parentId !== undefined) {
    await assertUniqueName(tenantId, (input.name ?? found.name).trim(), parentId, id);
  }
  if (parentId) {
    const parent = await prisma.studentDocumentFolder.findFirst({
      where: tenantScope(tenantId, { id: parentId, deletedAt: null }),
    });
    if (!parent) throw new AppError(400, "Parent folder is invalid", "INVALID_FOLDER");
  }

  return prisma.studentDocumentFolder.update({
    where: { id },
    data: {
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.parentId !== undefined ? { parentId } : {}),
      ...(input.isActive != null ? { isActive: input.isActive } : {}),
      ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
    },
  });
}

export async function softDeleteStudentDocsFolder(tenantId: string, id: string) {
  const found = await prisma.studentDocumentFolder.findFirst({
    where: tenantScope(tenantId, { id, deletedAt: null }),
    include: {
      _count: { select: { children: { where: { deletedAt: null } } } },
    },
  });
  if (!found) throw new AppError(404, "Folder not found", "FOLDER_NOT_FOUND");
  if (found._count.children > 0) {
    throw new AppError(400, "Move or delete child folders first", "FOLDER_HAS_CHILDREN");
  }
  await prisma.studentDocumentFolder.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  return { deleted: true };
}

export async function restoreStudentDocsFolder(tenantId: string, id: string) {
  const found = await prisma.studentDocumentFolder.findFirst({
    where: tenantScope(tenantId, { id, deletedAt: { not: null } }),
  });
  if (!found) throw new AppError(404, "Folder not found in recycle bin", "FOLDER_NOT_FOUND");
  await assertUniqueName(tenantId, found.name, found.parentId, id);
  return prisma.studentDocumentFolder.update({
    where: { id },
    data: { deletedAt: null, isActive: true },
  });
}

export async function reorderStudentDocsFolders(tenantId: string, orderedIds: string[]) {
  const folders = await prisma.studentDocumentFolder.findMany({
    where: { tenantId, deletedAt: null, id: { in: orderedIds } },
    select: { id: true },
  });
  if (folders.length !== orderedIds.length) {
    throw new AppError(400, "One or more folders are invalid", "INVALID_FOLDER_ORDER");
  }
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.studentDocumentFolder.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    ),
  );
  return getStudentDocsFoldersSetup(tenantId);
}
