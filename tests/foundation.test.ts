import { describe, expect, it } from "vitest";
import { ProductMode, TenantType } from "@prisma/client";
import { tenantScope } from "../src/lib/tenant-scope.js";
import {
  hasEntitlement,
  normalizeProductMode,
} from "../src/modules/tenants/tenant.service.js";

describe("tenant isolation", () => {
  it("always overrides caller-supplied tenant ids", () => {
    expect(tenantScope("tenant-a", { tenantId: "tenant-b", isCurrent: true })).toEqual({
      tenantId: "tenant-a",
      isCurrent: true,
    });
  });

  it("rejects unscoped access", () => {
    expect(() => tenantScope(null, {})).toThrow("Tenant context is required");
  });
});

describe("product entitlements", () => {
  it("forces individual tenants to LMS", () => {
    expect(normalizeProductMode(TenantType.INDIVIDUAL, ProductMode.BOTH)).toBe(ProductMode.LMS);
  });

  it("allows both modules only in BOTH mode", () => {
    expect(hasEntitlement(ProductMode.BOTH, "CMS")).toBe(true);
    expect(hasEntitlement(ProductMode.BOTH, "LMS")).toBe(true);
    expect(hasEntitlement(ProductMode.CMS, "LMS")).toBe(false);
    expect(hasEntitlement(ProductMode.LMS, "CMS")).toBe(false);
    expect(hasEntitlement(ProductMode.CMS, "CMS")).toBe(true);
    expect(hasEntitlement(ProductMode.LMS, "LMS")).toBe(true);
  });
});
