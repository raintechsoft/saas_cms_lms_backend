import type { AuthContext } from "../types/express.js";

interface CacheEntry {
  auth: AuthContext;
  expiresAt: number;
  userId: string;
}

const DEFAULT_TTL_MS = 60_000;
const MAX_ENTRIES = 5_000;

const store = new Map<string, CacheEntry>();

function ttlMs(): number {
  const raw = Number(process.env.AUTH_CACHE_TTL_MS ?? "60000");
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_TTL_MS;
  return raw;
}

function isEnabled(): boolean {
  if (process.env.NODE_ENV === "test") return false;
  const flag = process.env.AUTH_CACHE_ENABLED?.trim().toLowerCase();
  if (flag === "false" || flag === "0") return false;
  return ttlMs() > 0;
}

export function authCacheKey(
  userId: string,
  tenantId: string | null,
  resellerId: string | null,
): string {
  return `${userId}\0${tenantId ?? ""}\0${resellerId ?? ""}`;
}

export function getCachedAuthContext(key: string): AuthContext | null {
  if (!isEnabled()) return null;
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.auth;
}

export function setCachedAuthContext(key: string, userId: string, auth: AuthContext): void {
  if (!isEnabled()) return;
  if (store.size >= MAX_ENTRIES) {
    pruneExpired();
  }
  store.set(key, {
    auth,
    userId,
    expiresAt: Date.now() + ttlMs(),
  });
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  while (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (!oldest) break;
    store.delete(oldest);
  }
}

/** Drop cached auth for one user (role/status change). */
export function invalidateAuthCacheForUser(userId: string): void {
  for (const [key, entry] of store) {
    if (entry.userId === userId) store.delete(key);
  }
}

/** Drop cached auth for every user in a tenant (role permission changes). */
export function invalidateAuthCacheForTenant(tenantId: string): void {
  for (const [key, entry] of store) {
    if (entry.auth.tenantId === tenantId) store.delete(key);
  }
}

export function clearAuthCache(): void {
  store.clear();
}
