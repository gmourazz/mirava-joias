// Pedidos da cliente — para ela acompanhar depois de pagar.

import { api } from "./api";
import { LOJA } from "../config/loja";

export type OrderStatus =
  | "awaiting_payment"
  | "paid"
  | "in_batch"
  | "purchased_from_supplier"
  | "received_by_owner"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "out_of_stock";

export interface OrderItem {
  name: string;
  size: string | null;
  quantity: number;
  price_cents: number;
}

export interface Order {
  id: string;
  number: number;
  status: OrderStatus;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  shipping_method: string | null;
  tracking_code: string | null;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  items: OrderItem[];
}

export function listOrders(): Promise<Order[]> {
  return api<Order[] | null>("/pedidos", { authenticated: true }).then((r) => r ?? []);
}

export function getOrder(id: string): Promise<Order> {
  return api<Order>(`/pedidos/${id}`, { authenticated: true });
}

/** As quatro etapas que a cliente acompanha.
 *
 *  Os estados internos entre o pagamento e a postagem (lote, comprado na
 *  fornecedora, recebido pela dona) são detalhe de operação: para quem está
 *  esperando, é tudo "em preparação". A mesma regra existe no Go, em
 *  dominio.PublicStage — mudou lá, mude aqui. */
export type Stage = "aguardando" | "preparacao" | "enviado" | "entregue" | "encerrado";

export function stageOf(status: OrderStatus): Stage {
  switch (status) {
    case "awaiting_payment":
      return "aguardando";
    case "paid":
    case "in_batch":
    case "purchased_from_supplier":
    case "received_by_owner":
      return "preparacao";
    case "shipped":
      return "enviado";
    case "delivered":
      return "entregue";
    default:
      return "encerrado";
  }
}

export const STAGE_LABEL: Record<Stage, string> = {
  aguardando: "Aguardando pagamento",
  preparacao: "Em preparação",
  enviado: "A caminho",
  entregue: "Entregue",
  encerrado: "Encerrado",
};

/** A linha do tempo mostrada no detalhe do pedido, na ordem. */
export const TIMELINE: { stage: Stage; label: string; hint: string }[] = [
  {
    stage: "aguardando",
    label: "Pedido feito",
    hint: "Assim que o pagamento cair, a gente começa.",
  },
  {
    stage: "preparacao",
    label: "Em preparação",
    hint: "Sua peça está sendo encomendada, conferida e embalada.",
  },
  {
    stage: "enviado",
    label: "A caminho",
    hint: "Postado nos Correios, com código de rastreio.",
  },
  { stage: "entregue", label: "Entregue", hint: "Chegou até você." },
];

export function trackingURL(code: string): string {
  return `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(code)}`;
}

/** Link de e-mail com o número do pedido já no assunto — o atendimento da
 *  Mirava é por e-mail, não por WhatsApp. */
export function supportURL(orderNumber: number): string {
  const assunto = `Pedido #${orderNumber}`;
  return `mailto:${LOJA.email}?subject=${encodeURIComponent(assunto)}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
