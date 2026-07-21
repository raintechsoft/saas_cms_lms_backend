import type { ProductMode, TenantType } from "@prisma/client";

export interface AuthContext {
  userId: string;
  tenantId: string | null;
  resellerId: string | null;
  tenantType: TenantType | null;
  productMode: ProductMode | null;
  roles: string[];
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export {};
