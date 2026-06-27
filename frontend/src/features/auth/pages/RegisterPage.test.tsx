import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "../../../services/auth.service";
import { useAuthStore } from "../../../store/auth.store";
import { studentUser } from "../../../test/fixtures";
import { renderWithProviders } from "../../../test/test-utils";
import { RegisterPage } from "./RegisterPage";

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../services/auth.service", () => ({
  authService: {
    register: vi.fn(),
  },
}));

describe("RegisterPage", () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  it("registers a student account and saves the session", async () => {
    vi.mocked(authService.register).mockResolvedValue({
      user: studentUser,
      accessToken: "new-access-token",
      tokenType: "Bearer",
    });

    renderWithProviders(<RegisterPage />, { route: "/register" });

    await userEvent.type(screen.getByLabelText(/full name/i), studentUser.displayName);
    await userEvent.type(screen.getByLabelText(/email/i), studentUser.email);
    await userEvent.type(screen.getByLabelText(/^password$/i), "StrongPass123!");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "StrongPass123!");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith({
        email: studentUser.email,
        displayName: studentUser.displayName,
        password: "StrongPass123!",
        role: "STUDENT",
      });
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(toast.success).toHaveBeenCalledWith("Account created");
  });

  it("does not offer privileged roles for self-registration", () => {
    renderWithProviders(<RegisterPage />, { route: "/register" });

    expect(screen.queryByLabelText(/role/i)).toBeNull();
    expect(screen.queryByRole("option", { name: /admin/i })).toBeNull();
    expect(screen.queryByRole("option", { name: /mentor/i })).toBeNull();
    expect(screen.queryByRole("option", { name: /placement officer/i })).toBeNull();
  });
});
