import { describe, expect, it } from "vitest";
import { ProficiencyLevel, RecordStatus } from "../../generated/prisma/client.js";
import { searchQuerySchema } from "./search.schemas.js";

describe("global search module", () => {
  it("parses pagination, sorting, resources, and filters", () => {
    const query = searchQuerySchema.parse({
      q: "developer",
      resources: "careerRoles,gapReports",
      page: "2",
      limit: "10",
      sort: "readiness",
      status: RecordStatus.ACTIVE,
      level: ProficiencyLevel.INTERMEDIATE,
    });

    expect(query).toMatchObject({
      q: "developer",
      resources: ["careerRoles", "gapReports"],
      page: 2,
      limit: 10,
      sort: "readiness",
      status: RecordStatus.ACTIVE,
      level: ProficiencyLevel.INTERMEDIATE,
    });
  });

  it("rejects unsupported resources", () => {
    expect(searchQuerySchema.safeParse({
      resources: "unknown",
    }).success).toBe(false);
  });
});
