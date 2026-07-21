import { AppError } from "./errors.js";

export function tenantScope<T extends object>(
  tenantId: string | null | undefined,
  where: T,
): T & { tenantId: string } {
  if (!tenantId) {
    throw new AppError(403, "Tenant context is required", "TENANT_REQUIRED");
  }

  return { ...where, tenantId };
}
