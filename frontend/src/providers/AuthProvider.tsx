import { useQuery } from "@tanstack/react-query";
import { type PropsWithChildren, createContext, useContext, useEffect, useMemo } from "react";
import { queryTimes } from "../lib/queryConfig";
import { queryKeys } from "../lib/queryKeys";
import { authService } from "../services/auth.service";
import { useAuthStore } from "../store/auth.store";
import type { AuthUser } from "../types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const storedUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clearSession = useAuthStore((state) => state.clearSession);

  const currentUserQuery = useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: authService.currentUser,
    enabled: Boolean(accessToken),
    retry: false,
    staleTime: queryTimes.long,
  });

  const user = currentUserQuery.data ?? storedUser;

  useEffect(() => {
    if (currentUserQuery.data && currentUserQuery.data.id !== storedUser?.id) {
      setUser(currentUserQuery.data);
    }
  }, [currentUserQuery.data, setUser, storedUser?.id]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: Boolean(accessToken && user),
    isLoading: currentUserQuery.isFetching,
    logout: clearSession,
  }), [accessToken, clearSession, currentUserQuery.isFetching, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
