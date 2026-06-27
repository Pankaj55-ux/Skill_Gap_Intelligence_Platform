import { Router, type Request } from "express";
import { authenticate, authorizeRoles } from "../../auth/index.js";
import { sendSuccess } from "../../common/response.js";
import { UserRole } from "../../generated/prisma/client.js";
import { validateRequest } from "../../validation/validate-request.middleware.js";
import {
  aiCourseRecommendationService,
  listOwnCourseRecommendations,
  updateCourseRecommendationItemState,
  type AuditContext,
} from "./ai-course-recommendation.service.js";
import {
  courseRecommendationIdParamsSchema,
  courseRecommendationRequestSchema,
  updateCourseRecommendationItemStateSchema,
} from "./course-recommendation.schemas.js";

const auditContextFrom = (req: Request): AuditContext => ({
  requestId: req.requestId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

export const courseRecommendationRouter = Router();

courseRecommendationRouter.get(
  "/courses/recommendations",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  async (req, res) => {
    const recommendations = await listOwnCourseRecommendations(req.auth!.id);
    return sendSuccess(req, res, { recommendations });
  },
);

courseRecommendationRouter.post(
  "/courses/recommend",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({ body: courseRecommendationRequestSchema }),
  async (req, res) => {
    const recommendations = await aiCourseRecommendationService.recommendForStudent(
      req.auth!.id,
      req.body,
      auditContextFrom(req),
    );
    return sendSuccess(req, res, recommendations, 201);
  },
);

courseRecommendationRouter.patch(
  "/courses/recommendations/:id/items/state",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({
    params: courseRecommendationIdParamsSchema,
    body: updateCourseRecommendationItemStateSchema,
  }),
  async (req, res) => {
    const recommendation = await updateCourseRecommendationItemState(
      req.auth!.id,
      String(req.params.id),
      req.body,
      auditContextFrom(req),
    );
    return sendSuccess(req, res, { recommendation });
  },
);
