import { Router, type Request } from "express";
import { authenticate, authorizeRoles } from "../../auth/index.js";
import { sendSuccess } from "../../common/response.js";
import { UserRole } from "../../generated/prisma/client.js";
import { validateRequest } from "../../validation/validate-request.middleware.js";
import {
  createStudentProfileSchema,
  studentUserParamsSchema,
  updateStudentProfileSchema,
} from "./student-profile.schemas.js";
import {
  createOwnStudentProfile,
  getOwnStudentProfile,
  getPermittedStudentProfile,
  updateOwnStudentProfile,
  type AuditContext,
} from "./student-profile.service.js";

const auditContextFrom = (req: Request): AuditContext => ({
  requestId: req.requestId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

const studentProfileReaders = [
  UserRole.STUDENT,
  UserRole.MENTOR,
  UserRole.PLACEMENT_OFFICER,
  UserRole.ADMIN,
] as const;

export const studentProfileRouter = Router();

studentProfileRouter.post(
  "/student-profile",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({ body: createStudentProfileSchema }),
  async (req, res) => {
    const profile = await createOwnStudentProfile(req.auth!.id, req.body, auditContextFrom(req));
    return sendSuccess(req, res, { profile }, 201);
  },
);

studentProfileRouter.get(
  "/student-profile/me",
  authenticate,
  authorizeRoles(...studentProfileReaders),
  async (req, res) => {
    const profile = await getOwnStudentProfile(req.auth!.id);
    return sendSuccess(req, res, { profile });
  },
);

studentProfileRouter.get(
  "/student-profile/:userId",
  authenticate,
  authorizeRoles(...studentProfileReaders),
  validateRequest({ params: studentUserParamsSchema }),
  async (req, res) => {
    const profile = await getPermittedStudentProfile(req.auth!.role, req.auth!.id, String(req.params.userId));
    return sendSuccess(req, res, { profile });
  },
);

studentProfileRouter.patch(
  "/student-profile/me",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({ body: updateStudentProfileSchema }),
  async (req, res) => {
    const profile = await updateOwnStudentProfile(req.auth!.id, req.body, auditContextFrom(req));
    return sendSuccess(req, res, { profile });
  },
);
