import { describe, expect, it } from "vitest";
import {
  createStudentProfileSchema,
  updateStudentProfileSchema,
} from "./student-profile.schemas.js";
import { calculateProfileCompletionPercentage } from "./student-profile.service.js";

describe("student profile module", () => {
  it("calculates completion from filled profile fields", () => {
    expect(calculateProfileCompletionPercentage({
      fullName: "Demo Student",
      college: "Demo Institute",
      branch: "Computer Science",
      graduationYear: 2027,
      targetRole: "Full-Stack Developer",
      currentSkills: ["TypeScript", "React"],
      preferredCompanies: ["Zoho"],
      resumeUrl: null,
    })).toBe(88);
  });

  it("validates profile input and rejects client-controlled completion percentage", () => {
    const valid = createStudentProfileSchema.safeParse({
      fullName: "Demo Student",
      college: "Demo Institute",
      currentSkills: ["TypeScript", "TypeScript", "React"],
    });

    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.currentSkills).toEqual(["TypeScript", "React"]);
    }

    const invalid = updateStudentProfileSchema.safeParse({
      profileCompletionPercentage: 100,
    });

    expect(invalid.success).toBe(false);
  });
});
