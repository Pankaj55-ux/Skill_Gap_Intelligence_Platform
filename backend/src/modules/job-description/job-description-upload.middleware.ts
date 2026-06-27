import type { RequestHandler } from "express";
import multer from "multer";
import { AppError } from "../../errors/app-error.js";
import {
  MAX_JOB_DESCRIPTION_FILE_SIZE_BYTES,
  validateJobDescriptionFileNameAndMime,
} from "./job-description.validation.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_JOB_DESCRIPTION_FILE_SIZE_BYTES,
    files: 1,
    fields: 10,
    fieldSize: 64 * 1024,
    parts: 11,
  },
  fileFilter: (_req, file, callback) => {
    try {
      validateJobDescriptionFileNameAndMime(file);
      callback(null, true);
    } catch (error) {
      callback(error as Error);
    }
  },
});

const multerSingleJobDescription = upload.single("file");

export const jobDescriptionUploadMiddleware: RequestHandler = (req, res, next) => {
  multerSingleJobDescription(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        next(new AppError(
          413,
          "JOB_DESCRIPTION_FILE_TOO_LARGE",
          "Job description file must not exceed 10 MB",
          { maxBytes: MAX_JOB_DESCRIPTION_FILE_SIZE_BYTES },
        ));
        return;
      }

      next(new AppError(
        400,
        "JOB_DESCRIPTION_UPLOAD_ERROR",
        "Job description upload failed",
        { code: error.code },
      ));
      return;
    }

    next(error);
  });
};
