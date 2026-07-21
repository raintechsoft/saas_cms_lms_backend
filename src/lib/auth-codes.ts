import { createHash, randomBytes, randomInt } from "node:crypto";
import { AuthVerificationPurpose } from "@prisma/client";
import { prisma } from "./prisma.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

export function hashAuthCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function generateOtpCode() {
  return String(randomInt(100_000, 1_000_000));
}

export function generateResetToken() {
  return randomBytes(32).toString("hex");
}

export async function createAuthVerification(input: {
  userId: string;
  purpose: AuthVerificationPurpose;
  code: string;
  ttlMs: number;
}) {
  await prisma.authVerification.updateMany({
    where: {
      userId: input.userId,
      purpose: input.purpose,
      consumedAt: null,
    },
    data: { consumedAt: new Date() },
  });

  return prisma.authVerification.create({
    data: {
      userId: input.userId,
      purpose: input.purpose,
      codeHash: hashAuthCode(input.code),
      expiresAt: new Date(Date.now() + input.ttlMs),
    },
  });
}

export async function consumeAuthVerification(input: {
  userId: string;
  purpose: AuthVerificationPurpose;
  code: string;
}) {
  const record = await prisma.authVerification.findFirst({
    where: {
      userId: input.userId,
      purpose: input.purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record || record.codeHash !== hashAuthCode(input.code)) {
    return null;
  }

  await prisma.authVerification.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
  return record;
}

export const AUTH_CODE_TTL = {
  OTP: OTP_TTL_MS,
  RESET: RESET_TTL_MS,
};
