import { describe, expect, it } from "vitest";
import { evaluateDeterministicAnswer } from "./interview-evaluation.service.js";

describe("deterministic interview evaluation", () => {
  it("scores topic coverage and returns actionable feedback", () => {
    const result = evaluateDeterministicAnswer({
      question: "How would you debug a slow API?",
      studentAnswer: "First I inspect observability metrics and logs. Then I profile database queries because an index may be missing. I compare latency before and after the fix.",
      expectedTopics: ["observability", "logs", "database queries"],
      resumeContext: null,
    });

    expect(result.technicalScore).toBeGreaterThan(60);
    expect(result.strengths.length).toBeGreaterThan(0);
    expect(result.improvementPlan.length).toBeGreaterThan(0);
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("identifies missing concepts in a brief answer", () => {
    const result = evaluateDeterministicAnswer({
      question: "Explain a resilient API design.",
      studentAnswer: "I would make it reliable.",
      expectedTopics: ["timeouts", "retries", "idempotency"],
      resumeContext: null,
    });

    expect(result.missingConcepts).toEqual(["timeouts", "retries", "idempotency"]);
    expect(result.weaknesses).toContain("The answer is too brief to demonstrate depth");
  });
});
