import { describe, expect, it } from "vitest";
import {
  EvidenceVerifiedStatus,
  ProficiencyLevel,
} from "../../generated/prisma/client.js";
import { runGapAnalysisSchema } from "./gap-analysis.schemas.js";
import { calculateDeterministicGapAnalysis } from "./gap-analysis.service.js";

describe("deterministic gap analysis module", () => {
  it("calculates weighted readiness with explainable components", () => {
    const result = calculateDeterministicGapAnalysis({
      profileCompletionPercentage: 80,
      requiredSkills: [
        {
          skillId: "skill-typescript",
          skillName: "TypeScript",
          requiredLevel: ProficiencyLevel.ADVANCED,
          weight: 2,
          isMandatory: true,
        },
        {
          skillId: "skill-react",
          skillName: "React",
          requiredLevel: ProficiencyLevel.INTERMEDIATE,
          weight: 1,
          isMandatory: true,
        },
      ],
      evidence: [
        {
          skillId: "skill-typescript",
          proficiency: ProficiencyLevel.INTERMEDIATE,
          verifiedStatus: EvidenceVerifiedStatus.VERIFIED,
          skill: { normalizedName: "typescript", name: "TypeScript" },
        },
      ],
    });

    expect(result.readinessScore).toBe(64.23);
    expect(result.matchedSkills).toHaveLength(0);
    expect(result.weakSkills).toHaveLength(1);
    expect(result.missingSkills).toHaveLength(1);
    expect(result.componentScores).toMatchObject({
      profileCompletion: 12,
      requiredSkillMatch: 26.67,
      evidenceStrength: 16.67,
      skillLevelCompatibility: 8.89,
    });
    expect(result.explanation).toContain("Readiness score is 64.23/100");
  });

  it("validates the run request body", () => {
    expect(runGapAnalysisSchema.safeParse({
      targetCareerRoleId: "6c671faf-3a76-4a11-90ca-698ac0ba8c54",
    }).success).toBe(true);

    expect(runGapAnalysisSchema.safeParse({
      targetCareerRoleId: "not-a-uuid",
    }).success).toBe(false);
  });
});
