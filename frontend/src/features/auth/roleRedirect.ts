import type { UserRole } from "../../types/auth";
import { routePaths } from "../../constants/routes";

export function routeForRole(role: UserRole): string {
  if (role === "ADMIN") return routePaths.admin;
  return routePaths.dashboard;
}
