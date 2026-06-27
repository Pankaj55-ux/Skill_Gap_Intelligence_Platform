import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("HTTP foundation", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = await new Promise<Server>((resolve) => {
      const instance = createApp().listen(0, "127.0.0.1", () => resolve(instance));
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  it("returns the standard success envelope and propagates a request ID", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { "x-request-id": "foundation-test" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("foundation-test");
    expect(body).toMatchObject({
      data: { status: "ok", service: "sgip-api" },
      meta: { requestId: "foundation-test" },
      error: null,
    });
    expect(body.meta.timestamp).toEqual(expect.any(String));
  });

  it("returns the standard error envelope for an unknown route", async () => {
    const response = await fetch(`${baseUrl}/api/v1/unknown`);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      data: null,
      error: { code: "ROUTE_NOT_FOUND", details: null },
    });
    expect(body.meta.requestId).toEqual(expect.any(String));
  });

  it("rejects privileged public registration before reaching the database", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "admin@example.com",
        displayName: "Demo Admin",
        password: "StrongPass123!",
        role: "ADMIN",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      data: null,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("protects the current-user route on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/me`);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("protects student profile writes on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/student-profile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fullName: "Demo Student" }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("protects career role catalog writes on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/career-roles`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Backend Developer",
        level: "INTERMEDIATE",
        requiredSkills: ["Node.js"],
        niceToHaveSkills: [],
        minExperience: 1,
        roadmapTags: ["backend"],
        status: "ACTIVE",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("protects skill evidence writes on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/skill-evidence`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        skillName: "TypeScript",
        category: "Programming",
        proficiencyLevel: "INTERMEDIATE",
        evidenceType: "PROJECT",
        evidenceUrl: "https://example.com/project",
        description: "Built a typed API.",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("protects deterministic gap analysis runs on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/gap-analysis/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetCareerRoleId: "6c671faf-3a76-4a11-90ca-698ac0ba8c54",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("protects roadmap generation on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/roadmap/generate`, {
      method: "POST",
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("protects progress updates on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/progress/update`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        roadmapId: "6c671faf-3a76-4a11-90ca-698ac0ba8c54",
        roadmapItemId: "1",
        completed: true,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("protects the dashboard on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/dashboard`);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("protects global search on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/search?q=developer`);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("protects resume uploads on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/resume/upload`, {
      method: "POST",
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("protects job description writes on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/job-description`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Backend Developer",
        company: "Demo Corp",
        description: "We need Node.js, TypeScript, PostgreSQL, and REST API experience.",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("protects resume-job matching on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/match/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resumeId: "6c671faf-3a76-4a11-90ca-698ac0ba8c54",
        jobDescriptionId: "6c671faf-3a76-4a11-90ca-698ac0ba8c54",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("protects AI project recommendations on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/projects/recommend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetRole: "Backend Developer",
        resumeAnalysisId: "6c671faf-3a76-4a11-90ca-698ac0ba8c54",
        roadmapId: "6c671faf-3a76-4a11-90ca-698ac0ba8c54",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("protects AI course recommendations on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/courses/recommend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        roadmapId: "6c671faf-3a76-4a11-90ca-698ac0ba8c54",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("protects interview evaluation on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/interview/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "Explain event loop in Node.js.",
        studentAnswer: "The event loop handles async callbacks and non-blocking IO.",
        expectedTopics: ["event loop", "callback queue", "non-blocking IO"],
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("protects live interview sessions on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/interview/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetRole: "Backend Developer",
        durationMinutes: 30,
        expectedTopics: ["Node.js", "PostgreSQL"],
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("protects notifications on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/notifications`);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("protects admin console on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/admin/resources`);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("protects AI resume analysis on the backend", async () => {
    const response = await fetch(`${baseUrl}/api/v1/sgip/resume/6c671faf-3a76-4a11-90ca-698ac0ba8c54/analyze`, {
      method: "POST",
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      data: null,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });
});
