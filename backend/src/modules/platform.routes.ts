import { Router } from "express";
import { sendSuccess } from "../common/response.js";
import { env } from "../config/environment.js";

export const platformRouter = Router();

platformRouter.get("/health", (req, res) => sendSuccess(req, res, {
  status: "ok",
  service: env.APP_NAME,
  environment: env.NODE_ENV,
  uptimeSeconds: Math.floor(process.uptime()),
}));

platformRouter.get("/sgip", (req, res) => sendSuccess(req, res, {
  name: "Skill Gap Intelligence Platform",
  status: "foundation-ready",
}));
