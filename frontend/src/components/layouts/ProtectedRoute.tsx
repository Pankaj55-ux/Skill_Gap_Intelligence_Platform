import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { GlobalLoading } from "../feedback/GlobalLoading";
import { useAuth } from "../../providers/AuthProvider";
import type { UserRole } from "../../types/auth";

interface ProtectedRouteProps {
  roles?: UserRole[];
  children?: ReactNode;
}

export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.isLoading) return <GlobalLoading />;

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && auth.user && !roles.includes(auth.user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children ?? <Outlet />;
}
