// Consultas de catálogo — falam com a API Go, não mais com o Supabase.
//
// Só LEITURA. Nada aqui escreve — pedido e pagamento passam pela API Go, que
// é quem decide preço. O filtro `published = true` vive no servidor.

import { api, BASE_URL } from "../lib/api";
import type { Category, Metal, Product, Review, Variant } from "./tipos";

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  category: Category;
  metal: Metal;
  images: string[] | null;
  featured: boolean;
  available: boolean;
  variant_label: string | null;
  rating: number | null;
  rating_count: number;
  reviews: Array<{ author: string; date: string; text: string }> | null;
  variants: Array<{
    id: string;
    size: string;
    price_adjust_cents: number;
    available: boolean;
  }> | null;
}

export function toProduct(row: ProductRow): Product {
  const variants: Variant[] = (row.variants ?? [])
    .map((v) => ({
      id: v.id,
      size: v.size,
      priceAdjustCents: v.price_adjust_cents,
      available: v.available,
    }))
    // ordem natural de tamanho: "14" antes de "16", "40cm" antes de "45cm"
    .sort((a, b) =>
      a.size.localeCompare(b.size, "pt-BR", { numeric: true }),
    );

  const reviews: Review[] = (row.reviews ?? []).map((r) => ({
    author: r.author,
    date: r.date,
    text: r.text,
  }));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    category: row.category,
    metal: row.metal,
    images: row.images ?? [],
    featured: row.featured,
    available: row.available,
    variantLabel: row.variant_label,
    rating: row.rating,
    ratingCount: row.rating_count ?? 0,
    reviews,
    variants,
  };
}

export interface ProductFilter {
  category?: Category;
  metal?: Metal;
  featured?: boolean;
  /** Mais vendidos: a API ordena pela venda da Mirava e, no desempate, pela
   *  posição na vitrine da fornecedora. Ver a coluna units_sold no schema. */
  bestSellers?: boolean;
  search?: string;
  limit?: number;
}

function toQuery(filter: ProductFilter): string {
  const params = new URLSearchParams();
  if (filter.category) params.set("category", filter.category);
  if (filter.metal) params.set("metal", filter.metal);
  if (filter.featured) params.set("featured", "true");
  if (filter.bestSellers) params.set("best_sellers", "true");
  if (filter.search?.trim()) params.set("search", filter.search.trim());
  // Teto sempre presente: sem limite, uma categoria grande arrastaria o
  // catálogo inteiro para o navegador da cliente.
  params.set("limit", String(filter.limit ?? 48));
  return params.toString();
}

export async function listProducts(filter: ProductFilter = {}): Promise<Product[]> {
  const rows = await api<ProductRow[]>(`/produtos?${toQuery(filter)}`);
  return rows.map(toProduct);
}

export async function productBySlug(slug: string): Promise<Product | null> {
  try {
    const row = await api<ProductRow>(`/produtos/${encodeURIComponent(slug)}`);
    return toProduct(row);
  } catch (e) {
    if (e instanceof Error && "status" in e && (e as { status: number }).status === 404) {
      return null;
    }
    throw new Error(`Não consegui carregar a peça: ${(e as Error).message}`);
  }
}

/** Peças relacionadas para o fim da página de produto. */
export async function relatedProducts(p: Product, quantity = 4): Promise<Product[]> {
  try {
    const rows = await api<ProductRow[]>(
      `/produtos/${encodeURIComponent(p.slug)}/relacionados?quantity=${quantity}`,
    );
    return rows.map(toProduct);
  } catch {
    return []; // seção secundária: falhar calado é melhor que quebrar a página
  }
}

/** Quantas peças publicadas existem por categoria — alimenta os contadores. */
export async function countByCategory(): Promise<Record<string, number>> {
  try {
    return await api<Record<string, number>>("/categorias/contagem");
  } catch {
    return {};
  }
}

/**
 * URL pública de uma imagem de produto.
 *
 * A sincronização baixa a foto da Lilly e guarda um caminho relativo tipo
 * "/images/PL289/1.jpg" — a própria API Go serve esse arquivo (ver
 * internal/storage). Se algum dia o banco guardar uma URL completa (http…),
 * usa direto; caminho relativo ganha o prefixo da API.
 */
export function imageUrl(path: string | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${BASE_URL}${path}`;
  return null;
}
