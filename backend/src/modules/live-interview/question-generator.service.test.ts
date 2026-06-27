import { describe, expect, it } from "vitest";
import { generateDeterministicQuestion } from "./question-generator.service.js";

describe("deterministic interview question generation", () => {
  it("generates a role-aware first question when the AI provider is unavailable", () => {
    const result = generateDeterministicQuestion({
      targetRole: "Backend Developer",
      expectedTopics: ["Difficulty: HARD", "Node.js", "PostgreSQL"],
      resumeContext: "{\"projects\":[{\"name\":\"InterviewIQ\"}]}",
      transcript: "",
      previousAnswer: null,
      questionCount: 0,
    });

    expect(result.question).toContain("Backend Developer");
    expect(result.expectedTopics.length).toBeGreaterThan(0);
    expect(result.difficulty).toBe("ADVANCED");
    expect(result.aiModel).toBe("deterministic-interview-v1");
  });

  it("adapts the next question to the previous answer", () => {
    const result = generateDeterministicQuestion({
      targetRole: "Frontend Developer",
      expectedTopics: ["Difficulty: MEDIUM", "React"],
      resumeContext: null,
      transcript: "Question 1: Tell me about yourself.",
      previousAnswer: "I used React Query to manage server state.",
      questionCount: 1,
    });

    expect(result.question).toContain("React Query");
    expect(result.expectedTopics).toContain("trade-offs");
  });
});
