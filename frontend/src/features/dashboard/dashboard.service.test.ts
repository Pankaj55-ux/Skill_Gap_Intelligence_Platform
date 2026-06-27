import { describe, expect, it, vi } from "vitest";
import { apiClient } from "../../services/apiClient";
import { apiEnvelope, studentDashboard } from "../../test/fixtures";
import { dashboardService } from "./dashboard.service";

vi.mock("../../services/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe("dashboardService", () => {
  it("loads dashboard analytics from the backend", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(apiEnvelope({ dashboard: studentDashboard }));

    await expect(dashboardService.getStudentDashboard()).resolves.toEqual(studentDashboard);
    expect(apiClient.get).toHaveBeenCalledWith("/sgip/dashboard");
  });
});
