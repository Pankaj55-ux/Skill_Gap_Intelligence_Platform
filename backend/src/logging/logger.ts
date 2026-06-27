import pino from "pino";
import { env } from "../config/environment.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  base: { service: env.APP_NAME },
  transport: env.NODE_ENV === "development"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
});
