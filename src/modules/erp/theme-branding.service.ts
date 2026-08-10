import type { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

export type ThemeBrandingSettings = {
  brandName: string;
  tagline: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  appIconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  themePreset: string;
  themeStyle: "light" | "dark" | "system";
  sidebarStyle: "light" | "dark";
  sidebarPosition: "fixed" | "scrollable";
  sidebarSize: "compact" | "standard" | "wide";
  fontFamily: string;
  headingFont: string;
  baseFontSize: number;
  contentWidth: "fluid" | "boxed";
  borderRadius: "sm" | "md" | "lg" | "xl";
  density: "compact" | "comfortable" | "spacious";
  loginBackgroundUrl: string | null;
  loginWelcomeText: string;
  showLogoOnLogin: boolean;
  emailHeaderColor: string;
  emailFooterText: string;
  emailLogoUrl: string | null;
};

const DEFAULTS: ThemeBrandingSettings = {
  brandName: "",
  tagline: "",
  logoUrl: null,
  faviconUrl: null,
  appIconUrl: null,
  primaryColor: "#5B21B6",
  secondaryColor: "#EEF2FF",
  accentColor: "#F59E0B",
  themePreset: "purple",
  themeStyle: "light",
  sidebarStyle: "light",
  sidebarPosition: "fixed",
  sidebarSize: "standard",
  fontFamily: "DM Sans",
  headingFont: "DM Sans",
  baseFontSize: 14,
  contentWidth: "fluid",
  borderRadius: "lg",
  density: "comfortable",
  loginBackgroundUrl: null,
  loginWelcomeText: "Welcome back",
  showLogoOnLogin: true,
  emailHeaderColor: "#5B21B6",
  emailFooterText: "",
  emailLogoUrl: null,
};

const THEME_PRESETS: Record<string, { label: string; primary: string; secondary: string; accent: string }> = {
  purple: { label: "Purple", primary: "#5B21B6", secondary: "#EEF2FF", accent: "#F59E0B" },
  indigo: { label: "Indigo", primary: "#4F46E5", secondary: "#EEF2FF", accent: "#F97316" },
  blue: { label: "Blue", primary: "#1D4ED8", secondary: "#DBEAFE", accent: "#F59E0B" },
  teal: { label: "Teal", primary: "#0F766E", secondary: "#CCFBF1", accent: "#F59E0B" },
  green: { label: "Green", primary: "#047857", secondary: "#D1FAE5", accent: "#F59E0B" },
  maroon: { label: "Maroon", primary: "#9F1239", secondary: "#FFE4E6", accent: "#F59E0B" },
};

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function strOrNull(value: unknown): string | null {
  const next = str(value);
  return next || null;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === "string" && (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function hexColor(value: unknown, fallback: string): string {
  const raw = str(value, fallback);
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw) ? raw : fallback;
}

function parseSettings(branding: Record<string, unknown>, tenantName: string): ThemeBrandingSettings {
  return {
    brandName:
      str(branding.brandName) ||
      str(branding.frontDisplayName) ||
      str(branding.logoText) ||
      tenantName,
    tagline: str(branding.tagline),
    logoUrl: strOrNull(branding.logoUrl),
    faviconUrl: strOrNull(branding.faviconUrl),
    appIconUrl: strOrNull(branding.appIconUrl),
    primaryColor: hexColor(branding.primaryColor, DEFAULTS.primaryColor),
    secondaryColor: hexColor(branding.secondaryColor, DEFAULTS.secondaryColor),
    accentColor: hexColor(branding.accentColor, DEFAULTS.accentColor),
    themePreset: str(branding.themePreset, DEFAULTS.themePreset) || DEFAULTS.themePreset,
    themeStyle: oneOf(branding.themeStyle, ["light", "dark", "system"] as const, DEFAULTS.themeStyle),
    sidebarStyle: oneOf(branding.sidebarStyle, ["light", "dark"] as const, DEFAULTS.sidebarStyle),
    sidebarPosition: oneOf(
      branding.sidebarPosition,
      ["fixed", "scrollable"] as const,
      DEFAULTS.sidebarPosition,
    ),
    sidebarSize: oneOf(
      branding.sidebarSize,
      ["compact", "standard", "wide"] as const,
      DEFAULTS.sidebarSize,
    ),
    fontFamily: str(branding.fontFamily, DEFAULTS.fontFamily) || DEFAULTS.fontFamily,
    headingFont: str(branding.headingFont, DEFAULTS.headingFont) || DEFAULTS.headingFont,
    baseFontSize: Math.min(18, Math.max(12, num(branding.baseFontSize, DEFAULTS.baseFontSize))),
    contentWidth: oneOf(branding.contentWidth, ["fluid", "boxed"] as const, DEFAULTS.contentWidth),
    borderRadius: oneOf(
      branding.borderRadius,
      ["sm", "md", "lg", "xl"] as const,
      DEFAULTS.borderRadius,
    ),
    density: oneOf(
      branding.density,
      ["compact", "comfortable", "spacious"] as const,
      DEFAULTS.density,
    ),
    loginBackgroundUrl: strOrNull(branding.loginBackgroundUrl),
    loginWelcomeText: str(branding.loginWelcomeText, DEFAULTS.loginWelcomeText) || DEFAULTS.loginWelcomeText,
    showLogoOnLogin: bool(branding.showLogoOnLogin, DEFAULTS.showLogoOnLogin),
    emailHeaderColor: hexColor(branding.emailHeaderColor, DEFAULTS.emailHeaderColor),
    emailFooterText: str(branding.emailFooterText),
    emailLogoUrl: strOrNull(branding.emailLogoUrl),
  };
}

function themeLabel(settings: ThemeBrandingSettings) {
  const preset = THEME_PRESETS[settings.themePreset];
  if (preset && preset.primary.toLowerCase() === settings.primaryColor.toLowerCase()) {
    return `${preset.label}${settings.themePreset === "purple" ? " (Default)" : ""}`;
  }
  return "Custom";
}

function formatUpdatedAt(value: Date) {
  return value.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export async function getThemeBrandingSetup(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, branding: true, updatedAt: true },
  });
  if (!tenant) throw new AppError(404, "Tenant not found", "TENANT_NOT_FOUND");

  const raw = asObject(tenant.branding);
  const settings = parseSettings(raw, tenant.name);
  const updatedBy =
    str(raw.brandingUpdatedByName) ||
    str(raw.updatedByName) ||
    "System";

  return {
    settings,
    presets: Object.entries(THEME_PRESETS).map(([key, value]) => ({
      key,
      label: value.label,
      primaryColor: value.primary,
      secondaryColor: value.secondary,
      accentColor: value.accent,
    })),
    stats: {
      activeTheme: themeLabel(settings),
      logoStatus: settings.logoUrl ? "Custom Logo" : "Default",
      logoUploaded: Boolean(settings.logoUrl),
      primaryColor: settings.primaryColor,
      lastUpdatedAt: formatUpdatedAt(tenant.updatedAt),
      lastUpdatedBy: updatedBy,
      lastUpdatedIso: tenant.updatedAt.toISOString(),
    },
  };
}

export async function saveThemeBranding(
  tenantId: string,
  input: Partial<ThemeBrandingSettings>,
  actorName?: string | null,
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, branding: true },
  });
  if (!tenant) throw new AppError(404, "Tenant not found", "TENANT_NOT_FOUND");

  const current = asObject(tenant.branding);
  const merged = parseSettings({ ...current, ...input }, tenant.name);

  if (input.themePreset && THEME_PRESETS[input.themePreset] && !input.primaryColor) {
    const preset = THEME_PRESETS[input.themePreset];
    merged.themePreset = input.themePreset;
    merged.primaryColor = preset.primary;
    merged.secondaryColor = preset.secondary;
    merged.accentColor = preset.accent;
    merged.emailHeaderColor = preset.primary;
  }

  const nextBranding: Record<string, unknown> = {
    ...current,
    ...merged,
    frontDisplayName: merged.brandName,
    logoText: merged.brandName || tenant.name,
    brandingUpdatedByName: actorName?.trim() || current.brandingUpdatedByName || "Admin",
    brandingUpdatedAt: new Date().toISOString(),
  };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { branding: nextBranding as Prisma.InputJsonValue },
  });

  return getThemeBrandingSetup(tenantId);
}
