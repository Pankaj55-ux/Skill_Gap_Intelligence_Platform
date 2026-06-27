import type { RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { CorsOptions } from "cors";
import { sendError } from "../common/response.js";
import { env } from "../config/environment.js";

const blockedKeys = new Set(["__proto__", "constructor", "prototype"]);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const sanitizeObjectKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObjectKeys(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.entries(value).reduce<Record<string, unknown>>((sanitized, [key, child]) => {
    if (key.startsWith("$") || key.includes(".") || blockedKeys.has(key)) {
      return sanitized;
    }

    sanitized[key] = sanitizeObjectKeys(child);
    return sanitized;
  }, {});
};

const replaceObjectContents = (target: unknown, sanitized: unknown): void => {
  if (!isPlainObject(target) || !isPlainObject(sanitized)) return;

  for (const key of Object.keys(target)) {
    delete target[key];
  }

  Object.assign(target, sanitized);
};

export const securityHeaders = helmet({
  contentSecurityPolicy: env.NODE_ENV === "production"
    ? {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          formAction: ["'self'"],
        },
      }
    : false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: env.NODE_ENV === "production"
    ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
    : false,
  referrerPolicy: { policy: "no-referrer" },
});

export const corsOptions: CorsOptions = {
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  exposedHeaders: ["X-Request-Id", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
  maxAge: 600,
  origin: (origin, callback) => {
    if (!origin || env.CORS_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
};

export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => sendError(
    req,
    res,
    { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests. Please try again later." },
    429,
  ),
});

export const sanitizeRequestInput: RequestHandler = (req, _res, next) => {
  req.body = sanitizeObjectKeys(req.body);
  replaceObjectContents(req.query, sanitizeObjectKeys(req.query));
  replaceObjectContents(req.params, sanitizeObjectKeys(req.params));
  next();
};
