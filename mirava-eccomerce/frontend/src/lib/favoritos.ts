// Favoritos da cliente — sempre da conta logada (a API filtra por user_id).

import { api } from "./api";
import { listFromRows, type ProductRow } from "../catalogo/consultas";
import type { Product } from "../catalogo/tipos";

export async function listFavorites(): Promise<Product[]> {
  const rows = await api<ProductRow[]>("/favoritos", { authenticated: true });
  return listFromRows(rows);
}

export const addFavorite = (productId: string) =>
  api<{ ok: boolean }>(`/favoritos/${productId}`, { method: "POST", authenticated: true });

export const removeFavorite = (productId: string) =>
  api<{ ok: boolean }>(`/favoritos/${productId}`, { method: "DELETE", authenticated: true });
