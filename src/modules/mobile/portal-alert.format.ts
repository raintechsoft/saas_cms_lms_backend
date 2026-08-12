import type { NoticeAudience } from "@prisma/client";
import { env } from "../../config/env.js";

export type PortalAlertCategory =
  | "NOTICE"
  | "FEE_REMINDER"
  | "ANNOUNCEMENT"
  | "HOMEWORK"
  | "GENERAL";

export type PortalAlertScreen = "notifications" | "notices" | "fees";

export type PortalAlertInput = {
  category: PortalAlertCategory;
  title: string;
  body: string;
  type?: string;
  screen?: PortalAlertScreen;
  tenantName?: string | null;
  referenceId?: string | null;
};

const CATEGORY_LABEL: Record<PortalAlertCategory, string> = {
  NOTICE: "New notice",
  FEE_REMINDER: "Fee reminder",
  ANNOUNCEMENT: "Announcement",
  HOMEWORK: "Homework update",
  GENERAL: "School update",
};

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, max = 140) {
  const text = collapseWhitespace(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

export function formatPortalPushTitle(input: PortalAlertInput) {
  const label = CATEGORY_LABEL[input.category] ?? "School update";
  const headline = collapseWhitespace(input.title);
  const tenant = input.tenantName?.trim();
  if (tenant) return `${label} · ${tenant}`;
  return headline || label;
}

export function formatPortalPushBody(input: PortalAlertInput) {
  const title = collapseWhitespace(input.title);
  const body = collapseWhitespace(input.body);

  if (input.category === "FEE_REMINDER") {
    return truncate(body, 160);
  }

  if (input.category === "NOTICE") {
    if (body && body !== title) {
      return truncate(body, 160);
    }
    return "Tap to read the full notice in the app.";
  }

  if (body) return truncate(body, 160);
  if (title) return truncate(title, 160);
  return "Tap to open the app.";
}

export function buildPortalPushPayload(input: PortalAlertInput) {
  const imageUrl = resolvePushImageUrl(input.category);
  return {
    title: formatPortalPushTitle(input),
    body: formatPortalPushBody(input),
    type: input.type ?? input.category,
    screen: input.screen ?? defaultScreenForCategory(input.category),
    category: input.category,
    referenceId: input.referenceId ?? undefined,
    ...(imageUrl ? { imageUrl } : {}),
  };
}

const PUSH_IMAGE_FILES: Record<PortalAlertCategory, string> = {
  NOTICE: "notice.png",
  FEE_REMINDER: "fees.png",
  ANNOUNCEMENT: "announcement.png",
  HOMEWORK: "homework.png",
  GENERAL: "general.png",
};

export function resolvePushImageUrl(category: PortalAlertCategory) {
  const base = env.API_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!base) return undefined;
  const file = PUSH_IMAGE_FILES[category] ?? PUSH_IMAGE_FILES.GENERAL;
  return `${base}/api/v1/public/push-images/${file}`;
}

function defaultScreenForCategory(category: PortalAlertCategory): PortalAlertScreen {
  switch (category) {
    case "NOTICE":
      return "notices";
    case "FEE_REMINDER":
      return "fees";
    default:
      return "notifications";
  }
}

export function audienceLabel(audience: NoticeAudience) {
  switch (audience) {
    case "STUDENTS":
      return "students";
    case "PARENTS":
      return "parents";
    default:
      return "all";
  }
}
