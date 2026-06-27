import { describe, expect, it, vi } from "vitest";
import { apiClient } from "../../services/apiClient";
import { apiEnvelope } from "../../test/fixtures";
import { roadmapService } from "./roadmap.service";

vi.mock("../../services/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("roadmapService", () => {
  it("generates a roadmap from backend analysis", async () => {
    const roadmap = { id: "roadmap-1", title: "Frontend Roadmap" };
    vi.mocked(apiClient.post).mockResolvedValue(apiEnvelope({ roadmap }));

    await expect(roadmapService.generate()).resolves.toEqual(roadmap);
    expect(apiClient.post).toHaveBeenCalledWith("/sgip/roadmap/generate");
  });

  it("updates roadmap progress", async () => {
    const response = {
      progress: { id: "progress-1", completionPercentage: 100 },
      roadmap: { id: "roadmap-1", status: "ACTIVE", metadata: null },
      summary: { totalItems: 1, completedItems: 1, overallCompletionPercentage: 100, baseReadinessScore: 70, projectedReadinessScore: 90 },
    };
    vi.mocked(apiClient.post).mockResolvedValue(apiEnvelope(response));

    await expect(roadmapService.updateProgress({
      roadmapId: "roadmap-1",
      roadmapItemId: "item-1",
      completed: true,
    })).resolves.toEqual(response);
    expect(apiClient.post).toHaveBeenCalledWith("/sgip/progress/update", {
      roadmapId: "roadmap-1",
      roadmapItemId: "item-1",
      completed: true,
    });
  });
});
