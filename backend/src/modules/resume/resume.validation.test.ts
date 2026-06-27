import { describe, expect, it } from "vitest";
import { AppError } from "../../errors/app-error.js";
import {
  validateResumeFileNameAndMime,
  validateResumeSignature,
} from "./resume.validation.js";

describe("resume upload validation", () => {
  it("accepts matching PDF names, MIME types, and signatures", () => {
    expect(() => {
      validateResumeFileNameAndMime({
        originalname: "resume.pdf",
        mimetype: "application/pdf",
      });
      validateResumeSignature({
        buffer: Buffer.from("%PDF-1.7"),
        mimetype: "application/pdf",
      });
    }).not.toThrow();
  });

  it("rejects path traversal file names", () => {
    expect(() => validateResumeFileNameAndMime({
      originalname: "../resume.pdf",
      mimetype: "application/pdf",
    })).toThrow(AppError);
  });

  it("rejects extension and MIME mismatches", () => {
    expect(() => validateResumeFileNameAndMime({
      originalname: "resume.pdf",
      mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })).toThrow(AppError);
  });

  it("rejects content that does not match the declared type", () => {
    expect(() => validateResumeSignature({
      buffer: Buffer.from("plain text pretending to be a resume"),
      mimetype: "application/pdf",
    })).toThrow(AppError);
  });
});
