import { describe, expect, it } from "vitest";
import {
  extractDeterministicStructuredData,
  resumeStructuredDataSchema,
} from "./ai-resume-extractor.service.js";

describe("AI resume extractor", () => {
  it("validates structured resume extraction output", () => {
    const parsed = resumeStructuredDataSchema.parse({
      technicalSkills: ["REST APIs"],
      frameworks: ["Express"],
      databases: ["PostgreSQL"],
      cloud: [],
      tools: ["Git"],
      programmingLanguages: ["TypeScript"],
      softSkills: ["Communication"],
      certifications: [],
      projects: [{ name: "Skill Gap Platform" }],
      internships: [],
      education: [{ degree: "B.Tech" }],
      achievements: ["Hackathon finalist"],
      summary: "Software engineering student with project experience.",
      improvementSuggestions: ["Add measurable project outcomes."],
    });

    expect(parsed.programmingLanguages).toEqual(["TypeScript"]);
    expect(parsed.projects).toEqual([{ name: "Skill Gap Platform" }]);
    expect(parsed.summary).toContain("Software engineering");
  });

  it("rejects untrusted extra keys and invalid category shapes", () => {
    expect(resumeStructuredDataSchema.safeParse({
      technicalSkills: ["REST APIs"],
      frameworks: [],
      databases: [],
      cloud: [],
      tools: [],
      programmingLanguages: [],
      softSkills: [],
      certifications: [],
      projects: [],
      internships: [],
      education: [],
      achievements: [],
      rawResponse: "do not store this",
    }).success).toBe(false);

    expect(resumeStructuredDataSchema.safeParse({
      technicalSkills: "TypeScript",
    }).success).toBe(false);
  });

  it("provides local resume analysis when an external AI provider is unavailable", () => {
    const result = extractDeterministicStructuredData(`
      Test Candidate
      Education
      Example University 2022 - 2026
      B.Tech in Computer Science
      Projects
      • Career Platform | GitHub Jan 2026 - May 2026
      – Built a placement platform with REST APIs.
      Backend engineer experienced with Java, Spring Boot, PostgreSQL, AWS,
      Docker, REST APIs, Git, communication, and problem-solving.
      Certifications & Achievements
      – Completed AWS Cloud Practitioner certification.
      – Finalist in a national hackathon.
    `);

    expect(result.programmingLanguages).toContain("Java");
    expect(result.frameworks).toContain("Spring Boot");
    expect(result.databases).toContain("PostgreSQL");
    expect(result.cloud).toContain("AWS");
    expect(result.tools).toEqual(expect.arrayContaining(["Docker", "Git"]));
    expect(result.technicalSkills).toContain("REST API");
    expect(result.softSkills).toEqual(expect.arrayContaining(["Communication", "Problem Solving"]));
    expect(result.projects).toHaveLength(1);
    expect(result.education[0]).toMatchObject({ institution: "Example University", period: "2022 - 2026" });
    expect(result.certifications).toContain("Completed AWS Cloud Practitioner certification.");
    expect(result.achievements).toContain("Finalist in a national hackathon.");
    expect(result.summary).toContain("Test Candidate");
    expect(result.improvementSuggestions.length).toBeGreaterThan(0);
  });
});
