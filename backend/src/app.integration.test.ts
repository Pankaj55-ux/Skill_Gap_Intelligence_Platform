import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

const app = createApp();

describe("Express app integration", () => {
  it("returns a structured health response with request and security headers", async () => {
    const response = await request(app).get("/api/v1/health").expect(200);

    expect(response.body).toMatchObject({
      data: {
        status: "ok",
        service: "sgip-api",
      },
      error: null,
    });
    expect(response.body.meta.requestId).toEqual(expect.any(String));
    expect(response.headers["x-request-id"]).toEqual(response.body.meta.requestId);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("standardizes validation errors before auth services touch the database", async () => {
    const response = await request(app)
      .post("/api/v1/sgip/auth/register")
      .send({
        email: "student@example.com",
        displayName: "Student User",
        password: "StrongPass123!",
        role: "ADMIN",
      })
      .expect(400);

    expect(response.body).toMatchObject({
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
      },
    });
  });

  it("rejects malformed JSON with the standard error envelope", async () => {
    const response = await request(app)
      .post("/api/v1/sgip/auth/login")
      .set("Content-Type", "application/json")
      .send("{not-json")
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "INVALID_JSON",
      message: "Request body contains invalid JSON",
    });
  });

  it.each([
    ["GET", "/api/v1/sgip/me"],
    ["PATCH", "/api/v1/sgip/me"],
    ["GET", "/api/v1/sgip/student-profile/me"],
    ["POST", "/api/v1/sgip/student-profile"],
    ["POST", "/api/v1/sgip/resume/upload"],
    ["GET", "/api/v1/sgip/resume/me"],
    ["POST", "/api/v1/sgip/gap-analysis/run"],
    ["POST", "/api/v1/sgip/roadmap/generate"],
    ["GET", "/api/v1/sgip/roadmap"],
    ["POST", "/api/v1/sgip/interview/sessions"],
    ["GET", "/api/v1/sgip/interview/sessions"],
    ["GET", "/api/v1/sgip/notifications"],
    ["GET", "/api/v1/sgip/admin/resources"],
  ])("protects %s %s with authentication", async (method, path) => {
    const response = await request(app)[method.toLowerCase() as "get" | "post" | "patch"](path).expect(401);

    expect(response.body.error).toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
    });
  });
});
