import { describe, expect, it } from "vitest";
import { generateRoadmapPlan } from "./roadmap.service.js";

describe("roadmap generation module", () => {
  it("generates deterministic roadmap phases from missing and weak skills", () => {
    const plan = generateRoadmapPlan({
      readinessScore: 42,
      missingSkills: [
        { skillName: "TypeScript" },
        { skillName: "PostgreSQL" },
      ],
      weakSkills: [
        { skillName: "React" },
      ],
    });

    expect(plan.difficulty).toBe("FOUNDATIONAL");
    expect(plan.phases).toHaveLength(4);
    expect(plan.phases[0]).toMatchObject({
      title: "Phase 1 - High Priority Skill Recovery",
      priority: "HIGH",
      completionStatus: "NOT_STARTED",
      orderNumber: 1,
    });
    expect(plan.phases[0].skillsCovered).toEqual(["TypeScript", "PostgreSQL"]);
    expect(plan.phases[3].title).toBe("Final Placement Preparation");
  });

  it("uses readiness score to adjust roadmap difficulty", () => {
    expect(generateRoadmapPlan({
      readinessScore: 49,
      missingSkills: [{ skillName: "Node.js" }],
      weakSkills: [],
    }).difficulty).toBe("FOUNDATIONAL");

    expect(generateRoadmapPlan({
      readinessScore: 60,
      missingSkills: [{ skillName: "Node.js" }],
      weakSkills: [],
    }).difficulty).toBe("ACCELERATED");

    expect(generateRoadmapPlan({
      readinessScore: 82,
      missingSkills: [{ skillName: "Node.js" }],
      weakSkills: [],
    }).difficulty).toBe("PLACEMENT_READY");
  });
});
