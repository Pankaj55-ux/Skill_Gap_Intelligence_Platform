import { describe, expect, it, vi } from "vitest";
import { apiClient } from "../../services/apiClient";
import { apiEnvelope } from "../../test/fixtures";
import { interviewService } from "./interview.service";

vi.mock("../../services/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("interviewService", () => {
  it("starts an interview with generated expected topics", async () => {
    const session = { id: "session-1", status: "ACTIVE" };
    vi.mocked(apiClient.post).mockResolvedValue(apiEnvelope({ session }));

    await expect(interviewService.startSession({
      targetRole: "Frontend Developer",
      interviewType: "MIXED",
      difficulty: "MEDIUM",
      questionCount: 5,
      resumeId: "resume-1",
      jobDescriptionId: "",
      durationMinutes: 30,
    })).resolves.toEqual(session);

    expect(apiClient.post).toHaveBeenCalledWith("/sgip/interview/sessions", expect.objectContaining({
      targetRole: "Frontend Developer",
      resumeId: "resume-1",
      durationMinutes: 30,
      questionCount: 5,
      expectedTopics: expect.arrayContaining([
        "Interview type: MIXED",
        "Difficulty: MEDIUM",
        "technical fundamentals",
        "communication",
      ]),
    }));
  });

  it("submits and completes interview answers", async () => {
    const answerResponse = { session: { id: "session-1" }, nextQuestion: null };
    vi.mocked(apiClient.post).mockResolvedValue(apiEnvelope(answerResponse));

    await expect(interviewService.submitTextAnswer("session-1", "My answer")).resolves.toEqual(answerResponse);
    expect(apiClient.post).toHaveBeenCalledWith("/sgip/interview/sessions/session-1/answer", { answer: "My answer" });
  });
});
