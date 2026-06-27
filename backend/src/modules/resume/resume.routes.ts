import { Router, type Request } from "express";
import { authenticate, authorizeRoles } from "../../auth/index.js";
import { sendSuccess } from "../../common/response.js";
import { UserRole } from "../../generated/prisma/client.js";
import { validateRequest } from "../../validation/validate-request.middleware.js";
import { resumeIdParamsSchema } from "./resume.schemas.js";
import { resumeUploadMiddleware } from "./resume-upload.middleware.js";
import {
  deleteOwnResume,
  listOwnResumes,
  uploadResume,
  type AuditContext,
} from "./resume.service.js";
import { aiResumeExtractorService } from "./ai-resume-extractor.service.js";
import { getLatestResumeAnalysis } from "./ai-resume-extractor.service.js";

const auditContextFrom = (req: Request): AuditContext => ({
  requestId: req.requestId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

export const resumeRouter = Router();

resumeRouter.post(
  "/resume/upload",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  resumeUploadMiddleware,
  async (req, res) => {
    const result = await uploadResume(req.auth!.id, req.file, auditContextFrom(req));
    return sendSuccess(req, res, result, 201);
  },
);

resumeRouter.get(
  "/resume/:id/analysis",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({ params: resumeIdParamsSchema }),
  async (req, res) => {
    const result = await getLatestResumeAnalysis(req.auth!.id, String(req.params.id));
    return sendSuccess(req, res, { result });
  },
);

resumeRouter.get(
  "/resume/me",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  async (req, res) => {
    const resumes = await listOwnResumes(req.auth!.id);
    return sendSuccess(req, res, { resumes });
  },
);

resumeRouter.delete(
  "/resume/:id",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({ params: resumeIdParamsSchema }),
  async (req, res) => {
    const resume = await deleteOwnResume(req.auth!.id, String(req.params.id), auditContextFrom(req));
    return sendSuccess(req, res, { resume });
  },
);

resumeRouter.post(
  "/resume/:id/analyze",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({ params: resumeIdParamsSchema }),
  async (req, res) => {
    const result = await aiResumeExtractorService.processResumeText({
      userId: req.auth!.id,
      resumeId: String(req.params.id),
      context: auditContextFrom(req),
    });
    return sendSuccess(req, res, result);
  },
);
