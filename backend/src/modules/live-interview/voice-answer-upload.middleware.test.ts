import { describe, expect, it } from "vitest";
import { AppError } from "../../errors/app-error.js";
import { validateAudioSignature } from "./voice-answer-upload.middleware.js";

describe("voice answer validation", () => {
  it("accepts a WEBM audio signature", () => {
    expect(() => validateAudioSignature({
      buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
      mimetype: "audio/webm",
    })).not.toThrow();
  });

  it("rejects spoofed audio content", () => {
    expect(() => validateAudioSignature({
      buffer: Buffer.from("not audio"),
      mimetype: "audio/webm",
    })).toThrow(AppError);
  });
});
