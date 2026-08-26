// Painel administrativo — fala com /admin/* e /gestao/* na API Go.
//
// Protegido por sessão de verdade: manda o mesmo token do login da cliente
// (ver AuthContext), e a API confere se o usuário está na tabela `admins`.
// O front não decide quem é admin — só esconde o link se `user.is_admin`
// for falso, por conveniência; a proteção real é no servidor.

import { api } from "./api";

export interface BatchStatus {
  id: string;
  number: number;
  cost_cents: number;
  goal_cents: number;
  oldest_paid_at: string | null;
  oldest_business_days: number;
  order_count: number;
}

export interface SyncSummary {
  id: string;
  status: "running" | "success" | "partial" | "error";
  processed: number;
  created: number;
  updated: number;
  failed: number;
  locked_prices: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface DailyRevenue {
  date: string;
  revenue_cents: number;
  orders: number;
}

export interface TopProduct {
  name: string;
  units_sold: number;
  revenue_cents: number;
}

export interface DashboardStats {
  revenue_today_cents: number;
  revenue_month_cents: number;
  orders_today: number;
  orders_month: number;
  average_ticket_cents: number;
  items_cost_month_cents: number;
  fees_month_cents: number;
  profit_month_cents: number;
  status_counts: Record<string, number>;
  open_batch: BatchStatus | null;
  last_sync: SyncSummary | null;
  daily_revenue: DailyRevenue[];
  top_products: TopProduct[];
}

export function getDashboard(): Promise<DashboardStats> {
  return api<DashboardStats>("/admin/dashboard", { authenticated: true });
}

export const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago",
  in_batch: "No lote",
  purchased_from_supplier: "Comprado na fornecedora",
  received_by_owner: "Recebido por você",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  refunded: "Estornado",
  out_of_stock: "Falha de estoque",
};

export const SYNC_STATUS_LABEL: Record<string, string> = {
  running: "Rodando…",
  success: "Sucesso",
  partial: "Parcial",
  error: "Erro",
};

export interface AdminOrder {
  id: string;
  number: number;
  status: string;
  customer_name: string;
  total_cents: number;
  created_at: string;
  paid_at: string | null;
}

export function listAllOrders(status?: string): Promise<AdminOrder[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return api<AdminOrder[] | null>(`/admin/pedidos${qs}`, { authenticated: true }).then((r) => r ?? []);
}

/** Pago, e ainda não chegou em "enviado" — é o que a dona precisa mexer.
 *  Usado no filtro rápido de Pedidos e no contador da sidebar; um lugar
 *  só, pra não desalinhar. */
export const PRONTOS_PARA_DESPACHAR = ["paid", "in_batch", "purchased_from_supplier", "received_by_owner"];

/** Dispara a sincronização com a Lilly. A API responde na hora (202) e
 *  continua rodando em segundo plano — pode levar horas no catálogo
 *  inteiro. Acompanhe pelo `last_sync` do dashboard. */
export function triggerSync(): Promise<{ ok: boolean; nota: string }> {
  return api("/admin/sincronizar", { method: "POST", authenticated: true });
}

// Gestão de administradores — só quem é "system" enxerga isso (a API
// recusa com 403 pra quem é só "admin"). O front não decide quem vê a
// seção; só evita mostrar um formulário que vai dar erro.

export interface AdminUser {
  user_id: string;
  name: string;
  email: string;
  role: "system" | "admin";
}

export function listAdmins(): Promise<AdminUser[]> {
  return api<AdminUser[] | null>("/admin/administradores", { authenticated: true }).then((r) => r ?? []);
}

export function addAdmin(email: string, role: "system" | "admin"): Promise<{ ok: boolean }> {
  return api("/admin/administradores", { method: "POST", authenticated: true, body: { email, role } });
}

export function removeAdmin(userId: string): Promise<{ ok: boolean }> {
  return api(`/admin/administradores/${userId}`, { method: "DELETE", authenticated: true });
}

// Detalhe do pedido e transição manual de status. "shipped" fica fora daqui
// de propósito — precisa de código de rastreio, então continua passando por
// despacharPedido (que já existia, ver Pedidos.tsx).

export interface AdminOrderItem {
  name: string;
  sku: string | null;
  size: string | null;
  quantity: number;
  unit_price_cents: number;
  unit_cost_cents: number;
}

export interface AdminPayment {
  mp_payment_id: string;
  status: string;
  method: string | null;
  installments: number | null;
  amount_cents: number;
  fee_cents: number | null;
  net_cents: number | null;
  created_at: string;
}

export interface AdminOrderDetail {
  id: string;
  number: number;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_cpf: string | null;
  address: Record<string, string> | null;
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents: number;
  total_cents: number;
  shipping_method: string | null;
  engraving: string | null;
  notes: string | null;
  tracking_code: string | null;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  items: AdminOrderItem[];
  payments: AdminPayment[];
}

export function getOrderDetail(id: string): Promise<AdminOrderDetail> {
  return api<AdminOrderDetail>(`/admin/pedidos/${id}`, { authenticated: true });
}

export function advanceOrderStatus(id: string, to: string): Promise<{ ok: boolean }> {
  return api(`/admin/pedidos/${id}/status`, { method: "POST", authenticated: true, body: { to } });
}

/** Transições válidas a partir de cada status — espelha dominio.CanGo no Go.
 *  "shipped" não aparece aqui: precisa do código de rastreio, ver despacho. */
export const NEXT_STATUSES: Record<string, string[]> = {
  awaiting_payment: ["paid", "cancelled"],
  paid: ["in_batch", "refunded", "out_of_stock"],
  in_batch: ["purchased_from_supplier", "out_of_stock", "paid"],
  purchased_from_supplier: ["received_by_owner", "out_of_stock"],
  received_by_owner: [], // só via despacho, com rastreio
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  refunded: [],
  out_of_stock: ["refunded", "in_batch"],
};

// Lista de compra do lote aberto — o que copiar no site da Lilly no sábado.

export interface ShoppingItem {
  sku: string | null;
  name: string;
  quantity: number;
  unit_cost_cents: number;
  subtotal_cents: number;
}

export function getShoppingList(): Promise<{ batch_id: string | null; items: ShoppingItem[] }> {
  return api("/admin/lote/lista-compra", { authenticated: true });
}

// Gestão de produtos — publicar/despublicar, corrigir preço, revisar a fila
// do disjuntor (preços travados por variação suspeita na sincronização).

export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  category: string;
  metal: string;
  price_cents: number;
  cost_cents: number;
  published: boolean;
  featured: boolean;
  auto_price: boolean;
  suggested_price_cents: number | null;
  suggestion_reason: string | null;
}

export function listAdminProducts(opts: { search?: string; pendingOnly?: boolean } = {}): Promise<AdminProduct[]> {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.pendingOnly) params.set("pending", "true");
  return api<AdminProduct[] | null>(`/admin/produtos?${params}`, { authenticated: true }).then((r) => r ?? []);
}

export interface AdminProductPatch {
  price_cents?: number;
  published?: boolean;
  featured?: boolean;
  accept_suggestion?: boolean;
}

export function updateAdminProduct(id: string, patch: AdminProductPatch): Promise<{ ok: boolean }> {
  return api(`/admin/produtos/${id}`, { method: "PUT", authenticated: true, body: patch });
}
