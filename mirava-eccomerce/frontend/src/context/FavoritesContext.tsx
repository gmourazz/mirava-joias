// Favoritos de verdade: vêm do banco, por trás de login.
//
// Sem conta não tem favorito (a tabela `favorites` não aceita user_id nulo),
// então este contexto simplesmente fica vazio enquanto ninguém está logado.
// Quem chama toggleFavorite sem sessão recebe `false` de volta — a tela é
// quem decide o que fazer (hoje: mandar pra /conta).

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { addFavorite, listFavorites, removeFavorite } from "../lib/favoritos";
import type { Product } from "../catalogo/tipos";

interface FavoritesContextValue {
  products: Product[];
  loading: boolean;
  isFavorite: (productId: string) => boolean;
  /** Devolve false quando não há sessão — nada foi tentado. */
  toggleFavorite: (product: Product) => Promise<boolean>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setProducts([]);
      return;
    }
    setLoading(true);
    listFavorites()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [user]);

  const isFavorite = (productId: string) => products.some((p) => p.id === productId);

  // Otimista: o coração muda na hora, sem esperar o servidor. Se a chamada
  // falhar, desfaz — melhor que travar o clique esperando rede.
  async function toggleFavorite(product: Product): Promise<boolean> {
    if (!user) return false;
    const already = isFavorite(product.id);

    setProducts((prev) =>
      already ? prev.filter((p) => p.id !== product.id) : [product, ...prev],
    );

    try {
      if (already) {
        await removeFavorite(product.id);
      } else {
        await addFavorite(product.id);
      }
    } catch {
      setProducts((prev) =>
        already ? [product, ...prev] : prev.filter((p) => p.id !== product.id),
      );
    }
    return true;
  }

  return (
    <FavoritesContext.Provider value={{ products, loading, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
