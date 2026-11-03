// Chamadas do painel de gestão — rotas /admin/* da API Go, todas protegidas
// por login + tabela `admins` no servidor.
//
// Nada de regra de negócio aqui: prazo, etapa e ações possíveis vêm prontos
// da API (calculados em api/internal/dominio/admin.go).

import { api } from "../lib/api";

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
}

const auth = { authenticated: true } as const;

export const adminApi = {
  me: () => api<{ ok: boolean }>("/admin/eu", auth),
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
  markup_pct: number;
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
}

export interface ProductPage {
  items: AdminProduct[];
  total: number;
  per_page: number;
}

export const productApi = {
  list: (params: URLSearchParams) => api<ProductPage>(`/admin/produtos?${params}`, auth),
  get: (id: string) => api<AdminProduct>(`/admin/produtos/${id}`, auth),
  update: (id: string, body: Partial<Pick<AdminProduct, "name" | "description" | "published" | "featured">>) =>
    api<{ ok: boolean }>(`/admin/produtos/${id}`, { ...auth, method: "PUT", body }),
  markup: (id: string, markupPct: number) =>
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
  }[];
  categories: FinanceGroup[];
  top_pieces: FinanceGroup[];
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
  bulkProducts: (body: { ids: string[]; published?: boolean; featured?: boolean; markup_pct?: number }) =>
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
