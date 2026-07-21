import { ProductMode, TenantType, type Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

export type ModuleEntitlement = "CMS" | "LMS";

export function normalizeProductMode(type: TenantType, requested: ProductMode): ProductMode {
  return type === TenantType.INDIVIDUAL ? ProductMode.LMS : requested;
}

export function hasEntitlement(
  productMode: ProductMode | null,
  module: ModuleEntitlement,
): boolean {
  if (!productMode) return false;
  return productMode === ProductMode.BOTH || productMode === module;
}

export async function createTenant(data: Prisma.TenantCreateInput) {
  const productMode = normalizeProductMode(data.type, data.productMode);
  return prisma.tenant.create({ data: { ...data, productMode } });
}

export function assertEntitlement(
  productMode: ProductMode | null,
  module: ModuleEntitlement,
): void {
  if (!hasEntitlement(productMode, module)) {
    throw new AppError(403, `${module} is not enabled for this tenant`, "MODULE_NOT_ENTITLED");
  }
}
