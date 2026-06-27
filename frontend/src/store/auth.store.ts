import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthSession, AuthUser } from "../types/auth";

interface AuthState extends AuthSession {
  setSession: (session: { user: AuthUser; accessToken: string; rememberMe: boolean }) => void;
  setUser: (user: AuthUser | null) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      rememberMe: true,
      setSession: ({ user, accessToken, rememberMe }) => set({ user, accessToken, rememberMe, isAuthenticated: true }),
      setUser: (user) => set((state) => ({ user, isAuthenticated: Boolean(user && state.accessToken) })),
      clearSession: () => set({ user: null, accessToken: null, isAuthenticated: false, rememberMe: true }),
    }),
    {
      name: "sgip-auth",
      partialize: (state) => ({
        user: state.rememberMe ? state.user : null,
        accessToken: state.rememberMe ? state.accessToken : null,
        isAuthenticated: state.rememberMe ? state.isAuthenticated : false,
        rememberMe: state.rememberMe,
      }),
    },
  ),
);
