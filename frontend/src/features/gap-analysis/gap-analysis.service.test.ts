import { describe, expect, it, vi } from "vitest";
import { apiClient } from "../../services/apiClient";
import { apiEnvelope } from "../../test/fixtures";
import { gapAnalysisService } from "./gap-analysis.service";

vi.mock("../../services/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("gapAnalysisService", () => {
  it("searches career roles with pagination params", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(apiEnvelope({ roles: [{ id: "role-1", title: "Frontend Developer" }] }));

    await expect(gapAnalysisService.listCareerRoles("front")).resolves.toEqual([{ id: "role-1", title: "Frontend Developer" }]);
    expect(apiClient.get).toHaveBeenCalledWith("/sgip/career-roles", {
      params: { page: 1, pageSize: 50, search: "front" },
    });
  });

  it("runs deterministic gap analysis for a target role", async () => {
    const result = {
      report: { id: "gap-1", readinessScore: 72 },
      analysis: { readinessScore: 72 },
    };
    vi.mocked(apiClient.post).mockResolvedValue(apiEnvelope(result));

    await expect(gapAnalysisService.run("role-1")).resolves.toEqual(result);
    expect(apiClient.post).toHaveBeenCalledWith("/sgip/gap-analysis/run", { targetCareerRoleId: "role-1" });
  });
});
