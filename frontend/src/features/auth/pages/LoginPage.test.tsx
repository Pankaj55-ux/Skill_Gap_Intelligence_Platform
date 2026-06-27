import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "../../../services/auth.service";
import { useAuthStore } from "../../../store/auth.store";
import { studentUser } from "../../../test/fixtures";
import { renderWithProviders } from "../../../test/test-utils";
import { LoginPage } from "./LoginPage";

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../services/auth.service", () => ({
  authService: {
    login: vi.fn(),
  },
}));

describe("LoginPage", () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  it("submits credentials and stores the authenticated session", async () => {
    vi.mocked(authService.login).mockResolvedValue({
      user: studentUser,
      accessToken: "access-token",
      tokenType: "Bearer",
    });

    renderWithProviders(<LoginPage />, { route: "/login" });

    await userEvent.type(screen.getByLabelText(/email/i), studentUser.email);
    await userEvent.type(screen.getByLabelText(/^password$/i), "StrongPass123!");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith({
        email: studentUser.email,
        password: "StrongPass123!",
      });
    });
    expect(useAuthStore.getState()).toMatchObject({
      user: studentUser,
      accessToken: "access-token",
      isAuthenticated: true,
    });
    expect(toast.success).toHaveBeenCalledWith("Welcome back");
  });

  it("shows an inline wrong-password error for invalid credentials", async () => {
    vi.mocked(authService.login).mockRejectedValue(Object.assign(
      new Error("Email or password is incorrect"),
      {
        name: "ApiError",
        code: "INVALID_CREDENTIALS",
        isApiError: true,
      },
    ));

    renderWithProviders(<LoginPage />, { route: "/login" });

    await userEvent.type(screen.getByLabelText(/email/i), studentUser.email);
    await userEvent.type(screen.getByLabelText(/^password$/i), "IncorrectPass123!");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect((await screen.findByText("Wrong password")).textContent).toBe("Wrong password");
  });
});
