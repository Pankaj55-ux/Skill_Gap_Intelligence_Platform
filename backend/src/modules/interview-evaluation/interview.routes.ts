import { Router, type Request } from "express";
import { authenticate, authorizeRoles } from "../../auth/index.js";
import { sendSuccess } from "../../common/response.js";
import { UserRole } from "../../generated/prisma/client.js";
import { validateRequest } from "../../validation/validate-request.middleware.js";
import { interviewEvaluationService, type AuditContext } from "./interview-evaluation.service.js";
import {
  evaluateInterviewAnswerSchema,
  interviewAnswerIdParamsSchema,
} from "./interview.schemas.js";

const auditContextFrom = (req: Request): AuditContext => ({
  requestId: req.requestId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

export const interviewEvaluationRouter = Router();

interviewEvaluationRouter.post(
  "/interview/evaluate",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({ body: evaluateInterviewAnswerSchema }),
  async (req, res) => {
    const result = await interviewEvaluationService.evaluateTextAnswer(
      req.auth!.id,
      req.body,
      auditContextFrom(req),
    );
    return sendSuccess(req, res, result, 201);
  },
);

interviewEvaluationRouter.get(
  "/interview/history",
  authenticate,
  authorizeRoles(UserRole.STUDENT, UserRole.PLACEMENT_OFFICER, UserRole.ADMIN),
  async (req, res) => {
    const result = await interviewEvaluationService.listHistory({
      id: req.auth!.id,
      role: req.auth!.role,
    });
    return sendSuccess(req, res, result);
  },
);

interviewEvaluationRouter.get(
  "/interview/history/:id",
  authenticate,
  authorizeRoles(UserRole.STUDENT, UserRole.PLACEMENT_OFFICER, UserRole.ADMIN),
  validateRequest({ params: interviewAnswerIdParamsSchema }),
  async (req, res) => {
    const result = await interviewEvaluationService.getHistoryById(
      { id: req.auth!.id, role: req.auth!.role },
      String(req.params.id),
    );
    return sendSuccess(req, res, result);
  },
);
