import { describe, expect, it } from "vitest";
import { aiService } from "./ai.js";

describe("AI-safe local fallbacks", () => {
  it("extracts only allow-listed skills", () => {
    expect(aiService.extractResumeSkills("Built APIs with React and Node.js", ["React", "Node.js", "Python"])).toEqual(["React", "Node.js"]);
  });
  it("turns feedback into bounded actions", () => {
    expect(aiService.summarizeFeedback("Practice SQL. Build one dashboard. Improve communication. Update resume. Extra item.")).toHaveLength(4);
  });
});
