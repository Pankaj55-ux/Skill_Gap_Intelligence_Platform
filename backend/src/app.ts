import cors from "cors";
import express from "express";
import { requestIdMiddleware } from "./common/middleware/request-id.middleware.js";
import { env } from "./config/environment.js";
import { errorHandler, notFoundHandler } from "./errors/error-handler.js";
import { requestLogger } from "./logging/request-logger.middleware.js";
import { adminConsoleRouter } from "./modules/admin-console/index.js";
import { careerRoleRouter } from "./modules/career-role-catalog/index.js";
import { courseRecommendationRouter } from "./modules/course-recommendations/index.js";
import { gapAnalysisRouter } from "./modules/gap-analysis/index.js";
import { authRouter } from "./modules/identity-and-access/auth.routes.js";
import { interviewEvaluationRouter } from "./modules/interview-evaluation/index.js";
import { jobDescriptionRouter } from "./modules/job-description/index.js";
import { liveInterviewRouter } from "./modules/live-interview/index.js";
import { notificationRouter } from "./modules/notifications/index.js";
import { platformRouter } from "./modules/platform.routes.js";
import { progressRouter } from "./modules/progress-tracking/index.js";
import { projectRecommendationRouter } from "./modules/project-recommendations/index.js";
import { dashboardRouter, searchRouter } from "./modules/reports/index.js";
import { resumeJobMatchRouter } from "./modules/resume-job-match/index.js";
import { resumeRouter } from "./modules/resume/index.js";
import { roadmapRouter } from "./modules/roadmap/index.js";
import { skillEvidenceRouter } from "./modules/skill-evidence/index.js";
import { studentProfileRouter } from "./modules/student-profile/index.js";
import {
  apiRateLimiter,
  corsOptions,
  sanitizeRequestInput,
  securityHeaders,
} from "./security/security.middleware.js";

export const createApp = (): express.Express => {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(requestIdMiddleware);
  app.use(requestLogger);
  app.use(securityHeaders);
  app.use(cors(corsOptions));
  app.use(express.json({ limit: env.JSON_BODY_LIMIT, strict: true }));
  app.use(express.urlencoded({ extended: false, limit: env.JSON_BODY_LIMIT }));
  app.use(sanitizeRequestInput);
  app.use(apiRateLimiter);

  app.use(env.API_PREFIX, platformRouter);
  app.use(`${env.API_PREFIX}/sgip`, authRouter);
  app.use(`${env.API_PREFIX}/sgip`, adminConsoleRouter);
  app.use(`${env.API_PREFIX}/sgip`, careerRoleRouter);
  app.use(`${env.API_PREFIX}/sgip`, courseRecommendationRouter);
  app.use(`${env.API_PREFIX}/sgip`, gapAnalysisRouter);
  app.use(`${env.API_PREFIX}/sgip`, jobDescriptionRouter);
  app.use(`${env.API_PREFIX}/sgip`, interviewEvaluationRouter);
  app.use(`${env.API_PREFIX}/sgip`, liveInterviewRouter);
  app.use(`${env.API_PREFIX}/sgip`, notificationRouter);
  app.use(`${env.API_PREFIX}/sgip`, progressRouter);
  app.use(`${env.API_PREFIX}/sgip`, projectRecommendationRouter);
  app.use(`${env.API_PREFIX}/sgip`, dashboardRouter);
  app.use(`${env.API_PREFIX}/sgip`, searchRouter);
  app.use(`${env.API_PREFIX}/sgip`, resumeJobMatchRouter);
  app.use(`${env.API_PREFIX}/sgip`, resumeRouter);
  app.use(`${env.API_PREFIX}/sgip`, roadmapRouter);
  app.use(`${env.API_PREFIX}/sgip`, skillEvidenceRouter);
  app.use(`${env.API_PREFIX}/sgip`, studentProfileRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export const app = createApp();
