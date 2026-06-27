import path from "node:path";
import { AppError } from "../../errors/app-error.js";

export const MAX_JOB_DESCRIPTION_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const allowedMimeTypes = new Map([
  ["application/pdf", ".pdf"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
]);

export const allowedJobDescriptionMimeTypes = Array.from(allowedMimeTypes.keys());

export const validateJobDescriptionFileNameAndMime = (file: {
  originalname: string;
  mimetype: string;
}): void => {
  if (file.originalname.includes("\0") || path.basename(file.originalname) !== file.originalname) {
    throw new AppError(400, "INVALID_JOB_DESCRIPTION_FILE_NAME", "Job description file name is invalid");
  }

  const expectedExtension = allowedMimeTypes.get(file.mimetype);
  const actualExtension = path.extname(file.originalname).toLocaleLowerCase("en-US");

  if (!expectedExtension || actualExtension !== expectedExtension) {
    throw new AppError(
      400,
      "UNSUPPORTED_JOB_DESCRIPTION_FILE_TYPE",
      "Only PDF and DOCX job description files are supported",
      { allowedMimeTypes: allowedJobDescriptionMimeTypes },
    );
  }
};

export const validateJobDescriptionSignature = (file: {
  buffer: Buffer;
  mimetype: string;
}): void => {
  const isPdf = file.mimetype === "application/pdf"
    && file.buffer.subarray(0, 4).toString("utf8") === "%PDF";
  const isDocx = file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    && file.buffer[0] === 0x50
    && file.buffer[1] === 0x4b;

  if (!isPdf && !isDocx) {
    throw new AppError(
      400,
      "INVALID_JOB_DESCRIPTION_FILE_SIGNATURE",
      "Job description file content does not match the declared file type",
    );
  }
};
