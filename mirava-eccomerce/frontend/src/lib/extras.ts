// Chamadas da loja para descontos, Club, avaliações, avise-me, trocas,
// vitrine e avisos (decisão 31). Preço e desconto vêm SEMPRE do servidor —
// aqui só se pede e se mostra.

import { useEffect, useState } from "react";
import { api, currentToken } from "./api";
import { listFromRows, type ProductRow } from "../catalogo/consultas";
import type { Product } from "../catalogo/tipos";

export interface CheckoutPreviewRequest {
  items: { product_id: string; size: string; quantity: number }[];
  address_id?: string;
  shipping?: string;
  coupon?: string;
  use_points?: boolean;
  gift_wrap?: boolean;
  gift_message?: string;
  payment_choice?: PaymentChoice;
}

export type PaymentChoice = "pix" | "card" | "boleto";

export interface CheckoutPreview {
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  gift_wrap_cents: number;
  total_cents: number;
  coupon_code: string;
  points_used: number;
  points_earned: number;
  points_balance: number;
  discount_error: string;
  max_discount_pct: number;
  list_subtotal_cents: number;
  kit_discount_cents: number;
  coupon_discount_cents: number;
  pix_discount_cents: number;
  payment_choice: PaymentChoice | "";
  club_free_shipping: boolean;
  pix_discount_pct: number;
}

export const checkoutPreview = (body: CheckoutPreviewRequest) =>
  api<CheckoutPreview>("/checkout/previa", { method: "POST", authenticated: true, body });

export interface ClubStatus {
  balance: number;
  earned: number;
  level: "brilho" | "encanto" | "joia_rara";
  next_level_at: number;
  balance_value: number;
  points_per_block: number;
  cents_per_block: number;
  statement: { order_id: string; order_number: number; earned: number; used: number; status: string; date: string }[];
}
export const clubStatus = () => api<ClubStatus>("/clube", { authenticated: true });

export interface PublicReview {
  author: string;
  rating: number;
  text: string;
  created_at: string;
}
export const productReviews = (slug: string) =>
  api<{ reviews: PublicReview[]; average: number; count: number; recommend_pct: number }>(`/produtos/${encodeURIComponent(slug)}/avaliacoes`);

export interface Reviewable {
  product_id: string;
  slug: string;
  name: string;
  image: string | null;
  order_number: number;
  delivered_at: string;
}
export const reviewables = () => api<Reviewable[]>("/avaliacoes/pendentes", { authenticated: true });
export const createReview = (product_id: string, rating: number, text: string) =>
  api<{ ok: boolean }>("/avaliacoes", { method: "POST", authenticated: true, body: { product_id, rating, text } });

// Avise-me vale sem login: com sessão, o servidor usa o e-mail da conta.
export const stockAlert = (product_id: string, email: string) =>
  api<{ ok: boolean }>("/avise-me", { method: "POST", authenticated: !!currentToken(), body: { product_id, email } });

export type ReturnStage = "requested" | "awaiting_shipment" | "received" | "done" | "rejected";
export interface ReturnRequest {
  id: string;
  order_id: string;
  order_number: number;
  customer: string;
  email: string;
  kind: "troca" | "reembolso";
  reason: string;
  stage: ReturnStage;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  items_summary: string;
}
export const RETURN_STAGES: { key: ReturnStage; label: string }[] = [
  { key: "requested", label: "Solicitada" },
  { key: "awaiting_shipment", label: "Aguardando envio" },
  { key: "received", label: "Peça recebida" },
  { key: "done", label: "Concluída" },
];
export const myReturns = () => api<ReturnRequest[]>("/trocas", { authenticated: true });
export const createReturn = (order_id: string, kind: string, reason: string) =>
  api<{ ok: boolean }>("/trocas", { method: "POST", authenticated: true, body: { order_id, kind, reason } });

export interface ProductExtras {
  soldWeek: number;
  kit: { partner: Product; pct: number } | null;
}
export async function productExtras(slug: string): Promise<ProductExtras> {
  const raw = await api<{ sold_week: number; kit: { partner: ProductRow; pct: number } | null }>(
    `/produtos/${encodeURIComponent(slug)}/extras`,
  );
  return {
    soldWeek: raw.sold_week,
    kit: raw.kit ? { partner: listFromRows([raw.kit.partner])[0], pct: raw.kit.pct } : null,
  };
}

export type ShowcaseSlot = "queridinhas" | "lancamentos" | "presentes";
export type Showcase = Record<ShowcaseSlot, Product[]>;

const EMPTY_SHOWCASE: Showcase = { queridinhas: [], lancamentos: [], presentes: [] };

// Uma busca por visita: a home usa a vitrine em duas seções.
let showcasePromise: Promise<Showcase> | null = null;

export function showcase(fresh = false): Promise<Showcase> {
  if (fresh) showcasePromise = null;
  showcasePromise ??= api<Partial<Record<string, ProductRow[]>>>("/vitrine")
    .then((raw) => ({
      queridinhas: listFromRows(raw.queridinhas ?? null),
      lancamentos: listFromRows(raw.lancamentos ?? null),
      presentes: listFromRows(raw.presentes ?? null),
    }))
    .catch(() => {
      showcasePromise = null;
      return EMPTY_SHOWCASE;
    });
  return showcasePromise;
}

/** Vitrine escolhida pela dona no painel. Espaço vazio = a seção usa a
 *  regra automática de antes (mais vendidos, mais recentes). */
export function useShowcase(): { data: Showcase; loading: boolean } {
  const [state, setState] = useState<{ data: Showcase; loading: boolean }>({ data: EMPTY_SHOWCASE, loading: true });
  useEffect(() => {
    let atual = true;
    void showcase().then((data) => atual && setState({ data, loading: false }));
    return () => {
      atual = false;
    };
  }, []);
  return state;
}

export const announcements = () => api<{ id: string; text: string }[]>("/avisos");

export const saveCart = (items: { product_id: string; size: string; quantity: number }[]) =>
  api<{ ok: boolean }>("/carrinho", { method: "PUT", authenticated: true, body: { items } });

// ---------------------------------------------------------------------------
// Design v5 completo: banners, galeria, avaliações da home, novidades, cupons
// da cliente e esqueci minha senha (decisões 34 e 35).
// ---------------------------------------------------------------------------

export interface Banner {
  id?: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_url: string;
  image: string | null;
  active: boolean;
}
export const banners = () => api<Banner[]>("/banners");

export interface GalleryImage {
  id?: string;
  image: string;
  link: string | null;
  caption: string | null;
}
export const gallery = () => api<GalleryImage[]>("/galeria");

export interface RecentReview extends PublicReview {
  product_name: string;
  product_slug: string;
}
export const recentReviews = () => api<RecentReview[]>("/avaliacoes/recentes");

export const subscribe = (email: string, whatsapp: string, source: "popup" | "rodape" | "cadastro" | "conta") =>
  api<{ ok: boolean; coupon: string }>("/novidades", { method: "POST", authenticated: !!currentToken(), body: { email, whatsapp, source } });

export interface MyCoupon {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  min_subtotal_cents: number;
  ends_at: string | null;
  description: string | null;
  usable: boolean;
  reason: string;
}
export const myCoupons = () => api<MyCoupon[]>("/cupons", { authenticated: true });

export const forgotPassword = (email: string) =>
  api<{ ok: boolean; nota: string }>("/auth/esqueci", { method: "POST", body: { email } });
export const resetPassword = (token: string, password: string) =>
  api<{ ok: boolean }>("/auth/redefinir", { method: "POST", body: { token, password } });
