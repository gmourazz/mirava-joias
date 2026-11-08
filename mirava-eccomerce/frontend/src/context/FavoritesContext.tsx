// Favoritos da conta: o coração dos cards, da página de produto e o ícone do
// header leem daqui. Sem login, tocar no coração leva para entrar — favorito
// mora na conta (tabela `favorites`), não no navegador.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { useLogin } from "./LoginContext";
import { addFavorite, listFavorites, removeFavorite } from "../lib/favoritos";

interface FavoritesValue {
  ids: Set<string>;
  isFavorite: (productId: string) => boolean;
  toggle: (productId: string) => void;
}

const FavoritesContext = createContext<FavoritesValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { abrirLogin } = useLogin();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }
    listFavorites()
      .then((ps) => setIds(new Set(ps.map((p) => p.id))))
      .catch(() => setIds(new Set()));
  }, [user]);

  const toggle = useCallback(
    (productId: string) => {
      if (!user) {
        abrirLogin();
        return;
      }
      const era = ids.has(productId);
      // Otimista: o coração responde na hora; se a API falhar, desfaz.
      setIds((prev) => {
        const next = new Set(prev);
        if (era) next.delete(productId);
        else next.add(productId);
        return next;
      });
      (era ? removeFavorite(productId) : addFavorite(productId)).catch(() =>
        setIds((prev) => {
          const next = new Set(prev);
          if (era) next.add(productId);
          else next.delete(productId);
          return next;
        }),
      );
    },
    [user, ids, abrirLogin],
  );

  return (
    <FavoritesContext.Provider value={{ ids, isFavorite: (id) => ids.has(id), toggle }}>{children}</FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
