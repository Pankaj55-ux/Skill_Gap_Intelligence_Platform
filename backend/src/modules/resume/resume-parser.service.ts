import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { database } from "../../database/index.js";
import { AppError } from "../../errors/app-error.js";
import { ResumeParsingStatus } from "../../generated/prisma/client.js";

const PARSING_TIMEOUT_MS = 30_000;
const PDF_MIME_TYPE = "application/pdf";
const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface ParsedResumeText {
  extractedText: string;
  pageCount: number | null;
}

export class ResumeParserService {
  async parseAndStore(input: {
    resumeId: string;
    userId: string;
    buffer: Buffer;
    mimeType: string;
  }) {
    await database.resume.update({
      where: { id: input.resumeId },
      data: {
        parsingStatus: ResumeParsingStatus.PROCESSING,
        updatedBy: input.userId,
      },
    });

    try {
      const parsed = await this.withTimeout(this.extractPlainText(input.buffer, input.mimeType));

      if (parsed.extractedText.length === 0) {
        throw new AppError(
          422,
          "RESUME_TEXT_EMPTY",
          "No extractable text was found in the resume",
        );
      }

      const resumeText = await database.$transaction(async (transaction) => {
        const savedText = await transaction.resumeText.upsert({
          where: { resumeId: input.resumeId },
          create: {
            resumeId: input.resumeId,
            extractedText: parsed.extractedText,
            pageCount: parsed.pageCount,
          },
          update: {
            extractedText: parsed.extractedText,
            pageCount: parsed.pageCount,
            extractedAt: new Date(),
          },
          select: {
            id: true,
            resumeId: true,
            extractedText: true,
            pageCount: true,
            extractedAt: true,
          },
        });

        await transaction.resume.update({
          where: { id: input.resumeId },
          data: {
            parsingStatus: ResumeParsingStatus.COMPLETED,
            updatedBy: input.userId,
          },
        });

        return savedText;
      });

      return resumeText;
    } catch (error) {
      await database.resume.update({
        where: { id: input.resumeId },
        data: {
          parsingStatus: ResumeParsingStatus.FAILED,
          updatedBy: input.userId,
        },
      });

      if (error instanceof AppError) throw error;
      throw new AppError(
        422,
        "RESUME_PARSING_FAILED",
        "Resume could not be parsed. It may be corrupt, encrypted, or unsupported.",
      );
    }
  }

  async extractPlainText(buffer: Buffer, mimeType: string): Promise<ParsedResumeText> {
    if (mimeType === PDF_MIME_TYPE) {
      return this.extractPdfText(buffer);
    }

    if (mimeType === DOCX_MIME_TYPE) {
      return this.extractDocxText(buffer);
    }

    throw new AppError(
      415,
      "UNSUPPORTED_RESUME_PARSING_FORMAT",
      "Resume parsing currently supports PDF and DOCX only",
    );
  }

  normalizeWhitespace(text: string): string {
    return text
      .replace(/\u0000/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .trim();
  }

  private async extractPdfText(buffer: Buffer): Promise<ParsedResumeText> {
    // pdf.js transfers this value to a worker. A Node Buffer is a Uint8Array
    // subclass, but it is not transferable on every supported Node runtime.
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      // Initializing the same parser concurrently can attempt to transfer its
      // document data twice. Load it once before requesting the metadata.
      const textResult = await parser.getText();
      const infoResult = await parser.getInfo();

      return {
        extractedText: this.normalizeWhitespace(textResult.text),
        pageCount: typeof infoResult.total === "number" ? infoResult.total : null,
      };
    } finally {
      await parser.destroy();
    }
  }

  private async extractDocxText(buffer: Buffer): Promise<ParsedResumeText> {
    const result = await mammoth.extractRawText({ buffer });
    return {
      extractedText: this.normalizeWhitespace(result.value),
      pageCount: null,
    };
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        reject(new AppError(
          408,
          "RESUME_PARSING_TIMEOUT",
          "Resume parsing exceeded the 30 second timeout",
        ));
      }, PARSING_TIMEOUT_MS);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}

export const resumeParserService = new ResumeParserService();
