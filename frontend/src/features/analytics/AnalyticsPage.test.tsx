import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { studentDashboard } from "../../test/fixtures";
import { renderWithProviders } from "../../test/test-utils";
import { useAuthStore } from "../../store/auth.store";
import { adminService } from "../admin/admin.service";
import { dashboardService } from "../dashboard/dashboard.service";
import { AnalyticsPage } from "./AnalyticsPage";

vi.mock("../admin/admin.service", () => ({
  adminService: {
    list: vi.fn(),
  },
}));

vi.mock("../dashboard/dashboard.service", () => ({
  dashboardService: {
    getStudentDashboard: vi.fn(),
  },
}));

describe("AnalyticsPage", () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  it("renders analytics returned by the dashboard API", async () => {
    vi.mocked(dashboardService.getStudentDashboard).mockResolvedValue(studentDashboard);

    renderWithProviders(<AnalyticsPage />, { route: "/analytics" });

    expect(await screen.findByText(/placement readiness intelligence/i)).toBeTruthy();
    expect(screen.getByText(/strong skills/i)).toBeTruthy();
    expect(screen.getByText(/weak skills/i)).toBeTruthy();
  });

  it("renders platform analytics for an administrator without calling the student dashboard", async () => {
    useAuthStore.getState().setSession({
      user: {
        id: "admin-1",
        email: "admin@example.com",
        displayName: "Admin",
        role: "ADMIN",
        status: "ACTIVE",
      },
      accessToken: "admin-token",
      rememberMe: false,
    });
    vi.mocked(adminService.list).mockImplementation(async (resource, params) => {
      const total = resource === "reports" ? 1 : params.role === "STUDENT" ? 8 : 1;
      return {
        items: resource === "reports" ? [{ id: "report-1", readinessScore: 82 }] : [],
        pagination: { page: 1, limit: params.limit, total, totalPages: 1 },
      };
    });

    renderWithProviders(<AnalyticsPage />, { route: "/analytics" });

    expect(await screen.findByText(/platform analytics dashboard/i)).toBeTruthy();
    expect(screen.getByText(/total accounts/i)).toBeTruthy();
    expect(dashboardService.getStudentDashboard).not.toHaveBeenCalled();
  });
});
