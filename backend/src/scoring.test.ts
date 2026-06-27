import { describe, expect, it } from "vitest";
import { calculateGap } from "./scoring.js";

describe("deterministic skill gap scoring", () => {
  const requirements: any = [
    { skillName: "JavaScript", weight: 10, requiredLevel: "Advanced" },
    { skillName: "React", weight: 10, requiredLevel: "Intermediate" },
    { skillName: "Git", weight: 5, requiredLevel: "Beginner" }
  ];
  it("returns zero for no skills", () => {
    expect(calculateGap(requirements, []).readinessScore).toBe(0);
  });
  it("applies 30/70/100 level factors and weights", () => {
    const result = calculateGap(requirements, [
      { name: "JavaScript", proficiency: "Advanced" },
      { name: "React", proficiency: "Intermediate" },
      { name: "Git", proficiency: "Beginner" }
    ]);
    expect(result.readinessScore).toBe(74);
    expect(result.missingSkills).toHaveLength(0);
  });
  it("matches skill names case-insensitively", () => {
    expect(calculateGap(requirements, [{ name: "javascript", proficiency: "Advanced" }]).matchedSkills).toHaveLength(1);
  });
});
