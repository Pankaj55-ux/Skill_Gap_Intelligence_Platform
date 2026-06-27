export const openapi = {
  openapi: "3.0.3",
  info: { title: "SGIP API", version: "1.0.0", description: "Skill Gap Intelligence Platform REST API" },
  servers: [{ url: "/api/v1" }],
  components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
  paths: {
    "/auth/register": { post: { summary: "Register an account", responses: { "201": { description: "Created" } } } },
    "/auth/login": { post: { summary: "Login", responses: { "200": { description: "Authenticated" } } } },
    "/career-roles": { get: { summary: "List career roles", responses: { "200": { description: "OK" } } } },
    "/gap-analysis/generate": { post: { summary: "Generate deterministic skill gap report", security: [{ bearerAuth: [] }], responses: { "201": { description: "Generated" } } } },
    "/roadmap/generate": { post: { summary: "Generate personalized roadmap", security: [{ bearerAuth: [] }], responses: { "201": { description: "Generated" } } } }
  }
};
