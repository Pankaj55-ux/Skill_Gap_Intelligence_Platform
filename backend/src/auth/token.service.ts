import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/environment.js";
import { UserRole } from "../generated/prisma/client.js";
import { AppError } from "../errors/app-error.js";

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: "access";
}

export const issueAccessToken = (user: Omit<AccessTokenPayload, "type">): string => jwt.sign(
  { ...user, type: "access" },
  env.JWT_ACCESS_SECRET,
  {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
    issuer: env.APP_NAME,
    audience: "sgip-api",
  },
);

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: env.APP_NAME,
      audience: "sgip-api",
    });

    if (
      typeof payload === "string"
      || typeof payload.sub !== "string"
      || typeof payload.email !== "string"
      || !Object.values(UserRole).includes(payload.role as UserRole)
      || payload.type !== "access"
    ) {
      throw new Error("Unexpected token payload");
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role as UserRole,
      type: "access",
    };
  } catch {
    throw new AppError(401, "INVALID_ACCESS_TOKEN", "Access token is invalid or expired");
  }
};
