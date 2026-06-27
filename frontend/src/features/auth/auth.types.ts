import type { AuthUser, UserRole } from "../../types/auth";

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  tokenType: "Bearer";
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  displayName: string;
  password: string;
  role: Extract<UserRole, "STUDENT">;
}
