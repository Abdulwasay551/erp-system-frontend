"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, setTokens, clearTokens, getAccessToken, ApiError } from "./api";

export interface CurrentUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  company: number;
  role: number;
  role_name: string;
  is_active: boolean;
  is_staff: boolean;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      const token = getAccessToken();
      if (!token) return;
      try {
        setUser(await api<CurrentUser>("/api/auth/me/"));
      } catch {
        clearTokens();
        setUser(null);
      }
    }
    loadUser().finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    try {
      const tokens = await api<{ access: string; refresh: string }>("/api/auth/token/", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email, password }),
      });
      setTokens(tokens.access, tokens.refresh);
      const me = await api<CurrentUser>("/api/auth/me/");
      setUser(me);
      router.push("/dashboard");
    } catch (e) {
      if (e instanceof ApiError) {
        throw new Error(e.status === 401 ? "Invalid email or password." : e.message);
      }
      throw e;
    }
  }

  function logout() {
    clearTokens();
    setUser(null);
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
