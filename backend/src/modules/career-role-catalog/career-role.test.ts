import { describe, expect, it } from "vitest";
import { ProficiencyLevel, RecordStatus } from "../../generated/prisma/client.js";
import {
  createCareerRoleSchema,
  listCareerRolesQuerySchema,
  updateCareerRoleSchema,
} from "./career-role.schemas.js";

describe("career role catalog module", () => {
  it("validates create input and normalizes duplicate list values", () => {
    const parsed = createCareerRoleSchema.parse({
      title: "Backend Developer",
      description: "Builds APIs and data services.",
      level: ProficiencyLevel.ADVANCED,
      requiredSkills: ["Node.js", "Node.js", "PostgreSQL"],
      niceToHaveSkills: ["Docker"],
      minExperience: 2,
      roadmapTags: ["backend", "apis"],
      status: RecordStatus.ACTIVE,
    });

    expect(parsed.requiredSkills).toEqual(["Node.js", "PostgreSQL"]);
    expect(parsed.level).toBe(ProficiencyLevel.ADVANCED);
  });

  it("rejects empty updates and parses pagination filters", () => {
    expect(updateCareerRoleSchema.safeParse({}).success).toBe(false);

    const query = listCareerRolesQuerySchema.parse({
      page: "2",
      pageSize: "10",
      title: "developer",
      level: ProficiencyLevel.INTERMEDIATE,
      skill: "React",
    });

    expect(query).toMatchObject({
      page: 2,
      pageSize: 10,
      title: "developer",
      skill: "React",
    });
  });
});
