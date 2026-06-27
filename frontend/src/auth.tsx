import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
type User = { id: string; name: string; email: string; role: "student"|"mentor"|"placement"|"admin" };
const AuthContext = createContext<any>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => JSON.parse(localStorage.getItem("sgip_user") || "null"));
  const value = useMemo(() => ({
    user,
    login: (token: string, next: User) => { localStorage.setItem("sgip_token", token); localStorage.setItem("sgip_user", JSON.stringify(next)); setUser(next); },
    logout: () => { localStorage.removeItem("sgip_token"); localStorage.removeItem("sgip_user"); setUser(null); }
  }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
