export type UserRole = "STUDENT" | "MENTOR" | "PLACEMENT_OFFICER" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status?: string;
}

export interface AuthSession {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  rememberMe: boolean;
}
