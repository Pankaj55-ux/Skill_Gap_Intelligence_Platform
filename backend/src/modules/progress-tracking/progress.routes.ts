import { Router, type Request } from "express";
import { authenticate, authorizeRoles } from "../../auth/index.js";
import { sendSuccess } from "../../common/response.js";
import { UserRole } from "../../generated/prisma/client.js";
import { validateRequest } from "../../validation/validate-request.middleware.js";
import {
  roadmapProgressParamsSchema,
  updateProgressSchema,
} from "./progress.schemas.js";
import {
  getProgressByRoadmap,
  listProgress,
  updateProgress,
  type AuditContext,
} from "./progress.service.js";

const auditContextFrom = (req: Request): AuditContext => ({
  requestId: req.requestId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

export const progressRouter = Router();

progressRouter.post(
  "/progress/update",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({ body: updateProgressSchema }),
  async (req, res) => {
    const result = await updateProgress(req.auth!.id, req.body, auditContextFrom(req));
    return sendSuccess(req, res, result);
  },
);

progressRouter.get(
  "/progress",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  async (req, res) => {
    const progress = await listProgress(req.auth!.id);
    return sendSuccess(req, res, { progress });
  },
);

progressRouter.get(
  "/progress/:roadmapId",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({ params: roadmapProgressParamsSchema }),
  async (req, res) => {
    const progress = await getProgressByRoadmap(req.auth!.id, String(req.params.roadmapId));
    return sendSuccess(req, res, { progress });
  },
);
