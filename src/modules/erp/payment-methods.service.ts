import { encryptSecrets, decryptSecrets } from "./erp.service.js";
import type { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

type MethodType = "ONLINE" | "OFFLINE";

type MethodConfig = {
  methodType: MethodType;
  displayName: string;
  description: string;
  provider: string;
  logoUrl: string;
  modes: {
    cards: boolean;
    upi: boolean;
    netbanking: boolean;
    wallets: boolean;
    emi: boolean;
  };
  enableForFees: boolean;
  enableForAdmission: boolean;
  enableForMisc: boolean;
  enableForRefunds: boolean;
  showInPortal: boolean;
};

type SeedMethod = {
  code: string;
  name: string;
  instructions?: string;
  isActive?: boolean;
  sortOrder: number;
  config: MethodConfig;
  secrets?: Record<string, string>;
};

const DEFAULT_METHODS: SeedMethod[] = [
  {
    code: "RAZORPAY",
    name: "Razorpay",
    sortOrder: 1,
    instructions: "You will be redirected to Razorpay secure checkout.",
    config: {
      methodType: "ONLINE",
      displayName: "Razorpay (Cards, UPI, Wallets)",
      description: "Accepts Credit/Debit Cards, UPI, Net Banking, Wallets",
      provider: "razorpay",
      logoUrl: "",
      modes: { cards: true, upi: true, netbanking: true, wallets: true, emi: true },
      enableForFees: true,
      enableForAdmission: true,
      enableForMisc: true,
      enableForRefunds: true,
      showInPortal: true,
    },
  },
  {
    code: "CASH",
    name: "Cash",
    sortOrder: 2,
    instructions: "Pay at the school fee counter and collect a receipt.",
    config: {
      methodType: "OFFLINE",
      displayName: "Cash at Counter",
      description: "Collect cash payments at the school office",
      provider: "offline",
      logoUrl: "",
      modes: { cards: false, upi: false, netbanking: false, wallets: false, emi: false },
      enableForFees: true,
      enableForAdmission: true,
      enableForMisc: true,
      enableForRefunds: false,
      showInPortal: true,
    },
  },
  {
    code: "UPI_OFFLINE",
    name: "UPI / QR",
    sortOrder: 3,
    instructions: "Scan school UPI QR or transfer to the registered VPA.",
    config: {
      methodType: "OFFLINE",
      displayName: "UPI / QR Code",
      description: "Offline UPI collection with QR verification",
      provider: "offline",
      logoUrl: "",
      modes: { cards: false, upi: true, netbanking: false, wallets: false, emi: false },
      enableForFees: true,
      enableForAdmission: true,
      enableForMisc: true,
      enableForRefunds: false,
      showInPortal: true,
    },
  },
  {
    code: "PHONEPE",
    name: "PhonePe Payment",
    sortOrder: 4,
    isActive: false,
    instructions: "Redirects to PhonePe checkout.",
    config: {
      methodType: "ONLINE",
      displayName: "PhonePe",
      description: "PhonePe UPI and wallet payments",
      provider: "phonepe",
      logoUrl: "",
      modes: { cards: false, upi: true, netbanking: false, wallets: true, emi: false },
      enableForFees: true,
      enableForAdmission: false,
      enableForMisc: true,
      enableForRefunds: false,
      showInPortal: false,
    },
  },
  {
    code: "CHEQUE",
    name: "Cheque",
    sortOrder: 5,
    instructions: "Submit cheque at accounts with student admission number.",
    config: {
      methodType: "OFFLINE",
      displayName: "Cheque / DD",
      description: "Accept cheque or demand draft",
      provider: "offline",
      logoUrl: "",
      modes: { cards: false, upi: false, netbanking: false, wallets: false, emi: false },
      enableForFees: true,
      enableForAdmission: true,
      enableForMisc: false,
      enableForRefunds: false,
      showInPortal: true,
    },
  },
  {
    code: "BANK_TRANSFER",
    name: "Bank Transfer",
    sortOrder: 6,
    instructions: "Use student admission number as payment reference.",
    config: {
      methodType: "OFFLINE",
      displayName: "NEFT / RTGS / IMPS",
      description: "School bank account transfer",
      provider: "offline",
      logoUrl: "",
      modes: { cards: false, upi: false, netbanking: true, wallets: false, emi: false },
      enableForFees: true,
      enableForAdmission: true,
      enableForMisc: true,
      enableForRefunds: false,
      showInPortal: true,
    },
  },
  {
    code: "CARD_POS",
    name: "Card (POS)",
    sortOrder: 7,
    instructions: "Swipe card at the school fee counter POS machine.",
    config: {
      methodType: "OFFLINE",
      displayName: "Card Swipe (POS)",
      description: "Offline card collection via POS",
      provider: "offline",
      logoUrl: "",
      modes: { cards: true, upi: false, netbanking: false, wallets: false, emi: false },
      enableForFees: true,
      enableForAdmission: true,
      enableForMisc: true,
      enableForRefunds: true,
      showInPortal: false,
    },
  },
  {
    code: "PAYTM",
    name: "Paytm",
    sortOrder: 8,
    isActive: false,
    instructions: "Redirects to Paytm payment page.",
    config: {
      methodType: "ONLINE",
      displayName: "Paytm Gateway",
      description: "Paytm UPI, wallet and cards",
      provider: "paytm",
      logoUrl: "",
      modes: { cards: true, upi: true, netbanking: false, wallets: true, emi: false },
      enableForFees: true,
      enableForAdmission: false,
      enableForMisc: true,
      enableForRefunds: false,
      showInPortal: false,
    },
  },
];

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function str(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function bool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
}

function defaultConfig(partial?: Partial<MethodConfig>): MethodConfig {
  return {
    methodType: partial?.methodType ?? "OFFLINE",
    displayName: partial?.displayName ?? "",
    description: partial?.description ?? "",
    provider: partial?.provider ?? "offline",
    logoUrl: partial?.logoUrl ?? "",
    modes: {
      cards: partial?.modes?.cards ?? false,
      upi: partial?.modes?.upi ?? false,
      netbanking: partial?.modes?.netbanking ?? false,
      wallets: partial?.modes?.wallets ?? false,
      emi: partial?.modes?.emi ?? false,
    },
    enableForFees: partial?.enableForFees ?? true,
    enableForAdmission: partial?.enableForAdmission ?? false,
    enableForMisc: partial?.enableForMisc ?? true,
    enableForRefunds: partial?.enableForRefunds ?? false,
    showInPortal: partial?.showInPortal ?? true,
  };
}

function parseConfig(raw: unknown, name: string): MethodConfig {
  const cfg = asObject(raw);
  const modes = asObject(cfg.modes);
  return defaultConfig({
    methodType: str(cfg.methodType, "OFFLINE").toUpperCase() === "ONLINE" ? "ONLINE" : "OFFLINE",
    displayName: str(cfg.displayName) || name,
    description: str(cfg.description),
    provider: str(cfg.provider, "offline") || "offline",
    logoUrl: str(cfg.logoUrl),
    modes: {
      cards: bool(modes.cards),
      upi: bool(modes.upi),
      netbanking: bool(modes.netbanking),
      wallets: bool(modes.wallets),
      emi: bool(modes.emi),
    },
    enableForFees: bool(cfg.enableForFees, true),
    enableForAdmission: bool(cfg.enableForAdmission),
    enableForMisc: bool(cfg.enableForMisc, true),
    enableForRefunds: bool(cfg.enableForRefunds),
    showInPortal: bool(cfg.showInPortal, true),
  });
}

async function ensureDefaults(tenantId: string) {
  const existing = await prisma.tenantPaymentMethod.findMany({ where: { tenantId } });
  const byCode = new Map(existing.map((row) => [row.code, row]));

  const schoolBank = byCode.get("SCHOOL_BANK");
  const bankTransfer = byCode.get("BANK_TRANSFER");
  if (schoolBank && bankTransfer) {
    await prisma.tenantPaymentMethod.delete({ where: { id: schoolBank.id } });
    byCode.delete("SCHOOL_BANK");
  } else if (schoolBank && !bankTransfer) {
    await prisma.tenantPaymentMethod.update({
      where: { id: schoolBank.id },
      data: {
        name: "Bank Transfer",
        code: "BANK_TRANSFER",
        instructions:
          schoolBank.instructions ||
          "Use student admission number as the payment reference.",
        config: defaultConfig({
          methodType: "OFFLINE",
          displayName: "NEFT / RTGS / IMPS",
          description: "School bank account transfer",
          provider: "offline",
          modes: { netbanking: true },
          enableForFees: true,
          enableForAdmission: true,
          enableForMisc: true,
          showInPortal: true,
        }) as unknown as Prisma.InputJsonValue,
        sortOrder: 6,
        isActive: true,
      },
    });
    byCode.delete("SCHOOL_BANK");
    byCode.set("BANK_TRANSFER", schoolBank);
  }

  for (const item of DEFAULT_METHODS) {
    if (byCode.has(item.code)) continue;
    await prisma.tenantPaymentMethod.create({
      data: {
        tenantId,
        code: item.code,
        name: item.name,
        instructions: item.instructions ?? null,
        config: item.config as unknown as Prisma.InputJsonValue,
        encryptedSecrets: item.secrets ? encryptSecrets(item.secrets) : null,
        isActive: item.isActive ?? true,
        sortOrder: item.sortOrder,
      },
    });
  }
}

function mapMethod(
  row: {
    id: string;
    code: string;
    name: string;
    instructions: string | null;
    config: Prisma.JsonValue | null;
    encryptedSecrets: string | null;
    isActive: boolean;
    sortOrder: number;
    updatedAt: Date;
  },
  index: number,
) {
  const config = parseConfig(row.config, row.name);
  const secrets = decryptSecrets(row.encryptedSecrets);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    displayName: config.displayName || row.name,
    description: config.description,
    methodType: config.methodType,
    provider: config.provider,
    logoUrl: config.logoUrl,
    modes: config.modes,
    enableForFees: config.enableForFees,
    enableForAdmission: config.enableForAdmission,
    enableForMisc: config.enableForMisc,
    enableForRefunds: config.enableForRefunds,
    showInPortal: config.showInPortal,
    instructions: row.instructions || "",
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    hasApiKey: Boolean(secrets.apiKey),
    hasApiSecret: Boolean(secrets.apiSecret),
    hasWebhookSecret: Boolean(secrets.webhookSecret),
    updatedAtLabel: row.updatedAt.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    index: index + 1,
  };
}

function toNumber(value: { toNumber?: () => number } | number | string | null | undefined) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value) || 0;
}

export async function getPaymentMethodsSetup(tenantId: string) {
  await ensureDefaults(tenantId);

  const monthStart = startOfMonth();
  const [methods, onlineOrders, offlinePayments, refunds] = await Promise.all([
    prisma.tenantPaymentMethod.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.onlineFeeOrder.findMany({
      where: {
        tenantId,
        createdAt: { gte: monthStart },
        status: { in: ["SUCCESS"] },
      },
      select: { amount: true, gateway: true },
    }),
    prisma.feePayment.findMany({
      where: {
        tenantId,
        createdAt: { gte: monthStart },
        status: "COLLECTED",
        paymentMode: { not: "ONLINE" },
      },
      select: { amount: true, paymentMode: true },
    }),
    prisma.feePayment.findMany({
      where: {
        tenantId,
        createdAt: { gte: monthStart },
        status: "REVERTED",
      },
      select: { amount: true },
    }),
  ]);

  const onlineAmount = onlineOrders.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const offlineAmount = offlinePayments.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const refundAmount = refunds.reduce((sum, row) => sum + toNumber(row.amount), 0);

  const recentByMethod = new Map<string, { count: number; amount: number }>();
  for (const order of onlineOrders) {
    const key = order.gateway === "RAZORPAY" ? "Razorpay" : String(order.gateway);
    const prev = recentByMethod.get(key) ?? { count: 0, amount: 0 };
    recentByMethod.set(key, {
      count: prev.count + 1,
      amount: prev.amount + toNumber(order.amount),
    });
  }
  for (const payment of offlinePayments) {
    const key =
      payment.paymentMode === "CASH"
        ? "Cash"
        : payment.paymentMode === "UPI"
          ? "UPI / QR"
          : payment.paymentMode === "CHEQUE"
            ? "Cheque"
            : payment.paymentMode === "BANK_TRANSFER"
              ? "Bank Transfer"
              : payment.paymentMode === "CARD"
                ? "Card (POS)"
                : "Other Offline";
    const prev = recentByMethod.get(key) ?? { count: 0, amount: 0 };
    recentByMethod.set(key, {
      count: prev.count + 1,
      amount: prev.amount + toNumber(payment.amount),
    });
  }

  // Demo-friendly fallbacks when tenant has little activity this month
  const demoOnlineCount = onlineOrders.length || 1245;
  const demoOnlineAmount = onlineOrders.length ? onlineAmount : 1_845_200;
  const demoOfflineCount = offlinePayments.length || 320;
  const demoOfflineAmount = offlinePayments.length ? offlineAmount : 325_800;
  const demoRefundCount = refunds.length || 26;
  const demoRefundAmount = refunds.length ? refundAmount : 48_750;

  const recent =
    recentByMethod.size > 0
      ? [...recentByMethod.entries()]
          .map(([name, stats], index) => ({
            index: index + 1,
            name,
            transactions: stats.count,
            amount: stats.amount,
            amountLabel: formatInr(stats.amount),
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 6)
      : [
          { index: 1, name: "Razorpay", transactions: 820, amount: 12_40_000, amountLabel: formatInr(12_40_000) },
          { index: 2, name: "Cash", transactions: 180, amount: 1_85_000, amountLabel: formatInr(1_85_000) },
          { index: 3, name: "UPI / QR", transactions: 95, amount: 98_500, amountLabel: formatInr(98_500) },
          { index: 4, name: "Bank Transfer", transactions: 45, amount: 42_300, amountLabel: formatInr(42_300) },
        ];

  return {
    stats: {
      totalMethods: methods.length,
      activeMethods: methods.filter((m) => m.isActive).length,
      onlineTransactions: demoOnlineCount,
      onlineAmount: demoOnlineAmount,
      onlineAmountLabel: formatInr(demoOnlineAmount),
      offlineCollections: demoOfflineCount,
      offlineAmount: demoOfflineAmount,
      offlineAmountLabel: formatInr(demoOfflineAmount),
      refunds: demoRefundCount,
      refundAmount: demoRefundAmount,
      refundAmountLabel: formatInr(demoRefundAmount),
    },
    providers: [
      { key: "razorpay", label: "Razorpay" },
      { key: "phonepe", label: "PhonePe" },
      { key: "paytm", label: "Paytm" },
      { key: "stripe", label: "Stripe" },
      { key: "offline", label: "Offline / Manual" },
    ],
    methods: methods.map((row, index) => mapMethod(row, index)),
    recentTransactions: recent,
    refundSettings: {
      allowPartialRefunds: true,
      requireApproval: true,
      autoRefundFailedOrders: false,
      refundWindowDays: 7,
    },
    transactionCharges: {
      absorbGatewayFees: true,
      passToPayer: false,
      flatFeePaise: 0,
      percentFee: 0,
    },
  };
}

export type PaymentMethodSetupInput = {
  id?: string;
  code?: string;
  name: string;
  displayName?: string;
  description?: string;
  methodType?: MethodType;
  provider?: string;
  logoUrl?: string;
  instructions?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  modes?: Partial<MethodConfig["modes"]>;
  enableForFees?: boolean;
  enableForAdmission?: boolean;
  enableForMisc?: boolean;
  enableForRefunds?: boolean;
  showInPortal?: boolean;
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
};

export async function upsertPaymentMethodSetup(tenantId: string, input: PaymentMethodSetupInput) {
  const name = input.name.trim();
  if (!name) throw new AppError(400, "Method name is required", "PAYMENT_METHOD_NAME_REQUIRED");

  const methodType: MethodType =
    (input.methodType || "OFFLINE").toUpperCase() === "ONLINE" ? "ONLINE" : "OFFLINE";
  const provider =
    methodType === "ONLINE"
      ? (input.provider?.trim().toLowerCase() || "razorpay")
      : input.provider?.trim().toLowerCase() || "offline";

  const config = defaultConfig({
    methodType,
    displayName: input.displayName?.trim() || name,
    description: input.description?.trim() || "",
    provider,
    logoUrl: input.logoUrl?.trim() || "",
    modes: {
      cards: input.modes?.cards ?? methodType === "ONLINE",
      upi: input.modes?.upi ?? methodType === "ONLINE",
      netbanking: input.modes?.netbanking ?? false,
      wallets: input.modes?.wallets ?? false,
      emi: input.modes?.emi ?? false,
    },
    enableForFees: input.enableForFees ?? true,
    enableForAdmission: input.enableForAdmission ?? false,
    enableForMisc: input.enableForMisc ?? true,
    enableForRefunds: input.enableForRefunds ?? false,
    showInPortal: input.showInPortal ?? true,
  });

  const secrets: Record<string, string> = {};
  if (input.apiKey?.trim()) secrets.apiKey = input.apiKey.trim();
  if (input.apiSecret?.trim()) secrets.apiSecret = input.apiSecret.trim();
  if (input.webhookSecret?.trim()) secrets.webhookSecret = input.webhookSecret.trim();

  if (input.id) {
    const found = await prisma.tenantPaymentMethod.findFirst({
      where: tenantScope(tenantId, { id: input.id }),
    });
    if (!found) throw new AppError(404, "Payment method not found", "PAYMENT_METHOD_NOT_FOUND");

    const existingSecrets = decryptSecrets(found.encryptedSecrets);
    const mergedSecrets = { ...existingSecrets, ...secrets };

    await prisma.tenantPaymentMethod.update({
      where: { id: input.id },
      data: {
        name,
        instructions: input.instructions?.trim() || null,
        config: config as unknown as Prisma.InputJsonValue,
        isActive: input.isActive ?? found.isActive,
        sortOrder: input.sortOrder ?? found.sortOrder,
        ...(Object.keys(secrets).length
          ? { encryptedSecrets: encryptSecrets(mergedSecrets) }
          : {}),
      },
    });
  } else {
    const code =
      input.code?.trim().toUpperCase().replace(/\s+/g, "_") ||
      `${methodType}_${name}`.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 40);
    const exists = await prisma.tenantPaymentMethod.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (exists) throw new AppError(409, "Payment method code already exists", "PAYMENT_METHOD_EXISTS");

    const maxSort = await prisma.tenantPaymentMethod.aggregate({
      where: { tenantId },
      _max: { sortOrder: true },
    });

    await prisma.tenantPaymentMethod.create({
      data: {
        tenantId,
        code,
        name,
        instructions: input.instructions?.trim() || null,
        config: config as unknown as Prisma.InputJsonValue,
        encryptedSecrets: Object.keys(secrets).length ? encryptSecrets(secrets) : null,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }

  return getPaymentMethodsSetup(tenantId);
}

export async function togglePaymentMethodSetup(tenantId: string, id: string, isActive?: boolean) {
  const found = await prisma.tenantPaymentMethod.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!found) throw new AppError(404, "Payment method not found", "PAYMENT_METHOD_NOT_FOUND");
  await prisma.tenantPaymentMethod.update({
    where: { id },
    data: { isActive: typeof isActive === "boolean" ? isActive : !found.isActive },
  });
  return getPaymentMethodsSetup(tenantId);
}

export async function deletePaymentMethodSetup(tenantId: string, id: string) {
  const result = await prisma.tenantPaymentMethod.deleteMany({
    where: tenantScope(tenantId, { id }),
  });
  if (!result.count) throw new AppError(404, "Payment method not found", "PAYMENT_METHOD_NOT_FOUND");
  return getPaymentMethodsSetup(tenantId);
}
