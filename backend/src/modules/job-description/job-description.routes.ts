import { Router, type Request } from "express";
import { authenticate, authorizeRoles } from "../../auth/index.js";
import { sendSuccess } from "../../common/response.js";
import { AppError } from "../../errors/app-error.js";
import { validateRequest } from "../../validation/validate-request.middleware.js";
import { aiJobDescriptionExtractorService } from "./ai-job-description-extractor.service.js";
import { jobDescriptionUploadMiddleware } from "./job-description-upload.middleware.js";
import {
  createJobDescriptionSchema,
  hasJobDescriptionUpdateFields,
  jobDescriptionIdParamsSchema,
  normalizeJobDescriptionBody,
  updateJobDescriptionSchema,
} from "./job-description.schemas.js";
import {
  canReadJobDescriptions,
  canWriteJobDescriptions,
  createJobDescription,
  deleteJobDescription,
  getJobDescriptionById,
  listJobDescriptions,
  updateJobDescription,
  type AuditContext,
  type UploadedJobDescriptionFile,
} from "./job-description.service.js";

const auditContextFrom = (req: Request): AuditContext => ({
  requestId: req.requestId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

const uploadedFileFrom = (req: Request): UploadedJobDescriptionFile | undefined => {
  if (!req.file) return undefined;
  return {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    buffer: req.file.buffer,
  };
};

export const jobDescriptionRouter = Router();

jobDescriptionRouter.post(
  "/job-description",
  authenticate,
  authorizeRoles(...canWriteJobDescriptions),
  jobDescriptionUploadMiddleware,
  async (req, res) => {
    const input = createJobDescriptionSchema.parse(normalizeJobDescriptionBody(req.body));
    const jobDescription = await createJobDescription(
      req.auth!.id,
      input,
      auditContextFrom(req),
      uploadedFileFrom(req),
    );
    return sendSuccess(req, res, { jobDescription }, 201);
  },
);

jobDescriptionRouter.get(
  "/job-description",
  authenticate,
  authorizeRoles(...canReadJobDescriptions),
  async (req, res) => {
    const result = await listJobDescriptions(req.auth!.role);
    return sendSuccess(req, res, result);
  },
);

jobDescriptionRouter.post(
  "/job-description/:id/analyze",
  authenticate,
  authorizeRoles(...canWriteJobDescriptions),
  validateRequest({ params: jobDescriptionIdParamsSchema }),
  async (req, res) => {
    const result = await aiJobDescriptionExtractorService.processJobDescription({
      userId: req.auth!.id,
      jobDescriptionId: String(req.params.id),
      context: auditContextFrom(req),
    });
    return sendSuccess(req, res, result, 201);
  },
);

jobDescriptionRouter.get(
  "/job-description/:id",
  authenticate,
  authorizeRoles(...canReadJobDescriptions),
  validateRequest({ params: jobDescriptionIdParamsSchema }),
  async (req, res) => {
    const jobDescription = await getJobDescriptionById(req.auth!.role, String(req.params.id));
    return sendSuccess(req, res, { jobDescription });
  },
);

jobDescriptionRouter.patch(
  "/job-description/:id",
  authenticate,
  authorizeRoles(...canWriteJobDescriptions),
  jobDescriptionUploadMiddleware,
  validateRequest({ params: jobDescriptionIdParamsSchema }),
  async (req, res) => {
    const input = updateJobDescriptionSchema.parse(normalizeJobDescriptionBody(req.body));
    const uploadedFile = uploadedFileFrom(req);
    if (!hasJobDescriptionUpdateFields(input) && !uploadedFile) {
      throw new AppError(
        400,
        "JOB_DESCRIPTION_UPDATE_REQUIRED",
        "Provide at least one job description field or upload a replacement PDF/DOCX file",
      );
    }

    const jobDescription = await updateJobDescription(
      req.auth!.id,
      String(req.params.id),
      input,
      auditContextFrom(req),
      uploadedFile,
    );
    return sendSuccess(req, res, { jobDescription });
  },
);

jobDescriptionRouter.delete(
  "/job-description/:id",
  authenticate,
  authorizeRoles(...canWriteJobDescriptions),
  validateRequest({ params: jobDescriptionIdParamsSchema }),
  async (req, res) => {
    const jobDescription = await deleteJobDescription(req.auth!.id, String(req.params.id), auditContextFrom(req));
    return sendSuccess(req, res, { jobDescription });
  },
);
