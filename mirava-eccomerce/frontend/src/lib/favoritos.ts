// Favoritos — fala com /favoritos na API Go. Exige login: a tabela não
// aceita user_id nulo, então quem não estiver logado nem chega a chamar isto
// (ver FavoritesContext, que manda pra /conta antes de tentar).

import { api } from "./api";
import { toProduct, type ProductRow } from "../catalogo/consultas";
import type { Product } from "../catalogo/tipos";

export function listFavorites(): Promise<Product[]> {
  return api<ProductRow[] | null>("/favoritos", { authenticated: true })
    .then((rows) => (rows ?? []).map(toProduct));
}

export function addFavorite(productId: string): Promise<void> {
  return api(`/favoritos/${productId}`, { method: "POST", authenticated: true });
}

export function removeFavorite(productId: string): Promise<void> {
  return api(`/favoritos/${productId}`, { method: "DELETE", authenticated: true });
}
