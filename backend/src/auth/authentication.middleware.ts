import type { RequestHandler } from "express";
import { database } from "../database/index.js";
import { RecordStatus } from "../generated/prisma/client.js";
import { AppError } from "../errors/app-error.js";
import { verifyAccessToken } from "./token.service.js";

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const authorization = req.header("authorization");
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new AppError(401, "AUTHENTICATION_REQUIRED", "A Bearer access token is required");
    }

    const payload = verifyAccessToken(match[1]);
    const user = await database.user.findFirst({
      where: { id: payload.sub, status: RecordStatus.ACTIVE, deletedAt: null },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new AppError(401, "ACCOUNT_UNAVAILABLE", "The account is unavailable");
    }

    req.auth = user;
    next();
  } catch (error) {
    next(error);
  }
};
