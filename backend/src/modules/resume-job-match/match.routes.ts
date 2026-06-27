import { Router, type Request } from "express";
import { authenticate, authorizeRoles } from "../../auth/index.js";
import { sendSuccess } from "../../common/response.js";
import { UserRole } from "../../generated/prisma/client.js";
import { validateRequest } from "../../validation/validate-request.middleware.js";
import { runResumeJobMatchSchema } from "./match.schemas.js";
import { runResumeJobMatch, type AuditContext } from "./match.service.js";

const auditContextFrom = (req: Request): AuditContext => ({
  requestId: req.requestId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

export const resumeJobMatchRouter = Router();

resumeJobMatchRouter.post(
  "/match/run",
  authenticate,
  authorizeRoles(UserRole.STUDENT, UserRole.PLACEMENT_OFFICER, UserRole.ADMIN),
  validateRequest({ body: runResumeJobMatchSchema }),
  async (req, res) => {
    const result = await runResumeJobMatch(
      { id: req.auth!.id, role: req.auth!.role },
      req.body,
      auditContextFrom(req),
    );
    return sendSuccess(req, res, result, 201);
  },
);
