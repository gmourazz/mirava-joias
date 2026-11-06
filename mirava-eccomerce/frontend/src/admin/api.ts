// Chamadas do painel de gestão — rotas /admin/* da API Go, todas protegidas
// por login + tabela `admins` no servidor.
//
// Nada de regra de negócio aqui: prazo, etapa e ações possíveis vêm prontos
// da API (calculados em api/internal/dominio/admin.go).

import { api, BASE_URL, currentToken } from "../lib/api";
import type { ReturnRequest } from "../lib/extras";

export type OrderStatus =
  | "awaiting_payment" | "paid" | "in_batch" | "purchased_from_supplier"
  | "received_by_owner" | "shipped" | "delivered" | "cancelled" | "refunded" | "out_of_stock";

/** Etapa do pedido do ponto de vista da operação (dominio.AdminStage). */
export type AdminStage =
  | "aguardando" | "comprar" | "na_lilly" | "despachar" | "despachado"
  | "entregue" | "problema" | "encerrado";

export interface Deadline {
  due: string;
  /** Último dia útil para despachar e ainda chegar no prazo (com o transporte). */
  ship_by: string;
  used: number;
  left: number;
  near: boolean;
  late: boolean;
}

export interface AdminOrder {
  id: string;
  number: number;
  status: OrderStatus;
  stage: AdminStage;
  customer_name: string;
  customer_email: string;
  total_cents: number;
  subtotal_cents: number;
  shipping_cents: number;
  cost_cents: number;
  items_count: number;
  shipping_method: "economico" | "sedex" | null;
  tracking_code: string | null;
  batch_number: number | null;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  deadline: Deadline | null;
}

export interface AdminOrderDetail extends AdminOrder {
  customer_phone: string | null;
  address: {
    recipient?: string; street?: string; number?: string; complement?: string;
    neighborhood?: string; city?: string; state?: string; zip_code?: string;
  } | null;
  items: {
    name: string; sku: string | null; size: string | null; quantity: number;
    price_cents: number; cost_cents: number; image: string | null;
  }[];
  events: { from_status: string | null; to_status: string; origin: string; detail: string | null; created_at: string }[];
  actions: OrderStatus[];
  discount_cents: number;
  coupon_code: string | null;
  points_used: number;
  gift_wrap: boolean;
  gift_wrap_cents: number;
  gift_message: string | null;
}

export interface Batch {
  id: string;
  number: number;
  status: "open" | "closed" | "purchased";
  total_cost_cents: number;
  shipping_cents: number;
  supplier_order_ref: string | null;
  notes: string | null;
  orders_count: number;
  oldest_paid_at: string | null;
  oldest_days: number;
  goal_cents: number;
  days_cap: number;
  opened_at: string;
  closed_at: string | null;
  purchased_at: string | null;
  items: { sku: string | null; name: string; size: string | null; quantity: number; unit_cost_cents: number; subtotal_cents: number; image: string | null }[];
}

export interface Summary {
  by_status: Partial<Record<OrderStatus, number>>;
  near_deadline: number;
  late: number;
  month_revenue_cents: number;
  month_orders: number;
  month_profit_cents: number;
  price_alerts: number;
  unpublished: number;
  published: number;
  last_sync_at: string | null;
  last_sync_status: string | null;
  sales: { day: string; total_cents: number }[];
  stock_alerts: { id: string; name: string; sku: string | null; waiting: number }[];
  top_sellers: { id: string; name: string; units: number; revenue_cents: number }[];
  next_sync_at: string | null;
}

const auth = { authenticated: true } as const;

export const adminApi = {
  me: () => api<{ ok: boolean; role: "master" | "dispatch" }>("/admin/eu", auth),
  notices: (id: string) => api<{ kind: string; channel: string; sent_at: string }[]>(`/admin/pedidos/${id}/avisos`, auth),
  summary: () => api<Summary>("/admin/resumo", auth),
  orders: () => api<AdminOrder[]>("/admin/pedidos", auth),
  order: (id: string) => api<AdminOrderDetail>(`/admin/pedidos/${id}`, auth),
  transition: (id: string, from: OrderStatus, to: OrderStatus) =>
    api<{ ok: boolean }>(`/admin/pedidos/${id}/transicao`, { ...auth, method: "POST", body: { from, to } }),
  ship: (id: string, trackingCode: string) =>
    api<{ ok: boolean }>(`/admin/pedidos/${id}/despachar`, { ...auth, method: "POST", body: { tracking_code: trackingCode } }),
  batches: () => api<Batch[]>("/admin/lotes", auth),
  purchaseBatch: (id: string, ref: string) =>
    api<{ ok: boolean }>(`/admin/lotes/${id}/comprar`, { ...auth, method: "POST", body: { supplier_order_ref: ref } }),
  receiveBatch: (id: string) => api<{ ok: boolean }>(`/admin/lotes/${id}/receber`, { ...auth, method: "POST" }),
};

/** Rótulo e cores da pill de status (OST do protótipo). */
export const STAGE_PILL: Record<AdminStage, { label: string; bg: string; fg: string }> = {
  aguardando: { label: "Aguardando pgto", bg: "#F2F5F5", fg: "#6C7E7F" },
  comprar: { label: "Pago · pedir na Lilly", bg: "#FFF4E0", fg: "#9A6B12" },
  na_lilly: { label: "Pedido na Lilly", bg: "#EAF5F4", fg: "#0F6E73" },
  despachar: { label: "Pronto p/ despachar", bg: "#E3F6F1", fg: "#1E8A74" },
  despachado: { label: "Despachado", bg: "#0F6E73", fg: "#FFFFFF" },
  entregue: { label: "Entregue", bg: "#0B4A4D", fg: "#FFFFFF" },
  problema: { label: "Sem estoque", bg: "#FDECEC", fg: "#B4443C" },
  encerrado: { label: "Encerrado", bg: "#F2F5F5", fg: "#6C7E7F" },
};

/** Texto do botão de cada transição manual. */
export const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  paid: "Tirar do lote",
  purchased_from_supplier: "Já pedi na Lilly",
  received_by_owner: "Recebi da Lilly",
  delivered: "Marcar entregue",
  cancelled: "Cancelar pedido",
  refunded: "Marcar estornado",
  out_of_stock: "Sem estoque na Lilly",
  in_batch: "Voltar para o lote",
};

export const SHIP_LABEL = { economico: "PAC", sedex: "SEDEX" } as const;

export function dataCurta(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  metal: "prata" | "ouro";
  price_cents: number;
  cost_cents: number;
  /** Markup da peça; nulo = herda da categoria ou o padrão (decisão 21). */
  markup_pct: number | null;
  effective_markup_pct: number;
  auto_price: boolean;
  suggested_price_cents: number | null;
  suggestion_reason: string | null;
  published: boolean;
  featured: boolean;
  image: string | null;
  sku: string | null;
  supplier_url: string | null;
  supplier_retail_cents: number | null;
  units_sold: number;
  updated_at: string;
  images: string[];
  seo_title: string | null;
  seo_description: string | null;
  keep_own_photos: boolean;
  available: boolean;
  manual: boolean;
  promo_pct: number;
  showcase: string[];
  last_sale_days: number | null;
}

export interface ProductPage {
  items: AdminProduct[];
  total: number;
  per_page: number;
}

export const productApi = {
  list: (params: URLSearchParams) => api<ProductPage>(`/admin/produtos?${params}`, auth),
  get: (id: string) => api<AdminProduct>(`/admin/produtos/${id}`, auth),
  update: (
    id: string,
    body: Partial<Pick<AdminProduct, "name" | "description" | "published" | "featured" | "category" | "metal" | "seo_title" | "seo_description" | "images" | "keep_own_photos">>,
  ) => api<{ ok: boolean }>(`/admin/produtos/${id}`, { ...auth, method: "PUT", body }),
  /** markupPct nulo = a peça volta a herdar (categoria ou padrão). */
  markup: (id: string, markupPct: number | null) =>
    api<{ ok: boolean }>(`/admin/produtos/${id}/markup`, { ...auth, method: "POST", body: { markup_pct: markupPct } }),
  suggestion: (id: string, accept: boolean) =>
    api<{ ok: boolean }>(`/admin/produtos/${id}/sugestao`, { ...auth, method: "POST", body: { accept } }),
};

export interface FinanceGroup {
  label: string;
  units: number;
  sales_cents: number;
  profit_cents: number;
}

export interface FinanceMonth {
  month: string;
  orders_count: number;
  revenue_cents: number;
  subtotal_cents: number;
  discount_cents: number;
  gift_wrap_cents: number;
  gift_wrap_cost_cents: number;
  gift_wraps: number;
  shipping_cents: number;
  cost_cents: number;
  fees_cents: number;
  packaging_cents: number;
  packaging_each_cents: number;
  batch_freight_cents: number;
  gross_profit_cents: number;
  net_profit_cents: number;
  net_margin_pct: number;
  orders: {
    id: string; number: number; customer_name: string; paid_at: string; shipping_method: "economico" | "sedex" | null;
    subtotal_cents: number; shipping_cents: number; total_cents: number; cost_cents: number; fee_cents: number;
    discount_cents: number; gift_wrap_cents: number;
  }[];
  categories: FinanceGroup[];
  top_pieces: FinanceGroup[];
  fees_by_method: { method: "pix" | "cartao" | "boleto" | "outro"; orders: number; amount_cents: number; fees_cents: number }[];
  goals: { revenue_cents: number; orders: number; profit_cents: number };
}

export interface SyncRun {
  id: string;
  status: "running" | "success" | "partial" | "error";
  sitemap_urls: number;
  processed: number;
  created: number;
  updated: number;
  failed: number;
  vanished: number;
  locked_prices: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  interrupted: boolean;
}

export interface SyncData {
  overview: {
    runs: SyncRun[];
    failures: { url: string; reason: string; created_at: string }[];
    mirror_total: number;
    mirror_available: number;
    mirror_vanished: number;
    published: number;
    unpublished: number;
    price_alerts: number;
  };
  rules: { variation_limit_pct: number; batch_goal_cents: number; batch_days_cap: number; min_markup_pct: number; max_markup_pct: number };
}

export const reportApi = {
  finance: (mes: string) => api<FinanceMonth>(`/admin/financeiro?mes=${mes}`, auth),
  sync: () => api<SyncData>("/admin/sincronizacao", auth),
};

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  orders: number;
  spent_cents: number;
  last_order_at: string | null;
  favorites: number;
  is_admin: boolean;
  level: "brilho" | "encanto" | "joia_rara";
  tags: string[];
}

export interface Activity {
  order_id: string;
  order_number: number;
  customer_name: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  origin: string;
  detail: string | null;
  created_at: string;
}

export interface StoreConfig {
  free_shipping_above_cents: number;
  promised_business_days: number;
  near_deadline_days: number;
  batch_goal_cents: number;
  batch_days_cap: number;
  batch_estimated_shipping: number;
  variation_limit_pct: number;
  min_markup_pct: number;
  max_markup_pct: number;
  new_product_days: number;
  installments_no_interest: number;
  packaging_cents: number;
  site_url: string;
  payment_ready: boolean;
  payment_test_mode: boolean;
  email_ready: boolean;
}

export const extraApi = {
  customers: (busca: string) => api<Customer[]>(`/admin/clientes?busca=${encodeURIComponent(busca)}`, auth),
  customerOrders: (id: string) => api<AdminOrder[]>(`/admin/clientes/${id}/pedidos`, auth),
  activities: (origem: string) => api<Activity[]>(`/admin/atividades?origem=${origem}`, auth),
  config: () => api<StoreConfig>("/admin/configuracoes", auth),
  bulkProducts: (body: {
    ids: string[]; published?: boolean; featured?: boolean; markup_pct?: number;
    inherit_markup?: boolean; promo_pct?: number; promo_days?: number;
  }) =>
    api<{ updated: number; failed: number }>("/admin/produtos/lote", { ...auth, method: "POST", body }),
};

/** Nome de cada status interno, para o histórico do painel. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago",
  in_batch: "No lote de compra",
  purchased_from_supplier: "Pedido na Lilly",
  received_by_owner: "Recebido da Lilly",
  shipped: "Despachado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  refunded: "Estornado",
  out_of_stock: "Sem estoque na Lilly",
};

// ---------------------------------------------------------------------------
// Cupons, avaliações, avise-me, trocas, vitrine, avisos e automações
// (decisão 31). O painel só lê e manda; validação e teto ficam no Go.
// ---------------------------------------------------------------------------

export interface AdminCoupon {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  min_subtotal_cents: number;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number;
  active: boolean;
  description: string | null;
  uses: number;
  discounted_cents: number;
  created_at: string;
}

export interface NewCoupon {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  min_subtotal_cents: number;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number;
  description: string;
}

export interface AdminReview {
  id: string;
  product_name: string;
  product_slug: string;
  product_image: string | null;
  customer: string;
  email: string;
  rating: number;
  text: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface AdminStockAlert {
  product_id: string;
  name: string;
  slug: string;
  image: string | null;
  waiting: number;
  notified: number;
  available: boolean;
}

export interface AdminAnnouncement {
  id?: string;
  text: string;
  position: number;
  active: boolean;
}

export interface AutomationStatus {
  key: "payment_reminder" | "abandoned_cart" | "review_request" | "stock_alert" | "return_update";
  enabled: boolean;
  sent: number;
  pending: number;
}

export const growthApi = {
  coupons: () => api<AdminCoupon[]>("/admin/cupons", auth),
  createCoupon: (c: NewCoupon) => api<{ ok: boolean; code: string }>("/admin/cupons", { ...auth, method: "POST", body: c }),
  toggleCoupon: (code: string, active: boolean) =>
    api<{ ok: boolean }>(`/admin/cupons/${encodeURIComponent(code)}`, { ...auth, method: "PUT", body: { active } }),

  reviews: (status: string) => api<AdminReview[]>(`/admin/avaliacoes?status=${status}`, auth),
  decideReview: (id: string, status: "approved" | "rejected") =>
    api<{ ok: boolean }>(`/admin/avaliacoes/${id}`, { ...auth, method: "PUT", body: { status } }),
  stockAlerts: () => api<AdminStockAlert[]>("/admin/avise-me", auth),

  returns: () => api<ReturnRequest[]>("/admin/trocas", auth),
  advanceReturn: (id: string, from: string, to: string, note: string) =>
    api<{ ok: boolean }>(`/admin/trocas/${id}`, { ...auth, method: "PUT", body: { from, to, note } }),

  setShowcase: (slot: string, productIds: string[]) =>
    api<{ ok: boolean }>(`/admin/vitrine/${slot}`, { ...auth, method: "PUT", body: { product_ids: productIds } }),
  announcements: () => api<AdminAnnouncement[]>("/admin/avisos", auth),
  setAnnouncements: (items: AdminAnnouncement[]) =>
    api<{ ok: boolean }>("/admin/avisos", { ...auth, method: "PUT", body: { items } }),

  automations: () => api<{ items: AutomationStatus[]; email_ready: boolean }>("/admin/automacoes", auth),
  setAutomation: (key: string, enabled: boolean) =>
    api<{ ok: boolean }>(`/admin/automacoes/${key}`, { ...auth, method: "PUT", body: { enabled } }),
};

// ---------------------------------------------------------------------------
// Design v5 completo (decisões 21, 27 e 32 a 35): configurações, categorias,
// promoções, kits, banners, galeria, uploads, produto manual, fila da Lilly,
// clientes, sacolas, textos das automações e equipe.
// ---------------------------------------------------------------------------

export interface StoreSettings {
  default_markup_pct: number;
  round_to_90: boolean;
  min_margin_pct: number;
  out_of_stock_action: "show" | "hide";
  sync_every_hours: 3 | 6 | 12 | 24;
  auto_import: boolean;
  sync_images: boolean;
  sync_descriptions: boolean;
  store_name: string;
  store_email: string;
  store_instagram: string;
  sender_name: string;
  sender_street: string;
  sender_number: string;
  sender_complement: string;
  sender_neighborhood: string;
  sender_city: string;
  sender_state: string;
  sender_zip: string;
  goal_revenue_cents: number;
  goal_orders: number;
  goal_profit_cents: number;
  gift_wrap_cost_cents: number;
}

export interface AdminCategory {
  slug: string;
  label: string;
  position: number;
  markup_pct: number | null;
  count: number;
}

export interface Promotion {
  id?: string;
  name: string;
  pct: number;
  scope: "all" | "category" | "products";
  category: string | null;
  product_ids: string[];
  starts_at: string;
  ends_at: string;
  products?: number;
}

export interface AdminKit {
  id: string;
  product_a: string;
  product_b: string;
  name_a: string;
  name_b: string;
  price_a_cents: number;
  price_b_cents: number;
  pct: number;
  active: boolean;
}

export interface BannerData {
  id?: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_url: string;
  image: string | null;
  active: boolean;
}

export interface GalleryItem {
  id?: string;
  image: string;
  link: string | null;
  caption: string | null;
}

export interface QueueItem {
  id: string;
  sku: string;
  name: string;
  url: string;
  cost_cents: number;
  retail_cents: number | null;
  image: string | null;
  category: string;
  price_cents: number;
}

export interface AdminCart {
  user_id: string;
  name: string;
  email: string;
  items: number;
  total_cents: number;
  updated_at: string;
  notified_at: string | null;
  recovered: boolean;
}

export interface TeamMember {
  user_id: string;
  name: string;
  email: string;
  role: "master" | "dispatch";
}

export interface AdminCollection {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  image: string | null;
  cover: string | null;
  position: number;
  active: boolean;
  count: number;
  total: number;
}

export const lojaApi = {
  collections: () => api<AdminCollection[]>("/admin/colecoes", auth),
  collection: (slug: string) => api<{ collection: AdminCollection; products: AdminProduct[] }>(`/admin/colecoes/${slug}`, auth),
  createCollection: (name: string) => api<{ ok: boolean; id: string; slug: string }>("/admin/colecoes", { ...auth, method: "POST", body: { name } }),
  updateCollection: (id: string, c: Pick<AdminCollection, "name" | "tagline" | "description" | "image" | "position" | "active">) =>
    api<{ ok: boolean }>(`/admin/colecoes/${id}`, { ...auth, method: "PUT", body: c }),
  deleteCollection: (id: string) => api<{ ok: boolean }>(`/admin/colecoes/${id}`, { ...auth, method: "DELETE" }),
  setCollectionProducts: (id: string, productIds: string[]) =>
    api<{ ok: boolean }>(`/admin/colecoes/${id}/pecas`, { ...auth, method: "PUT", body: { product_ids: productIds } }),
  importLink: (url: string) => api<{ product_id: string; created: boolean; name?: string }>("/admin/importar-link", { ...auth, method: "POST", body: { url } }),

  settings: () => api<StoreSettings>("/admin/loja", auth),
  saveSettings: (s: StoreSettings) => api<{ ok: boolean }>("/admin/loja", { ...auth, method: "PUT", body: s }),
  recalculate: () => api<{ ok: boolean; updated: number }>("/admin/precos/recalcular", { ...auth, method: "POST" }),

  categories: () => api<AdminCategory[]>("/admin/categorias", auth),
  createCategory: (slug: string, label: string) =>
    api<{ ok: boolean }>("/admin/categorias", { ...auth, method: "POST", body: { slug, label } }),
  updateCategory: (slug: string, label: string, position: number, markupPct: number | null) =>
    api<{ ok: boolean }>(`/admin/categorias/${slug}`, { ...auth, method: "PUT", body: { label, position, markup_pct: markupPct } }),
  deleteCategory: (slug: string) => api<{ ok: boolean }>(`/admin/categorias/${slug}`, { ...auth, method: "DELETE" }),
  mappings: () => api<{ keyword: string; category: string }[]>("/admin/mapeamento", auth),
  setMappings: (items: { keyword: string; category: string }[]) =>
    api<{ ok: boolean }>("/admin/mapeamento", { ...auth, method: "PUT", body: { items } }),

  promotions: () => api<Promotion[]>("/admin/promocoes", auth),
  createPromotion: (p: Promotion) => api<{ ok: boolean }>("/admin/promocoes", { ...auth, method: "POST", body: p }),
  deletePromotion: (id: string) => api<{ ok: boolean }>(`/admin/promocoes/${id}`, { ...auth, method: "DELETE" }),
  kits: () => api<AdminKit[]>("/admin/kits", auth),
  createKit: (a: string, b: string, pct: number) =>
    api<{ ok: boolean }>("/admin/kits", { ...auth, method: "POST", body: { product_a: a, product_b: b, pct } }),
  toggleKit: (id: string, active: boolean) => api<{ ok: boolean }>(`/admin/kits/${id}`, { ...auth, method: "PUT", body: { active } }),
  deleteKit: (id: string) => api<{ ok: boolean }>(`/admin/kits/${id}`, { ...auth, method: "DELETE" }),

  banners: () => api<BannerData[]>("/admin/banners", auth),
  setBanners: (items: BannerData[]) => api<{ ok: boolean }>("/admin/banners", { ...auth, method: "PUT", body: { items } }),
  gallery: () => api<GalleryItem[]>("/galeria"),
  setGallery: (items: GalleryItem[]) => api<{ ok: boolean }>("/admin/galeria", { ...auth, method: "PUT", body: { items } }),

  createProduct: (p: {
    name: string; description: string; category: string; metal: "prata" | "ouro";
    cost_cents: number; markup_pct: number | null; images: string[]; published: boolean;
  }) => api<{ ok: boolean; id: string }>("/admin/produtos", { ...auth, method: "POST", body: p }),

  queue: () => api<QueueItem[]>("/admin/fila-lilly", auth),
  importQueued: (id: string) => api<{ ok: boolean }>(`/admin/fila-lilly/${id}/importar`, { ...auth, method: "POST" }),
  ignoreQueued: (id: string) => api<{ ok: boolean }>(`/admin/fila-lilly/${id}/ignorar`, { ...auth, method: "POST" }),
  importAll: () => api<{ ok: boolean; queued: number }>("/admin/fila-lilly/importar-tudo", { ...auth, method: "POST" }),
  syncNow: () => api<{ ok: boolean; nota?: string }>("/admin/sincronizar", { ...auth, method: "POST" }),
  testConnection: () => api<{ ok: boolean; urls?: number; error?: string }>("/admin/sincronizacao/teste", auth),

  customerNotes: (id: string) => api<{ tags: string[]; notes: string }>(`/admin/clientes/${id}/notas`, auth),
  saveCustomerNotes: (id: string, tags: string[], notes: string) =>
    api<{ ok: boolean }>(`/admin/clientes/${id}/notas`, { ...auth, method: "PUT", body: { tags, notes } }),
  sendCoupon: (id: string, code: string) => api<{ ok: boolean }>(`/admin/clientes/${id}/cupom`, { ...auth, method: "POST", body: { code } }),

  carts: () => api<AdminCart[]>("/admin/carrinhos", auth),
  remindCart: (userId: string) => api<{ ok: boolean }>(`/admin/carrinhos/${userId}/lembrar`, { ...auth, method: "POST" }),
  notifyStock: (productId: string) => api<{ ok: boolean; sent: number }>(`/admin/avise-me/${productId}/avisar`, { ...auth, method: "POST" }),
  subscribers: () => api<{ email: string; whatsapp: string | null; source: string; created_at: string }[]>("/admin/novidades", auth),

  automationTexts: () => api<Record<string, { subject: string; body: string }>>("/admin/automacoes/textos", auth),
  setAutomationText: (key: string, subject: string, body: string) =>
    api<{ ok: boolean }>(`/admin/automacoes/${key}/texto`, { ...auth, method: "PUT", body: { subject, body } }),
  testAutomation: (key: string) => api<{ ok: boolean; to: string }>(`/admin/automacoes/${key}/teste`, { ...auth, method: "POST" }),

  team: () => api<TeamMember[]>("/admin/equipe", auth),
  addTeam: (email: string) => api<{ ok: boolean }>("/admin/equipe", { ...auth, method: "POST", body: { email } }),
  removeTeam: (id: string) => api<{ ok: boolean }>(`/admin/equipe/${id}`, { ...auth, method: "DELETE" }),
};

/** Envia uma foto (decisão 35). Devolve o caminho público (/images/uploads/...). */
export async function uploadImage(file: File, pasta: "produtos" | "banners" | "galeria"): Promise<string> {
  const token = currentToken();
  const form = new FormData();
  form.append("arquivo", file);
  const res = await fetch(`${BASE_URL}/admin/upload?pasta=${pasta}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Não consegui enviar a foto");
  return data.path as string;
}
