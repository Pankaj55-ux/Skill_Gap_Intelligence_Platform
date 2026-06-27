import { Router } from "express";
import { authenticate, authorizeRoles } from "../../auth/index.js";
import { sendSuccess } from "../../common/response.js";
import { UserRole } from "../../generated/prisma/client.js";
import { validateRequest } from "../../validation/validate-request.middleware.js";
import { searchQuerySchema, type SearchQuery } from "./search.schemas.js";
import { searchAll } from "./search.service.js";

const searchReaders = [
  UserRole.STUDENT,
  UserRole.MENTOR,
  UserRole.PLACEMENT_OFFICER,
  UserRole.ADMIN,
] as const;

export const searchRouter = Router();

searchRouter.get(
  "/search",
  authenticate,
  authorizeRoles(...searchReaders),
  validateRequest({ query: searchQuerySchema }),
  async (req, res) => {
    const result = await searchAll(req.query as unknown as SearchQuery, {
      userId: req.auth!.id,
      role: req.auth!.role,
    });
    return sendSuccess(req, res, result);
  },
);
