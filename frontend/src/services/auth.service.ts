import { apiClient } from "./apiClient";
import type { ApiResponse } from "../types/api";
import type { AuthUser } from "../types/auth";
import type { AuthResponse, LoginRequest, RegisterRequest } from "../features/auth/auth.types";

interface CurrentUserResponse {
  user: AuthUser;
}

export const authService = {
  async login(payload: LoginRequest) {
    const response = await apiClient.post<ApiResponse<AuthResponse>>("/sgip/auth/login", payload);
    return response.data.data;
  },

  async register(payload: RegisterRequest) {
    const response = await apiClient.post<ApiResponse<AuthResponse>>("/sgip/auth/register", payload);
    return response.data.data;
  },

  async currentUser() {
    const response = await apiClient.get<ApiResponse<CurrentUserResponse>>("/sgip/me");
    return response.data.data.user;
  },
};
