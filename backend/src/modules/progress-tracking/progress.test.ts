import { describe, expect, it } from "vitest";
import { updateProgressSchema } from "./progress.schemas.js";

describe("progress tracking module", () => {
  it("validates progress updates and normalizes numeric roadmap item ids", () => {
    const parsed = updateProgressSchema.parse({
      roadmapId: "6c671faf-3a76-4a11-90ca-698ac0ba8c54",
      roadmapItemId: 2,
      completionPercentage: 50,
      notes: "Finished practice tasks.",
    });

    expect(parsed.roadmapItemId).toBe("2");
    expect(parsed.completionPercentage).toBe(50);
  });

  it("rejects empty progress updates", () => {
    expect(updateProgressSchema.safeParse({
      roadmapId: "6c671faf-3a76-4a11-90ca-698ac0ba8c54",
      roadmapItemId: "1",
    }).success).toBe(false);
  });
});
