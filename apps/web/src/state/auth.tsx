import React from "react";
import { apiFetch } from "../lib/api";
import type { User } from "../lib/types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ user: User }>("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = React.useCallback(async (payload: { email: string; password: string }) => {
    const data = await apiFetch<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setUser(data.user);
  }, []);

  const register = React.useCallback(
    async (payload: { name: string; email: string; password: string }) => {
      const data = await apiFetch<{ user: User }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setUser(data.user);
    },
    []
  );

  const logout = React.useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = React.useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
