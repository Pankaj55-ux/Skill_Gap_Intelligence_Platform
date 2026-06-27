import { Router, type Request } from "express";
import { authenticate, authorizeRoles } from "../../auth/index.js";
import { sendSuccess } from "../../common/response.js";
import { UserRole } from "../../generated/prisma/client.js";
import { validateRequest } from "../../validation/validate-request.middleware.js";
import { interviewSessionService, type AuditContext } from "./interview-session.service.js";
import {
  sessionIdParamsSchema,
  startInterviewSessionSchema,
  submitTextAnswerSchema,
} from "./live-interview.schemas.js";
import { voiceAnswerUploadMiddleware } from "./voice-answer-upload.middleware.js";

const auditContextFrom = (req: Request): AuditContext => ({
  requestId: req.requestId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

export const liveInterviewRouter = Router();

liveInterviewRouter.post(
  "/interview/sessions",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({ body: startInterviewSessionSchema }),
  async (req, res) => {
    const result = await interviewSessionService.startSession(req.auth!.id, req.body, auditContextFrom(req));
    return sendSuccess(req, res, result, 201);
  },
);

liveInterviewRouter.get(
  "/interview/sessions",
  authenticate,
  authorizeRoles(UserRole.STUDENT, UserRole.PLACEMENT_OFFICER, UserRole.ADMIN),
  async (req, res) => {
    const result = await interviewSessionService.listSessions({ id: req.auth!.id, role: req.auth!.role });
    return sendSuccess(req, res, result);
  },
);

liveInterviewRouter.get(
  "/interview/sessions/:sessionId",
  authenticate,
  authorizeRoles(UserRole.STUDENT, UserRole.PLACEMENT_OFFICER, UserRole.ADMIN),
  validateRequest({ params: sessionIdParamsSchema }),
  async (req, res) => {
    const result = await interviewSessionService.getSession(
      { id: req.auth!.id, role: req.auth!.role },
      String(req.params.sessionId),
    );
    return sendSuccess(req, res, result);
  },
);

liveInterviewRouter.post(
  "/interview/sessions/:sessionId/answer",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({ params: sessionIdParamsSchema, body: submitTextAnswerSchema }),
  async (req, res) => {
    const result = await interviewSessionService.submitTextAnswer(
      req.auth!.id,
      String(req.params.sessionId),
      req.body,
      auditContextFrom(req),
    );
    return sendSuccess(req, res, result);
  },
);

liveInterviewRouter.post(
  "/interview/sessions/:sessionId/voice-answer",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  voiceAnswerUploadMiddleware,
  validateRequest({ params: sessionIdParamsSchema }),
  async (req, res) => {
    const result = await interviewSessionService.submitVoiceAnswer(
      req.auth!.id,
      String(req.params.sessionId),
      req.file,
      auditContextFrom(req),
    );
    return sendSuccess(req, res, result);
  },
);

liveInterviewRouter.post(
  "/interview/sessions/:sessionId/pause",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({ params: sessionIdParamsSchema }),
  async (req, res) => {
    const result = await interviewSessionService.pauseSession(
      req.auth!.id,
      String(req.params.sessionId),
      auditContextFrom(req),
    );
    return sendSuccess(req, res, result);
  },
);

liveInterviewRouter.post(
  "/interview/sessions/:sessionId/resume",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({ params: sessionIdParamsSchema }),
  async (req, res) => {
    const result = await interviewSessionService.resumeSession(
      req.auth!.id,
      String(req.params.sessionId),
      auditContextFrom(req),
    );
    return sendSuccess(req, res, result);
  },
);

liveInterviewRouter.post(
  "/interview/sessions/:sessionId/end",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({ params: sessionIdParamsSchema }),
  async (req, res) => {
    const result = await interviewSessionService.endSession(
      req.auth!.id,
      String(req.params.sessionId),
      auditContextFrom(req),
    );
    return sendSuccess(req, res, result);
  },
);

liveInterviewRouter.get(
  "/interview/sessions/:sessionId/report",
  authenticate,
  authorizeRoles(UserRole.STUDENT, UserRole.PLACEMENT_OFFICER, UserRole.ADMIN),
  validateRequest({ params: sessionIdParamsSchema }),
  async (req, res) => {
    const result = await interviewSessionService.getReport(
      { id: req.auth!.id, role: req.auth!.role },
      String(req.params.sessionId),
    );
    return sendSuccess(req, res, result);
  },
);
