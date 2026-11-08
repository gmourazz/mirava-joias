// Abre a janela de login de qualquer lugar da loja. `abrirLogin("/checkout")`
// leva a cliente para lá depois de entrar; sem destino, ela fica onde está.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import LoginModal from "../components/LoginModal";
import { useAuth } from "./AuthContext";

const LoginContext = createContext<{ abrirLogin: (destino?: string) => void } | null>(null);

export function LoginProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const destino = useRef<string | undefined>(undefined);

  const abrirLogin = useCallback((d?: string) => {
    destino.current = d;
    setAberto(true);
  }, []);
  const fechar = useCallback(() => setAberto(false), []);

  useEffect(() => {
    if (!aberto || !user) return;
    setAberto(false);
    // Só caminho interno: o destino pode vir de ?voltar= na URL.
    if (destino.current?.startsWith("/") && !destino.current.startsWith("//")) navigate(destino.current);
  }, [aberto, user, navigate]);

  const value = useMemo(() => ({ abrirLogin }), [abrirLogin]);
  return (
    <LoginContext.Provider value={value}>
      {children}
      {aberto && <LoginModal onClose={fechar} />}
    </LoginContext.Provider>
  );
}

export function useLogin() {
  const ctx = useContext(LoginContext);
  if (!ctx) throw new Error("useLogin precisa estar dentro de LoginProvider");
  return ctx;
}
