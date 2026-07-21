import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";

let client: OAuth2Client | null = null;

function getClient() {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError(503, "Google sign-in is not configured", "GOOGLE_NOT_CONFIGURED");
  }
  client ??= new OAuth2Client(env.GOOGLE_CLIENT_ID);
  return client;
}

export function isGoogleAuthConfigured() {
  return Boolean(env.GOOGLE_CLIENT_ID);
}

export async function verifyGoogleIdToken(idToken: string) {
  const ticket = await getClient().verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.sub) {
    throw new AppError(401, "Invalid Google credential", "INVALID_GOOGLE_TOKEN");
  }
  return {
    email: payload.email.trim().toLowerCase(),
    googleSubjectId: payload.sub,
    firstName: payload.given_name ?? "",
    lastName: payload.family_name ?? "",
    emailVerified: payload.email_verified ?? false,
  };
}
