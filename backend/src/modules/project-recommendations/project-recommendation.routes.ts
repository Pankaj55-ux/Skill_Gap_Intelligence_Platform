import { Router, type Request } from "express";
import { authenticate, authorizeRoles } from "../../auth/index.js";
import { sendSuccess } from "../../common/response.js";
import { UserRole } from "../../generated/prisma/client.js";
import { validateRequest } from "../../validation/validate-request.middleware.js";
import { aiProjectRecommendationService, type AuditContext } from "./ai-project-recommendation.service.js";
import { projectRecommendationRequestSchema } from "./project-recommendation.schemas.js";

const auditContextFrom = (req: Request): AuditContext => ({
  requestId: req.requestId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

export const projectRecommendationRouter = Router();

projectRecommendationRouter.post(
  "/projects/recommend",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({ body: projectRecommendationRequestSchema }),
  async (req, res) => {
    const recommendations = await aiProjectRecommendationService.recommendForStudent(
      req.auth!.id,
      req.body,
      auditContextFrom(req),
    );
    return sendSuccess(req, res, recommendations, 201);
  },
);
