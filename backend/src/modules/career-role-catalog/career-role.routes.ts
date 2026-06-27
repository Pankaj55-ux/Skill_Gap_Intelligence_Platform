import { Router, type Request } from "express";
import { authenticate, authorizeRoles } from "../../auth/index.js";
import { sendSuccess } from "../../common/response.js";
import { UserRole } from "../../generated/prisma/client.js";
import { validateRequest } from "../../validation/validate-request.middleware.js";
import {
  careerRoleIdParamsSchema,
  createCareerRoleSchema,
  listCareerRolesQuerySchema,
  updateCareerRoleSchema,
  type ListCareerRolesQuery,
} from "./career-role.schemas.js";
import {
  createCareerRole,
  deleteCareerRole,
  getCareerRoleById,
  listCareerRoles,
  updateCareerRole,
  type AuditContext,
} from "./career-role.service.js";

const auditContextFrom = (req: Request): AuditContext => ({
  requestId: req.requestId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

const catalogReaders = [
  UserRole.STUDENT,
  UserRole.MENTOR,
  UserRole.PLACEMENT_OFFICER,
  UserRole.ADMIN,
] as const;

const catalogWriters = [
  UserRole.ADMIN,
  UserRole.PLACEMENT_OFFICER,
] as const;

export const careerRoleRouter = Router();

careerRoleRouter.post(
  "/career-roles",
  authenticate,
  authorizeRoles(...catalogWriters),
  validateRequest({ body: createCareerRoleSchema }),
  async (req, res) => {
    const role = await createCareerRole(req.auth!.id, req.body, auditContextFrom(req));
    return sendSuccess(req, res, { role }, 201);
  },
);

careerRoleRouter.get(
  "/career-roles",
  authenticate,
  authorizeRoles(...catalogReaders),
  validateRequest({ query: listCareerRolesQuerySchema }),
  async (req, res) => {
    const result = await listCareerRoles(req.auth!.role, req.query as unknown as ListCareerRolesQuery);
    return sendSuccess(req, res, result);
  },
);

careerRoleRouter.get(
  "/career-roles/:id",
  authenticate,
  authorizeRoles(...catalogReaders),
  validateRequest({ params: careerRoleIdParamsSchema }),
  async (req, res) => {
    const role = await getCareerRoleById(req.auth!.role, String(req.params.id));
    return sendSuccess(req, res, { role });
  },
);

careerRoleRouter.patch(
  "/career-roles/:id",
  authenticate,
  authorizeRoles(...catalogWriters),
  validateRequest({ params: careerRoleIdParamsSchema, body: updateCareerRoleSchema }),
  async (req, res) => {
    const role = await updateCareerRole(req.auth!.id, String(req.params.id), req.body, auditContextFrom(req));
    return sendSuccess(req, res, { role });
  },
);

careerRoleRouter.delete(
  "/career-roles/:id",
  authenticate,
  authorizeRoles(...catalogWriters),
  validateRequest({ params: careerRoleIdParamsSchema }),
  async (req, res) => {
    const role = await deleteCareerRole(req.auth!.id, String(req.params.id), auditContextFrom(req));
    return sendSuccess(req, res, { role });
  },
);
