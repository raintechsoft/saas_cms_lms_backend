import {
  DiscountType,
  EnrollmentStatus,
  FeeAssignmentStatus,
  FeeFineType,
  PaymentMode,
  PaymentStatus,
  Prisma,
  StudentStatus,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

export type FeeReportKey =
  | "due_fees"
  | "fee_collection"
  | "fee_master"
  | "fee_assigned"
  | "fee_summary"
  | "day_book"
  | "till_date_due"
  | "balance_fee"
  | "parents_wise_due"
  | "students_wise_fee"
  | "fine_report"
  | "discount_report"
  | "online_fee"
  | "daily_fees_collection";

export const FEE_REPORTS: Array<{
  key: FeeReportKey;
  label: string;
  description: string;
}> = [
  { key: "due_fees", label: "Due Fees Report", description: "Students with outstanding fee balances" },
  { key: "fee_collection", label: "Fee Collection Report", description: "Collected fee payments in the selected date range" },
  { key: "fee_master", label: "Fee Master Report", description: "Fee master entries for the selected session" },
  { key: "fee_assigned", label: "Fee Assigned Report", description: "Fees assigned to students with paid/due status" },
  { key: "fee_summary", label: "Fee Summary Report", description: "Session totals for assigned, discount, fine, collected and due" },
  { key: "day_book", label: "Day Book Report", description: "Day-wise fee collection ledger" },
  { key: "till_date_due", label: "Till Date Due Report", description: "Outstanding dues calculated as of a selected date" },
  { key: "balance_fee", label: "Balance Fee Report", description: "Fee-head wise outstanding balances" },
  { key: "parents_wise_due", label: "Parents wise Due Report", description: "Outstanding dues grouped by parent/guardian contact" },
  { key: "students_wise_fee", label: "Students wise Fee Report", description: "Student-wise assigned, paid, discount, fine and balance" },
  { key: "fine_report", label: "Fine Report", description: "Fine amounts applied on fee assignments" },
  { key: "discount_report", label: "Discount Report", description: "Discounts applied on student fee assignments" },
  { key: "online_fee", label: "Online Fee Report", description: "Payments collected with ONLINE payment mode" },
  { key: "daily_fees_collection", label: "Daily Fees Collection", description: "Fee collections for a selected day (or day range)" },
];

function money(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value ?? 0);
}

function nameOf(firstName: string, lastName: string | null | undefined) {
  return `${firstName} ${lastName ?? ""}`.trim();
}

function calculateDiscount(
  type: DiscountType | undefined,
  value: Prisma.Decimal | undefined,
  base: number,
) {
  if (!type || !value) return 0;
  const discount =
    type === DiscountType.PERCENTAGE ? (base * money(value)) / 100 : money(value);
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
  if (fineType === FeeFineType.PERCENTAGE) return (base * money(fineValue)) / 100;
  if (fineType === FeeFineType.PER_DAY) {
    const days = Math.max(
      1,
      Math.ceil((asOf.getTime() - effectiveDue.getTime()) / 86_400_000),
    );
    return days * money(fineValue);
  }
  if (fineType === FeeFineType.DATE_RANGE) {
    const range = ranges.find(
      (item) => asOf >= item.startDate && (!item.endDate || asOf <= item.endDate),
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

async function resolveSession(tenantId: string, sessionId?: string) {
  const session = sessionId
    ? await prisma.academicSession.findFirst({
        where: tenantScope(tenantId, { id: sessionId }),
        select: { id: true, name: true },
      })
    : await prisma.academicSession.findFirst({
        where: tenantScope(tenantId, { isCurrent: true }),
        select: { id: true, name: true },
      });
  if (!session) throw new AppError(400, "Academic session is required", "SESSION_REQUIRED");
  return session;
}

type AssignmentDueRow = {
  assignmentId: string;
  studentId: string;
  admissionNumber: string;
  studentName: string;
  parentContact: string;
  classSection: string;
  feeType: string;
  feeGroup: string;
  dueDate: string;
  base: number;
  discount: number;
  fine: number;
  paid: number;
  balance: number;
  discountName: string | null;
};

async function loadAssignmentDues(
  tenantId: string,
  sessionId: string,
  asOf: Date,
  classSectionId?: string,
): Promise<AssignmentDueRow[]> {
  const assignments = await prisma.studentFeeAssignment.findMany({
    where: tenantScope(tenantId, {
      status: FeeAssignmentStatus.ACTIVE,
      studentEnrollment: {
        academicSessionId: sessionId,
        status: EnrollmentStatus.ACTIVE,
        ...(classSectionId ? { classSectionId } : {}),
        student: { status: StudentStatus.ACTIVE },
      },
    }),
    include: {
      feeMaster: {
        include: {
          feeType: true,
          feeGroup: true,
          fineRanges: { orderBy: { startDate: "asc" } },
        },
      },
      discount: true,
      paymentItems: {
        where: { payment: { status: PaymentStatus.COLLECTED } },
        include: { payment: true },
      },
      studentEnrollment: {
        include: {
          student: true,
          classSection: { include: { academicClass: true, section: true } },
        },
      },
    },
  });

  return assignments.map((assignment) => {
    const base =
      money(assignment.customAmount ?? assignment.feeMaster.amount) +
      money(assignment.carryForwardAmount);
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
    const student = assignment.studentEnrollment.student;
    const parentContact =
      student.guardianPhone?.trim() ||
      student.fatherPhone?.trim() ||
      student.motherPhone?.trim() ||
      "—";
    return {
      assignmentId: assignment.id,
      studentId: student.id,
      admissionNumber: student.admissionNumber,
      studentName: nameOf(student.firstName, student.lastName),
      parentContact,
      classSection: `${assignment.studentEnrollment.classSection.academicClass.name} · ${assignment.studentEnrollment.classSection.section.name}`,
      feeType: assignment.feeMaster.feeType.name,
      feeGroup: assignment.feeMaster.feeGroup.name,
      dueDate: assignment.feeMaster.dueDate.toISOString().slice(0, 10),
      base: Number(base.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      fine: Number(fine.toFixed(2)),
      paid: Number(paid.toFixed(2)),
      balance: Number(balance.toFixed(2)),
      discountName: assignment.discount?.name ?? null,
    };
  });
}

export async function runFeeReport(
  tenantId: string,
  reportKey: FeeReportKey,
  query: {
    sessionId?: string;
    from?: Date;
    to?: Date;
    classSectionId?: string;
  },
) {
  if (query.from && query.to && query.to < query.from) {
    throw new AppError(400, "Invalid report date range", "INVALID_DATE_RANGE");
  }

  const session = await resolveSession(tenantId, query.sessionId);
  const asOf = query.to ?? new Date();

  if (reportKey === "due_fees" || reportKey === "till_date_due") {
    const dues = (await loadAssignmentDues(tenantId, session.id, asOf, query.classSectionId)).filter(
      (row) => row.balance >= 0.01,
    );
    const byStudent = new Map<
      string,
      {
        studentId: string;
        admissionNumber: string;
        name: string;
        classSection: string;
        balance: number;
        dueHeads: number;
      }
    >();
    for (const row of dues) {
      const existing = byStudent.get(row.studentId);
      if (existing) {
        existing.balance += row.balance;
        existing.dueHeads += 1;
      } else {
        byStudent.set(row.studentId, {
          studentId: row.studentId,
          admissionNumber: row.admissionNumber,
          name: row.studentName,
          classSection: row.classSection,
          balance: row.balance,
          dueHeads: 1,
        });
      }
    }
    const rows = [...byStudent.values()]
      .map((row) => ({ ...row, balance: Number(row.balance.toFixed(2)) }))
      .sort((a, b) => b.balance - a.balance);
    const totalDue = rows.reduce((sum, row) => sum + row.balance, 0);
    return {
      reportKey,
      title: reportKey === "till_date_due" ? "Till Date Due Report" : "Due Fees Report",
      session,
      summary: {
        students: rows.length,
        totalDue: Number(totalDue.toFixed(2)),
        asOf: asOf.toISOString().slice(0, 10),
      },
      rows,
    };
  }

  if (reportKey === "balance_fee") {
    const rows = (await loadAssignmentDues(tenantId, session.id, asOf, query.classSectionId))
      .filter((row) => row.balance >= 0.01)
      .map((row) => ({
        admissionNumber: row.admissionNumber,
        studentName: row.studentName,
        classSection: row.classSection,
        feeGroup: row.feeGroup,
        feeType: row.feeType,
        dueDate: row.dueDate,
        balance: row.balance,
      }))
      .sort((a, b) => b.balance - a.balance);
    return {
      reportKey,
      title: "Balance Fee Report",
      session,
      summary: {
        rows: rows.length,
        totalDue: Number(rows.reduce((sum, row) => sum + row.balance, 0).toFixed(2)),
      },
      rows,
    };
  }

  if (reportKey === "parents_wise_due") {
    const dues = (await loadAssignmentDues(tenantId, session.id, asOf, query.classSectionId)).filter(
      (row) => row.balance >= 0.01,
    );
    const byParent = new Map<
      string,
      { parentContact: string; students: number; dueHeads: number; balance: number }
    >();
    const studentSeen = new Map<string, Set<string>>();
    for (const row of dues) {
      const key = row.parentContact || "—";
      const existing = byParent.get(key) ?? {
        parentContact: key,
        students: 0,
        dueHeads: 0,
        balance: 0,
      };
      existing.dueHeads += 1;
      existing.balance += row.balance;
      const seen = studentSeen.get(key) ?? new Set<string>();
      if (!seen.has(row.studentId)) {
        seen.add(row.studentId);
        existing.students += 1;
        studentSeen.set(key, seen);
      }
      byParent.set(key, existing);
    }
    const rows = [...byParent.values()]
      .map((row) => ({ ...row, balance: Number(row.balance.toFixed(2)) }))
      .sort((a, b) => b.balance - a.balance);
    return {
      reportKey,
      title: "Parents wise Due Report",
      session,
      summary: {
        parents: rows.length,
        totalDue: Number(rows.reduce((s, r) => s + r.balance, 0).toFixed(2)),
      },
      rows,
    };
  }

  if (reportKey === "students_wise_fee") {
    const dues = await loadAssignmentDues(tenantId, session.id, asOf, query.classSectionId);
    const byStudent = new Map<
      string,
      {
        admissionNumber: string;
        studentName: string;
        classSection: string;
        assigned: number;
        discount: number;
        fine: number;
        paid: number;
        balance: number;
        feeHeads: number;
      }
    >();
    for (const row of dues) {
      const existing = byStudent.get(row.studentId) ?? {
        admissionNumber: row.admissionNumber,
        studentName: row.studentName,
        classSection: row.classSection,
        assigned: 0,
        discount: 0,
        fine: 0,
        paid: 0,
        balance: 0,
        feeHeads: 0,
      };
      existing.assigned += row.base;
      existing.discount += row.discount;
      existing.fine += row.fine;
      existing.paid += row.paid;
      existing.balance += row.balance;
      existing.feeHeads += 1;
      byStudent.set(row.studentId, existing);
    }
    const rows = [...byStudent.values()]
      .map((row) => ({
        admissionNumber: row.admissionNumber,
        studentName: row.studentName,
        classSection: row.classSection,
        feeHeads: row.feeHeads,
        assigned: Number(row.assigned.toFixed(2)),
        discount: Number(row.discount.toFixed(2)),
        fine: Number(row.fine.toFixed(2)),
        paid: Number(row.paid.toFixed(2)),
        balance: Number(row.balance.toFixed(2)),
      }))
      .sort((a, b) => a.studentName.localeCompare(b.studentName));
    return {
      reportKey,
      title: "Students wise Fee Report",
      session,
      summary: {
        students: rows.length,
        assigned: Number(rows.reduce((s, r) => s + r.assigned, 0).toFixed(2)),
        paid: Number(rows.reduce((s, r) => s + r.paid, 0).toFixed(2)),
        balance: Number(rows.reduce((s, r) => s + r.balance, 0).toFixed(2)),
      },
      rows,
    };
  }

  if (reportKey === "fee_summary") {
    const dues = await loadAssignmentDues(tenantId, session.id, asOf, query.classSectionId);
    const summary = dues.reduce(
      (acc, row) => ({
        assigned: acc.assigned + row.base,
        discounts: acc.discounts + row.discount,
        fines: acc.fines + row.fine,
        collected: acc.collected + row.paid,
        due: acc.due + row.balance,
      }),
      { assigned: 0, discounts: 0, fines: 0, collected: 0, due: 0 },
    );
    return {
      reportKey,
      title: "Fee Summary Report",
      session,
      summary: {
        assignments: dues.length,
        assigned: Number(summary.assigned.toFixed(2)),
        discounts: Number(summary.discounts.toFixed(2)),
        fines: Number(summary.fines.toFixed(2)),
        collected: Number(summary.collected.toFixed(2)),
        due: Number(summary.due.toFixed(2)),
      },
      rows: [
        { metric: "Assigned", amount: Number(summary.assigned.toFixed(2)) },
        { metric: "Discounts", amount: Number(summary.discounts.toFixed(2)) },
        { metric: "Fines", amount: Number(summary.fines.toFixed(2)) },
        { metric: "Collected", amount: Number(summary.collected.toFixed(2)) },
        { metric: "Due", amount: Number(summary.due.toFixed(2)) },
      ],
    };
  }

  if (reportKey === "fee_master") {
    const masters = await prisma.feeMaster.findMany({
      where: tenantScope(tenantId, {
        academicSessionId: session.id,
        ...(query.classSectionId ? { classSectionId: query.classSectionId } : {}),
      }),
      include: {
        feeType: true,
        feeGroup: true,
        classSection: { include: { academicClass: true, section: true } },
        _count: { select: { assignments: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }],
    });
    return {
      reportKey,
      title: "Fee Master Report",
      session,
      summary: { masters: masters.length },
      rows: masters.map((master) => ({
        id: master.id,
        feeGroup: master.feeGroup.name,
        feeType: master.feeType.name,
        feeCode: master.feeType.code,
        classSection: master.classSection
          ? `${master.classSection.academicClass.name} · ${master.classSection.section.name}`
          : "All",
        amount: Number(money(master.amount).toFixed(2)),
        dueDate: master.dueDate.toISOString().slice(0, 10),
        fineType: master.fineType,
        assignments: master._count.assignments,
        isCustom: master.isCustom,
      })),
    };
  }

  if (reportKey === "fee_assigned") {
    const rows = await loadAssignmentDues(tenantId, session.id, asOf, query.classSectionId);
    return {
      reportKey,
      title: "Fee Assigned Report",
      session,
      summary: {
        assignments: rows.length,
        due: Number(rows.reduce((s, r) => s + r.balance, 0).toFixed(2)),
      },
      rows: rows.map((row) => ({
        admissionNumber: row.admissionNumber,
        studentName: row.studentName,
        classSection: row.classSection,
        feeGroup: row.feeGroup,
        feeType: row.feeType,
        dueDate: row.dueDate,
        assigned: row.base,
        discount: row.discount,
        fine: row.fine,
        paid: row.paid,
        balance: row.balance,
        status: row.balance < 0.01 ? "PAID" : row.paid > 0 ? "PARTIAL" : "DUE",
      })),
    };
  }

  if (reportKey === "fine_report") {
    const rows = (await loadAssignmentDues(tenantId, session.id, asOf, query.classSectionId))
      .filter((row) => row.fine >= 0.01)
      .map((row) => ({
        admissionNumber: row.admissionNumber,
        studentName: row.studentName,
        classSection: row.classSection,
        feeType: row.feeType,
        dueDate: row.dueDate,
        fine: row.fine,
        balance: row.balance,
      }))
      .sort((a, b) => b.fine - a.fine);
    return {
      reportKey,
      title: "Fine Report",
      session,
      summary: {
        rows: rows.length,
        totalFine: Number(rows.reduce((s, r) => s + r.fine, 0).toFixed(2)),
      },
      rows,
    };
  }

  if (reportKey === "discount_report") {
    const rows = (await loadAssignmentDues(tenantId, session.id, asOf, query.classSectionId))
      .filter((row) => row.discount >= 0.01)
      .map((row) => ({
        admissionNumber: row.admissionNumber,
        studentName: row.studentName,
        classSection: row.classSection,
        feeType: row.feeType,
        discountName: row.discountName ?? "—",
        discount: row.discount,
        assigned: row.base,
        balance: row.balance,
      }))
      .sort((a, b) => b.discount - a.discount);
    return {
      reportKey,
      title: "Discount Report",
      session,
      summary: {
        rows: rows.length,
        totalDiscount: Number(rows.reduce((s, r) => s + r.discount, 0).toFixed(2)),
      },
      rows,
    };
  }

  const dateFilter =
    reportKey === "daily_fees_collection"
      ? {
          paymentDate: {
            gte: (() => {
              const d = new Date(query.from ?? query.to ?? new Date());
              d.setHours(0, 0, 0, 0);
              return d;
            })(),
            lte: (() => {
              const d = new Date(query.to ?? query.from ?? new Date());
              d.setHours(23, 59, 59, 999);
              return d;
            })(),
          },
        }
      : query.from || query.to
        ? {
            paymentDate: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {};

  if (
    reportKey === "fee_collection" ||
    reportKey === "day_book" ||
    reportKey === "online_fee" ||
    reportKey === "daily_fees_collection"
  ) {
    const payments = await prisma.feePayment.findMany({
      where: tenantScope(tenantId, {
        academicSessionId: session.id,
        status: PaymentStatus.COLLECTED,
        ...(reportKey === "online_fee" ? { paymentMode: PaymentMode.ONLINE } : {}),
        ...dateFilter,
      }),
      include: {
        student: true,
        items: {
          include: {
            assignment: { include: { feeMaster: { include: { feeType: true } } } },
          },
        },
      },
      orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
    });

    const collected = payments.reduce((sum, payment) => sum + money(payment.amount), 0);
    const byMode = payments.reduce<Record<string, number>>((acc, payment) => {
      acc[payment.paymentMode] = (acc[payment.paymentMode] ?? 0) + money(payment.amount);
      return acc;
    }, {});

    if (reportKey === "day_book") {
      let running = 0;
      const rows = payments.map((payment) => {
        const amount = money(payment.amount);
        running += amount;
        return {
          id: payment.id,
          date: payment.paymentDate.toISOString().slice(0, 10),
          receiptNumber: payment.receiptNumber,
          paymentId: payment.paymentId,
          studentName: nameOf(payment.student.firstName, payment.student.lastName),
          admissionNumber: payment.student.admissionNumber,
          paymentMode: payment.paymentMode,
          credit: Number(amount.toFixed(2)),
          runningBalance: Number(running.toFixed(2)),
          feeTypes: payment.items
            .map((item) => item.assignment.feeMaster.feeType.name)
            .join(", "),
        };
      });
      return {
        reportKey,
        title: "Day Book Report",
        session,
        summary: { entries: rows.length, collected: Number(collected.toFixed(2)), byMode },
        rows,
      };
    }

    const title =
      reportKey === "online_fee"
        ? "Online Fee Report"
        : reportKey === "daily_fees_collection"
          ? "Daily Fees Collection"
          : "Fee Collection Report";

    return {
      reportKey,
      title,
      session,
      summary: {
        payments: payments.length,
        collected: Number(collected.toFixed(2)),
        byMode,
      },
      rows: payments.map((payment) => ({
        id: payment.id,
        receiptNumber: payment.receiptNumber,
        paymentId: payment.paymentId,
        paymentDate: payment.paymentDate.toISOString().slice(0, 10),
        amount: Number(money(payment.amount).toFixed(2)),
        paymentMode: payment.paymentMode,
        studentName: nameOf(payment.student.firstName, payment.student.lastName),
        admissionNumber: payment.student.admissionNumber,
        feeTypes: payment.items
          .map((item) => item.assignment.feeMaster.feeType.name)
          .join(", "),
      })),
    };
  }

  throw new AppError(404, "Fee report not found", "FEE_REPORT_NOT_FOUND");
}
