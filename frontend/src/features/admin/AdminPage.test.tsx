import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import { adminService } from "./admin.service";
import { AdminPage } from "./AdminPage";

vi.mock("./admin.service", () => ({
  adminService: {
    listResources: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    restore: vi.fn(),
    updateUserRole: vi.fn(),
  },
}));

describe("AdminPage", () => {
  beforeEach(() => {
    vi.mocked(adminService.listResources).mockResolvedValue([
      { key: "users", label: "User", readonly: false },
    ]);
    vi.mocked(adminService.list).mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it("does not offer user creation when the backend forbids it", async () => {
    renderWithProviders(<AdminPage />, { route: "/admin" });

    expect(await screen.findByText(/platform operations dashboard/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /create users/i })).toBeNull();
  });
});
