import { describe, expect, it } from "vitest";
import { SkillNormalizerService } from "./skill-normalizer.service.js";

describe("skill normalization engine", () => {
  const normalizer = new SkillNormalizerService();

  it("maps aliases to canonical skill names", () => {
    expect(normalizer.normalizeSkill({ originalSkill: "NodeJS", category: "technicalSkills" })).toMatchObject({
      originalSkill: "NodeJS",
      normalizedSkill: "Node.js",
      category: "frameworks",
    });
    expect(normalizer.normalizeSkill({ originalSkill: "React.js", category: "frameworks" }).normalizedSkill).toBe("React");
    expect(normalizer.normalizeSkill({ originalSkill: "CPP", category: "programmingLanguages" }).normalizedSkill).toBe("C++");
    expect(normalizer.normalizeSkill({ originalSkill: "Mongo", category: "databases" }).normalizedSkill).toBe("MongoDB");
  });

  it("removes duplicate normalized skills while preserving an original skill", () => {
    const skills = normalizer.normalizeSkills([
      { originalSkill: "Node", category: "technicalSkills" },
      { originalSkill: "Node.js", category: "frameworks" },
      { originalSkill: "ReactJS", category: "frameworks" },
      { originalSkill: "React", category: "technicalSkills" },
    ]);

    expect(skills.map((skill) => skill.normalizedSkill).sort()).toEqual(["Node.js", "React"]);
    expect(skills.every((skill) => skill.originalSkill.length > 0)).toBe(true);
  });

  it("normalizes skills from structured resume data", () => {
    const skills = normalizer.normalizeResumeAnalysis({
      technicalSkills: ["REST", "Node"],
      frameworks: ["ReactJS"],
      databases: ["Mongo"],
      cloud: ["AWS"],
      tools: ["Git"],
      programmingLanguages: ["C Plus Plus"],
      softSkills: ["Communication"],
      certifications: [],
      projects: [],
      internships: [],
      education: [],
      achievements: [],
      summary: "",
      improvementSuggestions: [],
    });

    expect(skills.map((skill) => skill.normalizedSkill)).toEqual(expect.arrayContaining([
      "REST API",
      "Node.js",
      "React",
      "MongoDB",
      "AWS",
      "Git",
      "C++",
      "Communication",
    ]));
  });
});
