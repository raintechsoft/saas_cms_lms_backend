import { Router } from "express";
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