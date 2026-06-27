import { Router, type Request } from "express";
import { authenticate, authorizeRoles } from "../../auth/index.js";
import { sendSuccess } from "../../common/response.js";
import { UserRole } from "../../generated/prisma/client.js";
import { validateRequest } from "../../validation/validate-request.middleware.js";
import {
  adminBodySchema,
  adminListQuerySchema,
  adminResourceIdParamsSchema,
  adminResourceParamsSchema,
  adminUserRoleSchema,
  type AdminListQuery,
} from "./admin.schemas.js";
import { adminConsoleService, type AuditContext } from "./admin-console.service.js";

const auditContextFrom = (req: Request): AuditContext => ({
  requestId: req.requestId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

export const adminConsoleRouter = Router();

adminConsoleRouter.use("/admin", authenticate, authorizeRoles(UserRole.ADMIN));

adminConsoleRouter.get("/admin/resources", async (req, res) => {
  return sendSuccess(req, res, adminConsoleService.listResources());
});

adminConsoleRouter.get(
  "/admin/audit-history",
  validateRequest({ query: adminListQuerySchema }),
  async (req, res) => {
    const result = await adminConsoleService.auditHistory(req.query as unknown as AdminListQuery);
    return sendSuccess(req, res, result);
  },
);

adminConsoleRouter.patch(
  "/admin/users/:id/role",
  validateRequest({ params: adminResourceIdParamsSchema.omit({ resource: true }), body: adminUserRoleSchema }),
  async (req, res) => {
    const result = await adminConsoleService.updateUserRole(
      String(req.params.id),
      req.body.role,
      req.auth!.id,
      auditContextFrom(req),
    );
    return sendSuccess(req, res, result);
  },
);

adminConsoleRouter.get(
  "/admin/:resource",
  validateRequest({ params: adminResourceParamsSchema, query: adminListQuerySchema }),
  async (req, res) => {
    const result = await adminConsoleService.list(
      String(req.params.resource),
      req.query as unknown as AdminListQuery,
    );
    return sendSuccess(req, res, result);
  },
);

adminConsoleRouter.post(
  "/admin/:resource",
  validateRequest({ params: adminResourceParamsSchema, body: adminBodySchema }),
  async (req, res) => {
    const result = await adminConsoleService.create(
      String(req.params.resource),
      req.auth!.id,
      req.body,
      auditContextFrom(req),
    );
    return sendSuccess(req, res, result, 201);
  },
);

adminConsoleRouter.get(
  "/admin/:resource/:id",
  validateRequest({ params: adminResourceIdParamsSchema }),
  async (req, res) => {
    const result = await adminConsoleService.get(String(req.params.resource), String(req.params.id));
    return sendSuccess(req, res, result);
  },
);

adminConsoleRouter.patch(
  "/admin/:resource/:id",
  validateRequest({ params: adminResourceIdParamsSchema, body: adminBodySchema }),
  async (req, res) => {
    const result = await adminConsoleService.update(
      String(req.params.resource),
      String(req.params.id),
      req.auth!.id,
      req.body,
      auditContextFrom(req),
    );
    return sendSuccess(req, res, result);
  },
);

adminConsoleRouter.delete(
  "/admin/:resource/:id",
  validateRequest({ params: adminResourceIdParamsSchema }),
  async (req, res) => {
    const result = await adminConsoleService.softDelete(
      String(req.params.resource),
      String(req.params.id),
      req.auth!.id,
      auditContextFrom(req),
    );
    return sendSuccess(req, res, result);
  },
);

adminConsoleRouter.patch(
  "/admin/:resource/:id/restore",
  validateRequest({ params: adminResourceIdParamsSchema }),
  async (req, res) => {
    const result = await adminConsoleService.restore(
      String(req.params.resource),
      String(req.params.id),
      req.auth!.id,
      auditContextFrom(req),
    );
    return sendSuccess(req, res, result);
  },
);
