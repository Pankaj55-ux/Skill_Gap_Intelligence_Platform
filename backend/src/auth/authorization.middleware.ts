import type { RequestHandler } from "express";
import type { UserRole } from "../generated/prisma/client.js";
import { AppError } from "../errors/app-error.js";

export const authorizeRoles = (...allowedRoles: readonly UserRole[]): RequestHandler => (
  req,
  _res,
  next,
) => {
  if (!req.auth) {
    next(new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required"));
    return;
  }

  const normalizedAllowedRoles = new Set(allowedRoles.map((role) => String(role)));

  if (!normalizedAllowedRoles.has(String(req.auth.role))) {
    next(new AppError(403, "INSUFFICIENT_PERMISSIONS", "You do not have permission to perform this action"));
    return;
  }

  next();
};
