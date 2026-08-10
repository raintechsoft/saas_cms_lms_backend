import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

const DEFAULT_CBSE_GRADES: Array<{
  grade: string;
  gradePoint: number;
  fromPercent: number;
  toPercent: number;
  gradeName: string;
  remarks: string;
}> = [
  { grade: "A1", gradePoint: 10, fromPercent: 91, toPercent: 100, gradeName: "Outstanding", remarks: "Excellent" },
  { grade: "A2", gradePoint: 9, fromPercent: 81, toPercent: 90, gradeName: "Excellent", remarks: "Very Good" },
  { grade: "B1", gradePoint: 8, fromPercent: 71, toPercent: 80, gradeName: "Very Good", remarks: "Good" },
  { grade: "B2", gradePoint: 7, fromPercent: 61, toPercent: 70, gradeName: "Good", remarks: "Above Average" },
  { grade: "C1", gradePoint: 6, fromPercent: 51, toPercent: 60, gradeName: "Fair", remarks: "Average" },
  { grade: "C2", gradePoint: 5, fromPercent: 41, toPercent: 50, gradeName: "Satisfactory", remarks: "Below Average" },
  { grade: "D", gradePoint: 4, fromPercent: 33, toPercent: 40, gradeName: "Needs Improvement", remarks: "Pass" },
  { grade: "E", gradePoint: 0, fromPercent: 0, toPercent: 32, gradeName: "Fail", remarks: "Fail" },
];

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return 0;
  return Number(value);
}

function mapGrade(grade: {
  id: string;
  grade: string;
  gradePoint: Prisma.Decimal;
  fromPercent: Prisma.Decimal;
  toPercent: Prisma.Decimal;
  gradeName: string | null;
  remarks: string | null;
  sortOrder: number;
}) {
  return {
    id: grade.id,
    grade: grade.grade,
    gradePoint: toNumber(grade.gradePoint),
    fromPercent: toNumber(grade.fromPercent),
    toPercent: toNumber(grade.toPercent),
    gradeName: grade.gradeName,
    remarks: grade.remarks,
    sortOrder: grade.sortOrder,
  };
}

async function syncScaleClasses(tenantId: string, scaleId: string, classIds: string[]) {
  const unique = [...new Set(classIds)];
  if (unique.length) {
    const count = await prisma.academicClass.count({
      where: tenantScope(tenantId, { id: { in: unique } }),
    });
    if (count !== unique.length) {
      throw new AppError(400, "One or more classes are invalid", "INVALID_CLASS");
    }
  }

  await prisma.$transaction([
    prisma.gradingScaleClass.deleteMany({
      where: tenantScope(tenantId, {
        OR: [{ scaleId }, { classId: { in: unique } }],
      }),
    }),
    ...(unique.length
      ? [
          prisma.gradingScaleClass.createMany({
            data: unique.map((classId) => ({ tenantId, scaleId, classId })),
          }),
        ]
      : []),
  ]);
}

async function ensureDefaultScale(tenantId: string) {
  const count = await prisma.gradingScale.count({ where: tenantScope(tenantId, {}) });
  if (count > 0) return;

  const classes = await prisma.academicClass.findMany({
    where: tenantScope(tenantId, {}),
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const scale = await prisma.gradingScale.create({
    data: {
      tenantId,
      name: "CBSE Grading Scale (1-10)",
      isDefault: true,
      isActive: true,
      grades: {
        create: DEFAULT_CBSE_GRADES.map((item, index) => ({
          tenantId,
          grade: item.grade,
          gradePoint: item.gradePoint,
          fromPercent: item.fromPercent,
          toPercent: item.toPercent,
          gradeName: item.gradeName,
          remarks: item.remarks,
          sortOrder: index + 1,
        })),
      },
      classes: {
        create: classes.map((item) => ({ tenantId, classId: item.id })),
      },
    },
  });

  return scale;
}

function formatClassRange(classes: Array<{ name: string }>) {
  if (!classes.length) return "—";
  if (classes.length === 1) return classes[0].name;
  return `${classes[0].name} - ${classes[classes.length - 1].name}`;
}

function buildClassGroups(
  classes: Array<{ id: string; name: string; sortOrder: number }>,
  assignments: Array<{ classId: string; scaleId: string; scale: { id: string; name: string } }>,
) {
  const scaleByClass = new Map(assignments.map((row) => [row.classId, row]));
  const groups: Array<{
    key: string;
    label: string;
    classIds: string[];
    scaleId: string | null;
    scaleName: string | null;
  }> = [];

  let current: {
    scaleId: string | null;
    scaleName: string | null;
    classes: Array<{ id: string; name: string }>;
  } | null = null;

  for (const academicClass of classes) {
    const assignment = scaleByClass.get(academicClass.id);
    const scaleId = assignment?.scaleId ?? null;
    const scaleName = assignment?.scale.name ?? null;

    if (current && current.scaleId === scaleId) {
      current.classes.push({ id: academicClass.id, name: academicClass.name });
      continue;
    }

    if (current) {
      groups.push({
        key: `${current.scaleId ?? "none"}-${current.classes[0]?.id ?? "empty"}`,
        label: formatClassRange(current.classes),
        classIds: current.classes.map((item) => item.id),
        scaleId: current.scaleId,
        scaleName: current.scaleName,
      });
    }
    current = {
      scaleId,
      scaleName,
      classes: [{ id: academicClass.id, name: academicClass.name }],
    };
  }

  if (current?.classes.length) {
    groups.push({
      key: `${current.scaleId ?? "none"}-${current.classes[0]?.id ?? "empty"}`,
      label: formatClassRange(current.classes),
      classIds: current.classes.map((item) => item.id),
      scaleId: current.scaleId,
      scaleName: current.scaleName,
    });
  }

  return groups;
}

async function loadScale(tenantId: string, id: string) {
  const scale = await prisma.gradingScale.findFirst({
    where: tenantScope(tenantId, { id }),
    include: {
      grades: { orderBy: [{ sortOrder: "asc" }, { fromPercent: "desc" }] },
      classes: {
        include: {
          academicClass: { select: { id: true, name: true, sortOrder: true } },
        },
      },
    },
  });
  if (!scale) throw new AppError(404, "Grading scale not found", "SCALE_NOT_FOUND");
  const classes = scale.classes
    .map((row) => row.academicClass)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return {
    id: scale.id,
    name: scale.name,
    isDefault: scale.isDefault,
    isActive: scale.isActive,
    createdAt: scale.createdAt,
    applicableClassesLabel: classes.length
      ? classes.length === (await prisma.academicClass.count({ where: tenantScope(tenantId, {}) }))
        ? "All Classes"
        : formatClassRange(classes)
      : "—",
    classes,
    grades: scale.grades.map(mapGrade),
  };
}

export async function getGradingScaleSetup(tenantId: string) {
  await ensureDefaultScale(tenantId);

  const [scales, classes, assignments] = await Promise.all([
    prisma.gradingScale.findMany({
      where: tenantScope(tenantId, {}),
      include: {
        grades: { orderBy: [{ sortOrder: "asc" }, { fromPercent: "desc" }] },
        classes: {
          include: {
            academicClass: { select: { id: true, name: true, sortOrder: true } },
          },
        },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.academicClass.findMany({
      where: tenantScope(tenantId, {}),
      select: { id: true, name: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.gradingScaleClass.findMany({
      where: tenantScope(tenantId, {}),
      include: { scale: { select: { id: true, name: true } } },
    }),
  ]);

  const totalClasses = classes.length;
  const mappedScales = scales.map((scale) => {
    const scaleClasses = scale.classes
      .map((row) => row.academicClass)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    return {
      id: scale.id,
      name: scale.name,
      isDefault: scale.isDefault,
      isActive: scale.isActive,
      createdAt: scale.createdAt,
      applicableClassesLabel: scaleClasses.length
        ? scaleClasses.length === totalClasses
          ? "All Classes"
          : formatClassRange(scaleClasses)
        : "—",
      classes: scaleClasses,
      grades: scale.grades.map(mapGrade),
    };
  });

  return {
    scales: mappedScales,
    classes,
    classGroups: buildClassGroups(classes, assignments),
  };
}

export async function createGradingScale(
  tenantId: string,
  input: {
    name: string;
    isDefault?: boolean;
    isActive?: boolean;
    classIds?: string[];
  },
) {
  const name = input.name.trim();
  const existing = await prisma.gradingScale.findFirst({
    where: tenantScope(tenantId, { name }),
    select: { id: true },
  });
  if (existing) throw new AppError(409, `Scale "${name}" already exists`, "SCALE_EXISTS");

  const isDefault = input.isDefault ?? false;
  if (isDefault) {
    await prisma.gradingScale.updateMany({
      where: tenantScope(tenantId, { isDefault: true }),
      data: { isDefault: false },
    });
  }

  const scale = await prisma.gradingScale.create({
    data: {
      tenantId,
      name,
      isDefault,
      isActive: input.isActive ?? true,
    },
  });

  if (input.classIds) {
    await syncScaleClasses(tenantId, scale.id, input.classIds);
  }

  return loadScale(tenantId, scale.id);
}

export async function updateGradingScale(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    isDefault?: boolean;
    isActive?: boolean;
    classIds?: string[];
  },
) {
  const existing = await prisma.gradingScale.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!existing) throw new AppError(404, "Grading scale not found", "SCALE_NOT_FOUND");

  if (input.name) {
    const clash = await prisma.gradingScale.findFirst({
      where: tenantScope(tenantId, { name: input.name.trim(), id: { not: id } }),
      select: { id: true },
    });
    if (clash) throw new AppError(409, `Scale "${input.name.trim()}" already exists`, "SCALE_EXISTS");
  }

  if (input.isDefault === true) {
    await prisma.gradingScale.updateMany({
      where: tenantScope(tenantId, { isDefault: true, id: { not: id } }),
      data: { isDefault: false },
    });
  }

  if (input.isDefault === false && existing.isDefault) {
    throw new AppError(400, "Set another scale as default before unsetting this one", "DEFAULT_REQUIRED");
  }

  await prisma.gradingScale.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      isDefault: input.isDefault,
      isActive: input.isActive,
    },
  });

  if (input.classIds) {
    await syncScaleClasses(tenantId, id, input.classIds);
  }

  return loadScale(tenantId, id);
}

export async function deleteGradingScale(tenantId: string, id: string) {
  const existing = await prisma.gradingScale.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!existing) throw new AppError(404, "Grading scale not found", "SCALE_NOT_FOUND");
  if (existing.isDefault) {
    throw new AppError(400, "Cannot delete the default grading scale", "DEFAULT_SCALE_DELETE");
  }
  await prisma.gradingScale.delete({ where: { id } });
  return { ok: true };
}

function assertPercentRange(fromPercent: number, toPercent: number) {
  if (fromPercent < 0 || toPercent > 100 || fromPercent > toPercent) {
    throw new AppError(400, "Percent range must be within 0–100 and From ≤ To", "INVALID_PERCENT_RANGE");
  }
}

async function assertNoOverlap(
  tenantId: string,
  scaleId: string,
  fromPercent: number,
  toPercent: number,
  excludeId?: string,
) {
  const overlap = await prisma.gradingScaleGrade.findFirst({
    where: tenantScope(tenantId, {
      scaleId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      fromPercent: { lte: toPercent },
      toPercent: { gte: fromPercent },
    }),
  });
  if (overlap) {
    throw new AppError(409, "Percent ranges must not overlap", "GRADE_OVERLAP");
  }
}

export async function createGradingScaleGrade(
  tenantId: string,
  scaleId: string,
  input: {
    grade: string;
    gradePoint: number;
    fromPercent: number;
    toPercent: number;
    gradeName?: string | null;
    remarks?: string | null;
    sortOrder?: number;
  },
) {
  const scale = await prisma.gradingScale.findFirst({
    where: tenantScope(tenantId, { id: scaleId }),
    select: { id: true },
  });
  if (!scale) throw new AppError(404, "Grading scale not found", "SCALE_NOT_FOUND");

  assertPercentRange(input.fromPercent, input.toPercent);
  await assertNoOverlap(tenantId, scaleId, input.fromPercent, input.toPercent);

  const maxSort = await prisma.gradingScaleGrade.aggregate({
    where: tenantScope(tenantId, { scaleId }),
    _max: { sortOrder: true },
  });

  const grade = await prisma.gradingScaleGrade.create({
    data: {
      tenantId,
      scaleId,
      grade: input.grade.trim().toUpperCase(),
      gradePoint: input.gradePoint,
      fromPercent: input.fromPercent,
      toPercent: input.toPercent,
      gradeName: input.gradeName?.trim() || null,
      remarks: input.remarks?.trim() || null,
      sortOrder: input.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
  return mapGrade(grade);
}

export async function updateGradingScaleGrade(
  tenantId: string,
  id: string,
  input: {
    grade?: string;
    gradePoint?: number;
    fromPercent?: number;
    toPercent?: number;
    gradeName?: string | null;
    remarks?: string | null;
    sortOrder?: number;
  },
) {
  const existing = await prisma.gradingScaleGrade.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!existing) throw new AppError(404, "Grade not found", "GRADE_NOT_FOUND");

  const fromPercent = input.fromPercent ?? toNumber(existing.fromPercent);
  const toPercent = input.toPercent ?? toNumber(existing.toPercent);
  assertPercentRange(fromPercent, toPercent);
  await assertNoOverlap(tenantId, existing.scaleId, fromPercent, toPercent, id);

  const grade = await prisma.gradingScaleGrade.update({
    where: { id },
    data: {
      grade: input.grade?.trim().toUpperCase(),
      gradePoint: input.gradePoint,
      fromPercent: input.fromPercent,
      toPercent: input.toPercent,
      gradeName: input.gradeName === undefined ? undefined : input.gradeName?.trim() || null,
      remarks: input.remarks === undefined ? undefined : input.remarks?.trim() || null,
      sortOrder: input.sortOrder,
    },
  });
  return mapGrade(grade);
}

export async function deleteGradingScaleGrade(tenantId: string, id: string) {
  const result = await prisma.gradingScaleGrade.deleteMany({
    where: tenantScope(tenantId, { id }),
  });
  if (!result.count) throw new AppError(404, "Grade not found", "GRADE_NOT_FOUND");
  return { ok: true };
}

export async function assignGradingScaleToClasses(
  tenantId: string,
  input: { scaleId: string; classIds: string[] },
) {
  const scale = await prisma.gradingScale.findFirst({
    where: tenantScope(tenantId, { id: input.scaleId }),
    select: { id: true },
  });
  if (!scale) throw new AppError(404, "Grading scale not found", "SCALE_NOT_FOUND");

  const unique = [...new Set(input.classIds)];
  if (!unique.length) {
    throw new AppError(400, "Select at least one class", "CLASS_REQUIRED");
  }
  const count = await prisma.academicClass.count({
    where: tenantScope(tenantId, { id: { in: unique } }),
  });
  if (count !== unique.length) {
    throw new AppError(400, "One or more classes are invalid", "INVALID_CLASS");
  }

  await prisma.$transaction([
    prisma.gradingScaleClass.deleteMany({
      where: tenantScope(tenantId, { classId: { in: unique } }),
    }),
    prisma.gradingScaleClass.createMany({
      data: unique.map((classId) => ({
        tenantId,
        scaleId: input.scaleId,
        classId,
      })),
    }),
  ]);

  return getGradingScaleSetup(tenantId);
}
