import { Router, type Request } from "express";
import { authenticate, authorizeRoles } from "../../auth/index.js";
import { sendSuccess } from "../../common/response.js";
import { UserRole } from "../../generated/prisma/client.js";
import { validateRequest } from "../../validation/validate-request.middleware.js";
import {
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
  type ListNotificationsQuery,
} from "./notification.schemas.js";
import { notificationService, type AuditContext } from "./notification.service.js";

const auditContextFrom = (req: Request): AuditContext => ({
  requestId: req.requestId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

const notificationReaders = [
  UserRole.STUDENT,
  UserRole.MENTOR,
  UserRole.PLACEMENT_OFFICER,
  UserRole.ADMIN,
] as const;

export const notificationRouter = Router();

notificationRouter.get(
  "/notifications",
  authenticate,
  authorizeRoles(...notificationReaders),
  validateRequest({ query: listNotificationsQuerySchema }),
  async (req, res) => {
    const result = await notificationService.list(
      { id: req.auth!.id, role: req.auth!.role },
      req.query as unknown as ListNotificationsQuery,
    );
    return sendSuccess(req, res, result);
  },
);

notificationRouter.get(
  "/notifications/:id",
  authenticate,
  authorizeRoles(...notificationReaders),
  validateRequest({ params: notificationIdParamsSchema }),
  async (req, res) => {
    const notification = await notificationService.getById(
      { id: req.auth!.id, role: req.auth!.role },
      String(req.params.id),
    );
    return sendSuccess(req, res, { notification });
  },
);

notificationRouter.patch(
  "/notifications/read-all",
  authenticate,
  authorizeRoles(...notificationReaders),
  async (req, res) => {
    const result = await notificationService.markAllRead(
      { id: req.auth!.id, role: req.auth!.role },
      auditContextFrom(req),
    );
    return sendSuccess(req, res, result);
  },
);

notificationRouter.patch(
  "/notifications/:id/read",
  authenticate,
  authorizeRoles(...notificationReaders),
  validateRequest({ params: notificationIdParamsSchema }),
  async (req, res) => {
    const notification = await notificationService.markRead(
      { id: req.auth!.id, role: req.auth!.role },
      String(req.params.id),
      auditContextFrom(req),
    );
    return sendSuccess(req, res, { notification });
  },
);

notificationRouter.delete(
  "/notifications/:id",
  authenticate,
  authorizeRoles(...notificationReaders),
  validateRequest({ params: notificationIdParamsSchema }),
  async (req, res) => {
    const notification = await notificationService.delete(
      { id: req.auth!.id, role: req.auth!.role },
      String(req.params.id),
      auditContextFrom(req),
    );
    return sendSuccess(req, res, { notification });
  },
);
