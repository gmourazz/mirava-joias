// Sessão da cliente — fala com a API Go (/auth/*), não mais com Supabase Auth.
//
// O token fica em localStorage (ver src/lib/api.ts). Ao carregar o site,
// confere se o token salvo ainda é válido chamando GET /auth/eu — assim uma
// sessão expirada ou revogada não fica "logada" na tela por engano.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, clearToken, saveToken, currentToken } from "../lib/api";

export type AdminRole = "system" | "admin" | null;

interface User {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  admin_role: AdminRole;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentToken()) {
      setLoading(false);
      return;
    }
    api<User>("/auth/eu", { authenticated: true })
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const response = await api<{ token: string; name: string; email: string }>(
      "/auth/entrar",
      { method: "POST", body: { email, password } },
    );
    saveToken(response.token);
    const me = await api<User>("/auth/eu", { authenticated: true });
    setUser(me);
  }

  async function signup(name: string, email: string, password: string) {
    const response = await api<{ token: string; name: string; email: string }>(
      "/auth/cadastrar",
      { method: "POST", body: { name, email, password } },
    );
    saveToken(response.token);
    const me = await api<User>("/auth/eu", { authenticated: true });
    setUser(me);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
