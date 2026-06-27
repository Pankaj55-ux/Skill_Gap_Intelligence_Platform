import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().trim().min(1).default("sgip-api"),
  API_PREFIX: z.string().regex(/^\/[a-zA-Z0-9/_-]*$/).default("/api/v1"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(5000),
  DATABASE_URL: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().url("DATABASE_URL must be a valid PostgreSQL connection URL")
      .default("postgresql://sgip:sgip@localhost:5432/sgip?schema=public"),
  ),
  JWT_ACCESS_SECRET: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().min(32).optional(),
  ),
  JWT_SECRET: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().optional(),
  ),
  JWT_ACCESS_EXPIRES_IN: z.string().trim().min(1).default("15m"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  JSON_BODY_LIMIT: z.string().trim().min(1).default("1mb"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  GEMINI_API_KEY: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(1).optional(),
  ),
  UPLOADS_DIR: z.string().trim().min(1).default("uploads"),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const issues = parsedEnvironment.error.issues
    .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

const { CORS_ORIGIN, JWT_SECRET, ...values } = parsedEnvironment.data;
const corsOrigins = CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (corsOrigins.length === 0) {
  throw new Error("Invalid environment configuration: CORS_ORIGIN must contain an origin");
}

const configuredJwtSecret = values.JWT_ACCESS_SECRET ?? JWT_SECRET;
const developmentJwtSecret = "sgip-development-access-secret-change-me";

if (parsedEnvironment.data.NODE_ENV === "production" && (!configuredJwtSecret || configuredJwtSecret.length < 32)) {
  throw new Error("Invalid environment configuration: JWT_ACCESS_SECRET must be at least 32 characters in production");
}

if (parsedEnvironment.data.NODE_ENV === "production" && configuredJwtSecret === developmentJwtSecret) {
  throw new Error("Invalid environment configuration: JWT_ACCESS_SECRET cannot use the development secret in production");
}

if (parsedEnvironment.data.NODE_ENV === "production" && corsOrigins.includes("*")) {
  throw new Error("Invalid environment configuration: CORS_ORIGIN cannot be '*' in production");
}

if (parsedEnvironment.data.NODE_ENV === "production" && !process.env.DATABASE_URL?.trim()) {
  throw new Error("Invalid environment configuration: DATABASE_URL is required in production");
}

export const env = Object.freeze({
  ...values,
  JWT_ACCESS_SECRET: configuredJwtSecret && configuredJwtSecret.length >= 32
    ? configuredJwtSecret
    : developmentJwtSecret,
  CORS_ORIGINS: corsOrigins,
});

export type Environment = typeof env;
