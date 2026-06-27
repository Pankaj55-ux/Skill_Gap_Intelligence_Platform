import { describe, expect, it, vi } from "vitest";
import { apiClient } from "../../services/apiClient";
import { apiEnvelope } from "../../test/fixtures";
import { resumeService } from "./resume.service";

vi.mock("../../services/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("resumeService", () => {
  it("uploads resumes as multipart form data", async () => {
    const resume = {
      id: "resume-1",
      userId: "user-1",
      originalFileName: "resume.pdf",
      storedFileName: "resume.pdf",
      mimeType: "application/pdf",
      fileSize: 12,
      fileUrl: "https://example.com/resume.pdf",
      uploadedAt: "2026-06-26T10:00:00.000Z",
      parsingStatus: "PENDING" as const,
      createdAt: "2026-06-26T10:00:00.000Z",
      updatedAt: "2026-06-26T10:00:00.000Z",
    };
    vi.mocked(apiClient.post).mockResolvedValue(apiEnvelope({ resume }));

    const file = new File(["%PDF-1.7"], "resume.pdf", { type: "application/pdf" });
    await expect(resumeService.uploadResume(file)).resolves.toEqual(resume);

    expect(apiClient.post).toHaveBeenCalledWith(
      "/sgip/resume/upload",
      expect.any(FormData),
      expect.objectContaining({
        onUploadProgress: undefined,
      }),
    );

    const formData = vi.mocked(apiClient.post).mock.calls[0]?.[1] as FormData;
    expect(formData.get("resume")).toBe(file);
  });

  it("runs resume parsing through the analyze endpoint", async () => {
    const result = {
      analysis: {
        id: "analysis-1",
        resumeId: "resume-1",
        structuredData: {
          technicalSkills: ["React"],
          frameworks: [],
          databases: [],
          cloud: [],
          tools: [],
          programmingLanguages: ["TypeScript"],
          softSkills: [],
          certifications: [],
          projects: [],
          internships: [],
          education: [],
          achievements: [],
          summary: "",
          improvementSuggestions: [],
        },
        aiModel: "mock-ai",
        promptVersion: "test",
        executionTimeMs: 10,
        confidence: 0.9,
        createdAt: "2026-06-26T10:00:00.000Z",
        updatedAt: "2026-06-26T10:00:00.000Z",
      },
      normalizedSkills: [],
    };
    vi.mocked(apiClient.post).mockResolvedValue(apiEnvelope(result));

    await expect(resumeService.analyzeResume("resume-1")).resolves.toEqual(result);
    expect(apiClient.post).toHaveBeenCalledWith("/sgip/resume/resume-1/analyze");
  });
});
