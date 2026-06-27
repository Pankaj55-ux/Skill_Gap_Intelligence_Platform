import path from "node:path";
import { AppError } from "../../errors/app-error.js";

export const MAX_RESUME_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const allowedMimeTypes = new Map([
  ["application/pdf", ".pdf"],
  ["application/msword", ".doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
]);

export const allowedResumeMimeTypes = Array.from(allowedMimeTypes.keys());

export const extensionForMimeType = (mimeType: string): string | null => allowedMimeTypes.get(mimeType) ?? null;

export const validateResumeFileNameAndMime = (file: {
  originalname: string;
  mimetype: string;
}): void => {
  if (file.originalname.includes("\0") || path.basename(file.originalname) !== file.originalname) {
    throw new AppError(400, "INVALID_RESUME_FILE_NAME", "Resume file name is invalid");
  }

  const expectedExtension = extensionForMimeType(file.mimetype);
  const actualExtension = path.extname(file.originalname).toLocaleLowerCase("en-US");

  if (!expectedExtension || actualExtension !== expectedExtension) {
    throw new AppError(
      400,
      "UNSUPPORTED_RESUME_FILE_TYPE",
      "Only PDF, DOC, and DOCX resumes are supported",
      { allowedMimeTypes: allowedResumeMimeTypes },
    );
  }
};

export const validateResumeSignature = (file: {
  buffer: Buffer;
  mimetype: string;
}): void => {
  const { buffer, mimetype } = file;
  const isPdf = mimetype === "application/pdf" && buffer.subarray(0, 4).toString("utf8") === "%PDF";
  const isDocx = mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    && buffer[0] === 0x50
    && buffer[1] === 0x4b;
  const isDoc = mimetype === "application/msword"
    && buffer[0] === 0xd0
    && buffer[1] === 0xcf
    && buffer[2] === 0x11
    && buffer[3] === 0xe0;

  if (!isPdf && !isDocx && !isDoc) {
    throw new AppError(
      400,
      "INVALID_RESUME_FILE_SIGNATURE",
      "Resume content does not match the declared file type",
    );
  }
};
