import { Router, type Request } from "express";
import { authenticate, authorizeRoles } from "../../auth/index.js";
import { sendSuccess } from "../../common/response.js";
import { UserRole } from "../../generated/prisma/client.js";
import { validateRequest } from "../../validation/validate-request.middleware.js";
import { runGapAnalysisSchema } from "./gap-analysis.schemas.js";
import {
  runGapAnalysis,
  type AuditContext,
} from "./gap-analysis.service.js";

const auditContextFrom = (req: Request): AuditContext => ({
  requestId: req.requestId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

export const gapAnalysisRouter = Router();

gapAnalysisRouter.post(
  "/gap-analysis/run",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({ body: runGapAnalysisSchema }),
  async (req, res) => {
    const result = await runGapAnalysis(req.auth!.id, req.body, auditContextFrom(req));
    return sendSuccess(req, res, result, 201);
  },
);
