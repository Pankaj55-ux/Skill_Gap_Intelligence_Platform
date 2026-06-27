import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { authorizeRoles } from "../../auth/authorization.middleware.js";
import { issueAccessToken, verifyAccessToken } from "../../auth/token.service.js";
import { AppError } from "../../errors/app-error.js";
import { UserRole } from "../../generated/prisma/client.js";
import { registerSchema } from "./auth.schemas.js";

describe("identity and access security", () => {
  it("accepts a strong student password and rejects privileged self-registration", () => {
    const valid = registerSchema.safeParse({
      email: "Student@Example.com",
      displayName: "Demo Student",
      password: "StrongPass123!",
      role: "STUDENT",
    });
    const privileged = registerSchema.safeParse({
      email: "admin@example.com",
      displayName: "Demo Admin",
      password: "StrongPass123!",
      role: "ADMIN",
    });

    expect(valid.success).toBe(true);
    if (valid.success) expect(valid.data.email).toBe("student@example.com");
    expect(privileged.success).toBe(false);
  });

  it("issues and verifies a scoped access token", () => {
    const token = issueAccessToken({
      sub: "a4164f51-8b9f-4c5e-950f-4bf7f556cc40",
      email: "student@example.com",
      role: UserRole.STUDENT,
    });

    expect(verifyAccessToken(token)).toMatchObject({
      sub: "a4164f51-8b9f-4c5e-950f-4bf7f556cc40",
      email: "student@example.com",
      role: UserRole.STUDENT,
      type: "access",
    });
    expect(() => verifyAccessToken(`${token}tampered`)).toThrow(AppError);
  });

  it("denies a role that is not explicitly allowed", () => {
    const middleware = authorizeRoles(UserRole.ADMIN);
    const request = {
      auth: { id: "user-id", email: "student@example.com", role: UserRole.STUDENT },
    } as Request;
    const next = vi.fn() as unknown as NextFunction;

    middleware(request, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(vi.mocked(next).mock.calls[0][0]).toMatchObject({
      statusCode: 403,
      code: "INSUFFICIENT_PERMISSIONS",
    });
  });
});
