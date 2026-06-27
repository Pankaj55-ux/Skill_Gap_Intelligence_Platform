import { describe, expect, it } from "vitest";
import {
  EvidenceType,
  EvidenceVerifiedStatus,
  ProficiencyLevel,
  UserRole,
} from "../../generated/prisma/client.js";
import {
  createSkillEvidenceSchema,
  reviewSkillEvidenceSchema,
  updateOwnSkillEvidenceSchema,
} from "./skill-evidence.schemas.js";
import { canReviewSkillEvidence } from "./skill-evidence.service.js";

describe("skill evidence module", () => {
  it("validates student-created evidence", () => {
    const parsed = createSkillEvidenceSchema.parse({
      skillName: "TypeScript",
      category: "Programming",
      proficiencyLevel: ProficiencyLevel.INTERMEDIATE,
      evidenceType: EvidenceType.PROJECT,
      evidenceUrl: "https://example.com/project",
      description: "Built a typed Express API.",
    });

    expect(parsed.skillName).toBe("TypeScript");
    expect(parsed.evidenceType).toBe(EvidenceType.PROJECT);
  });

  it("keeps student updates separate from reviewer status changes", () => {
    expect(updateOwnSkillEvidenceSchema.safeParse({
      verifiedStatus: EvidenceVerifiedStatus.VERIFIED,
    }).success).toBe(false);

    const review = reviewSkillEvidenceSchema.parse({
      verifiedStatus: EvidenceVerifiedStatus.REJECTED,
    });

    expect(review.verifiedStatus).toBe(EvidenceVerifiedStatus.REJECTED);
  });

  it("allows only reviewer roles to review evidence", () => {
    expect(canReviewSkillEvidence(UserRole.STUDENT)).toBe(false);
    expect(canReviewSkillEvidence(UserRole.MENTOR)).toBe(true);
    expect(canReviewSkillEvidence(UserRole.PLACEMENT_OFFICER)).toBe(true);
    expect(canReviewSkillEvidence(UserRole.ADMIN)).toBe(true);
  });
});
