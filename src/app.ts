import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { AppError, asyncHandler } from "./lib/errors.js";
import { getStorageDriver, UPLOAD_ROOT } from "./lib/uploads.js";
import { razorpayWebhookController } from "./modules/fees/online-payments.controller.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

function parseOrigins(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((origin) => origin.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, ""))
    .filter(Boolean);
}

const allowedOrigins = new Set([
  ...parseOrigins(env.WEB_ORIGIN),
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "https://universe-ai-solution-saas.onrender.com",
]);

function normalizeOrigin(origin: string | undefined): string {
  return (origin ?? "").trim().replace(/\/+$/, "");
}

function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins.has(origin) || env.NODE_ENV !== "production";
}

function applyCorsHeaders(req: Request, res: Response) {
  const origin = normalizeOrigin(
    typeof req.headers.origin === "string" ? req.headers.origin : undefined,
  );
  if (!origin || !isAllowedOrigin(origin)) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  res.setHeader("Access-Control-Max-Age", "86400");
}

console.log(`[cors] allowed origins: ${[...allowedOrigins].join(", ")}`);

app.disable("x-powered-by");
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use((req, res, next) => {
  applyCorsHeaders(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});
app.post(
  "/api/v1/webhooks/razorpay",
  express.raw({ type: "application/json" }),
  asyncHandler(razorpayWebhookController),
);

// Staff photos/documents, leave attachments and homework attachments are sent
// as base64 data URLs (a 20MB file becomes ~27MB encoded), so the JSON limit
// must accommodate them.
app.use(express.json({ limit: "40mb" }));
if (getStorageDriver() === "local") {
  app.use("/uploads", express.static(UPLOAD_ROOT));
}

const pushImagesRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/push-images",
);
app.use("/api/v1/public/push-images", express.static(pushImagesRoot));

app.use("/api/v1", apiRouter);

app.use((_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
});

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  applyCorsHeaders(req, res);
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.issues,
      },
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P1001", "P1002", "P1017", "P2021", "P2022", "P2024", "P2028"].includes(error.code))
  ) {
    console.error("[database]", error);
    res.status(503).json({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message:
          "API is running but cannot query the database. On Render, set DATABASE_URL to the Supabase pooler URI (not localhost, and not db.*.supabase.co:5432). Use sslmode=require.",
      },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({
        error: { code: "DUPLICATE_RECORD", message: "A record with these values already exists" },
      });
      return;
    }
    if (error.code === "P2003") {
      res.status(409).json({
        error: { code: "RECORD_IN_USE", message: "This record is still in use" },
      });
      return;
    }
  }

  console.error(error);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  });
};

app.use(errorHandler);
