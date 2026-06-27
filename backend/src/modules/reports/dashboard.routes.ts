import { Router } from "express";
import { authenticate, authorizeRoles } from "../../auth/index.js";
import { sendSuccess } from "../../common/response.js";
import { UserRole } from "../../generated/prisma/client.js";
import { getStudentDashboard } from "./dashboard.service.js";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/dashboard",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  async (req, res) => {
    const { dashboard, cacheStatus, maxAgeSeconds } = await getStudentDashboard(req.auth!.id);
    res.setHeader("Cache-Control", `private, max-age=${maxAgeSeconds}`);
    res.setHeader("X-Dashboard-Cache", cacheStatus);
    return sendSuccess(req, res, { dashboard });
  },
);
