import { Router, type Request } from "express";
import rateLimit from "express-rate-limit";
import { authenticate, authorizeRoles, issueAccessToken } from "../../auth/index.js";
import { sendError, sendSuccess } from "../../common/response.js";
import { env } from "../../config/environment.js";
import { UserRole } from "../../generated/prisma/client.js";
import { validateRequest } from "../../validation/validate-request.middleware.js";
import { loginSchema, registerSchema, updateMeSchema } from "./auth.schemas.js";
import {
  getCurrentUser,
  loginUser,
  registerUser,
  updateCurrentUser,
  type AuditContext,
} from "./auth.service.js";

const allRoles = Object.values(UserRole);

const auditContextFrom = (req: Request): AuditContext => ({
  requestId: req.requestId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

export const authRouter = Router();

const credentialRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => sendError(
    req,
    res,
    { code: "AUTH_RATE_LIMIT_EXCEEDED", message: "Too many authentication attempts. Please try again later." },
    429,
  ),
});

authRouter.post("/auth/register", credentialRateLimiter, validateRequest({ body: registerSchema }), async (req, res) => {
  const user = await registerUser(req.body, auditContextFrom(req));
  const accessToken = issueAccessToken({ sub: user.id, email: user.email, role: user.role });
  return sendSuccess(req, res, {
    user,
    accessToken,
    tokenType: "Bearer",
  }, 201);
});

authRouter.post("/auth/login", credentialRateLimiter, validateRequest({ body: loginSchema }), async (req, res) => {
  const user = await loginUser(req.body, auditContextFrom(req));
  const accessToken = issueAccessToken({ sub: user.id, email: user.email, role: user.role });
  return sendSuccess(req, res, {
    user,
    accessToken,
    tokenType: "Bearer",
  });
});

authRouter.get("/me", authenticate, authorizeRoles(...allRoles), async (req, res) => {
  const user = await getCurrentUser(req.auth!.id);
  return sendSuccess(req, res, { user });
});

authRouter.patch(
  "/me",
  authenticate,
  authorizeRoles(...allRoles),
  validateRequest({ body: updateMeSchema }),
  async (req, res) => {
    const user = await updateCurrentUser(
      req.auth!.id,
      req.auth!.role,
      req.body,
      auditContextFrom(req),
    );
    return sendSuccess(req, res, { user });
  },
);
