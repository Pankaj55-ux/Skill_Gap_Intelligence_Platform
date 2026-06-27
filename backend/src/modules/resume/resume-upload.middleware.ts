import type { RequestHandler } from "express";
import multer from "multer";
import { AppError } from "../../errors/app-error.js";
import {
  MAX_RESUME_FILE_SIZE_BYTES,
  validateResumeFileNameAndMime,
} from "./resume.validation.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_RESUME_FILE_SIZE_BYTES,
    files: 1,
    fields: 10,
    fieldSize: 64 * 1024,
    parts: 11,
  },
  fileFilter: (_req, file, callback) => {
    try {
      validateResumeFileNameAndMime(file);
      callback(null, true);
    } catch (error) {
      callback(error as Error);
    }
  },
});

const multerSingleResume = upload.single("resume");

export const resumeUploadMiddleware: RequestHandler = (req, res, next) => {
  multerSingleResume(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        next(new AppError(
          413,
          "RESUME_FILE_TOO_LARGE",
          "Resume file must not exceed 10 MB",
          { maxBytes: MAX_RESUME_FILE_SIZE_BYTES },
        ));
        return;
      }

      next(new AppError(400, "RESUME_UPLOAD_ERROR", "Resume upload failed", { code: error.code }));
      return;
    }

    next(error);
  });
};
