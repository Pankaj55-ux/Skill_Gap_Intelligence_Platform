import { Router, type Request } from "express";
import { authenticate, authorizeRoles } from "../../auth/index.js";
import { sendSuccess } from "../../common/response.js";
import { UserRole } from "../../generated/prisma/client.js";
import { validateRequest } from "../../validation/validate-request.middleware.js";
import { roadmapIdParamsSchema } from "./roadmap.schemas.js";
import {
  generateRoadmap,
  getOwnRoadmapById,
  listOwnRoadmaps,
  type AuditContext,
} from "./roadmap.service.js";

const auditContextFrom = (req: Request): AuditContext => ({
  requestId: req.requestId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

export const roadmapRouter = Router();

roadmapRouter.post(
  "/roadmap/generate",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  async (req, res) => {
    const roadmap = await generateRoadmap(req.auth!.id, auditContextFrom(req));
    return sendSuccess(req, res, { roadmap }, 201);
  },
);

roadmapRouter.get(
  "/roadmap",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  async (req, res) => {
    const roadmaps = await listOwnRoadmaps(req.auth!.id);
    return sendSuccess(req, res, { roadmaps });
  },
);

roadmapRouter.get(
  "/roadmap/:id",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({ params: roadmapIdParamsSchema }),
  async (req, res) => {
    const roadmap = await getOwnRoadmapById(req.auth!.id, String(req.params.id));
    return sendSuccess(req, res, { roadmap });
  },
);
