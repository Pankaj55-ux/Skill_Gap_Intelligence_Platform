import { Router, type Request } from "express";
import { authenticate, authorizeRoles } from "../../auth/index.js";
import { sendSuccess } from "../../common/response.js";
import { AppError } from "../../errors/app-error.js";
import { UserRole } from "../../generated/prisma/client.js";
import { validateRequest } from "../../validation/validate-request.middleware.js";
import {
  createSkillEvidenceSchema,
  reviewSkillEvidenceSchema,
  skillEvidenceIdParamsSchema,
  updateOwnSkillEvidenceSchema,
} from "./skill-evidence.schemas.js";
import {
  canReviewSkillEvidence,
  createSkillEvidence,
  deleteOwnSkillEvidence,
  getSkillEvidenceById,
  listOwnSkillEvidence,
  reviewSkillEvidence,
  updateOwnSkillEvidence,
  type AuditContext,
} from "./skill-evidence.service.js";

const auditContextFrom = (req: Request): AuditContext => ({
  requestId: req.requestId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

const evidenceReaders = [
  UserRole.STUDENT,
  UserRole.MENTOR,
  UserRole.PLACEMENT_OFFICER,
  UserRole.ADMIN,
] as const;

export const skillEvidenceRouter = Router();

skillEvidenceRouter.post(
  "/skill-evidence",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  validateRequest({ body: createSkillEvidenceSchema }),
  async (req, res) => {
    const evidence = await createSkillEvidence(req.auth!.id, req.body, auditContextFrom(req));
    return sendSuccess(req, res, { evidence }, 201);
  },
);

skillEvidenceRouter.get(
  "/skill-evidence/me",
  authenticate,
  authorizeRoles(UserRole.STUDENT),
  async (req, res) => {
    const evidence = await listOwnSkillEvidence(req.auth!.id);
    return sendSuccess(req, res, { evidence });
  },
);

skillEvidenceRouter.get(
  "/skill-evidence/:id",
  authenticate,
  authorizeRoles(...evidenceReaders),
  validateRequest({ params: skillEvidenceIdParamsSchema }),
  async (req, res) => {
    const evidence = await getSkillEvidenceById(
      { id: req.auth!.id, role: req.auth!.role },
      String(req.params.id),
    );
    return sendSuccess(req, res, { evidence });
  },
);

skillEvidenceRouter.patch(
  "/skill-evidence/:id",
  authenticate,
  authorizeRoles(...evidenceReaders),
  validateRequest({ params: skillEvidenceIdParamsSchema }),
  async (req, res, next) => {
    try {
      const evidence = canReviewSkillEvidence(req.auth!.role)
        ? await reviewSkillEvidence(
          req.auth!.id,
          String(req.params.id),
          reviewSkillEvidenceSchema.parse(req.body),
          auditContextFrom(req),
        )
        : await updateOwnSkillEvidence(
          req.auth!.id,
          String(req.params.id),
          updateOwnSkillEvidenceSchema.parse(req.body),
          auditContextFrom(req),
        );

      return sendSuccess(req, res, { evidence });
    } catch (error) {
      next(error);
    }
  },
);

skillEvidenceRouter.delete(
  "/skill-evidence/:id",
  authenticate,
  authorizeRoles(...evidenceReaders),
  validateRequest({ params: skillEvidenceIdParamsSchema }),
  async (req, res) => {
    if (req.auth!.role !== UserRole.STUDENT) {
      throw new AppError(403, "INSUFFICIENT_PERMISSIONS", "Only students can delete their own pending evidence");
    }

    const evidence = await deleteOwnSkillEvidence(req.auth!.id, String(req.params.id), auditContextFrom(req));
    return sendSuccess(req, res, { evidence });
  },
);
