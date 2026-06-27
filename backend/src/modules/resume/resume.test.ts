import { describe, expect, it } from "vitest";
import {
  extensionForMimeType,
  validateResumeFileNameAndMime,
  validateResumeSignature,
} from "./resume.validation.js";
import { ResumeParserService } from "./resume-parser.service.js";

describe("resume upload module", () => {
  it("accepts only supported resume mime types and matching extensions", () => {
    expect(extensionForMimeType("application/pdf")).toBe(".pdf");
    expect(extensionForMimeType("application/msword")).toBe(".doc");
    expect(extensionForMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(".docx");
    expect(extensionForMimeType("text/plain")).toBeNull();

    expect(() => validateResumeFileNameAndMime({
      originalname: "resume.pdf",
      mimetype: "application/pdf",
    })).not.toThrow();

    expect(() => validateResumeFileNameAndMime({
      originalname: "resume.txt",
      mimetype: "application/pdf",
    })).toThrow();
  });

  it("validates basic file signatures", () => {
    expect(() => validateResumeSignature({
      buffer: Buffer.from("%PDF-1.7"),
      mimetype: "application/pdf",
    })).not.toThrow();

    expect(() => validateResumeSignature({
      buffer: Buffer.from("not-a-pdf"),
      mimetype: "application/pdf",
    })).toThrow();
  });

  it("normalizes extracted resume text without identifying skills", () => {
    const parser = new ResumeParserService();

    expect(parser.normalizeWhitespace("  Hello\t\tworld\r\n\r\n\r\n  From resume  ")).toBe("Hello world\n\nFrom resume");
  });

  it("rejects unsupported parser formats", async () => {
    const parser = new ResumeParserService();

    await expect(parser.extractPlainText(Buffer.from("legacy doc"), "application/msword")).rejects.toMatchObject({
      code: "UNSUPPORTED_RESUME_PARSING_FORMAT",
    });
  });
});
