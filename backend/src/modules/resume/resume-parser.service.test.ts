import { beforeEach, describe, expect, it, vi } from "vitest";

const pdfMocks = vi.hoisted(() => ({
  events: [] as string[],
  receivedData: undefined as unknown,
}));

vi.mock("pdf-parse", () => ({
  PDFParse: class {
    constructor(options: { data: unknown }) {
      pdfMocks.receivedData = options.data;
    }

    async getText() {
      pdfMocks.events.push("text");
      return { text: "Parsed resume" };
    }

    async getInfo() {
      pdfMocks.events.push("info");
      return { total: 2 };
    }

    async destroy() {
      pdfMocks.events.push("destroy");
    }
  },
}));

import { ResumeParserService } from "./resume-parser.service.js";

describe("ResumeParserService PDF parsing", () => {
  beforeEach(() => {
    pdfMocks.events.length = 0;
    pdfMocks.receivedData = undefined;
  });

  it("passes transferable PDF data and initializes the parser sequentially", async () => {
    const result = await new ResumeParserService().extractPlainText(
      Buffer.from("%PDF resume"),
      "application/pdf",
    );

    expect(pdfMocks.receivedData).toBeInstanceOf(Uint8Array);
    expect(Buffer.isBuffer(pdfMocks.receivedData)).toBe(false);
    expect(pdfMocks.events).toEqual(["text", "info", "destroy"]);
    expect(result).toEqual({ extractedText: "Parsed resume", pageCount: 2 });
  });
});
