import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { AppError } from "./lib/errors.js";
import { getStorageDriver, UPLOAD_ROOT } from "./lib/uploads.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

const allowedOrigins = new Set(
  [
    env.WEB_ORIGIN,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
  ].filter(Boolean),
);

app.disable("x-powered-by");
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || env.NODE_ENV !== "production") {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  }),
);
app.use(express.json({ limit: "2mb" }));
if (getStorageDriver() === "local") {
  app.use("/uploads", express.static(UPLOAD_ROOT));
}

app.use("/api/v1", apiRouter);

app.use((_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
});

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
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
