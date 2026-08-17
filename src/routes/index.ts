import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRouter } from "./auth/index.js";
import { campusRouter } from "./campus/index.js";
import { platformRouter } from "./super-admin/index.js";
import { portalRouter } from "./student-parent/index.js";
import { portalMobileRouter } from "./student-parent/mobile.js";
import { publicRouter } from "./public/index.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "saas-cms-lms-api" });
});

apiRouter.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "database query failed";
    console.error("[health/db]", message);
    res.status(503).json({ status: "error", database: "disconnected", message });
  }
});

// Shared authentication endpoints.
apiRouter.use(authRouter);

// Public unauthenticated surfaces (online admission, etc.).
apiRouter.use("/public", publicRouter);

// Independently owned API surfaces for each frontend.
apiRouter.use("/platform", platformRouter);
apiRouter.use("/portal", portalRouter);
apiRouter.use("/portal/mobile", portalMobileRouter);
apiRouter.use("/campus", campusRouter);

// Temporary compatibility mount for the existing combined frontend.
// Remove after every campus request uses the /campus prefix.
apiRouter.use(campusRouter);