import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { studentDashboard } from "../../test/fixtures";
import { renderWithProviders } from "../../test/test-utils";
import { dashboardService } from "./dashboard.service";
import { DashboardPage } from "./DashboardPage";

vi.mock("./dashboard.service", () => ({
  dashboardService: {
    getStudentDashboard: vi.fn(),
  },
}));

describe("DashboardPage", () => {
  it("renders backend dashboard metrics", async () => {
    vi.mocked(dashboardService.getStudentDashboard).mockResolvedValue(studentDashboard);

    renderWithProviders(<DashboardPage />, { route: "/dashboard" });

    expect(await screen.findByText(/welcome, demo student/i)).toBeTruthy();
    expect(screen.getByText(/profile completion/i)).toBeTruthy();
    expect(screen.getByText(/readiness score/i)).toBeTruthy();
    expect(screen.getAllByText(/frontend developer/i).length).toBeGreaterThan(0);
  });
});
