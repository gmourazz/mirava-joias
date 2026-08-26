// Selo colorido de status do pedido — mesmo texto de STATUS_LABEL, a cor
// muda o suficiente pra bater o olho no fluxo (pago = verde, enviado =
// azul, cancelado/estornado = vermelho) sem inventar uma paleta nova por
// tela: usado na tabela de Pedidos e no cabeçalho do detalhe.

import { STATUS_LABEL } from "../../lib/admin";

const TONE: Record<string, string> = {
  awaiting_payment: "bg-cream text-ink-soft",
  paid: "bg-success-soft text-success",
  in_batch: "bg-warning-soft text-warning",
  purchased_from_supplier: "bg-warning-soft text-warning",
  received_by_owner: "bg-info-soft text-info",
  shipped: "bg-info-soft text-info",
  delivered: "bg-success-soft text-success",
  cancelled: "bg-danger-soft text-danger",
  refunded: "bg-danger-soft text-danger",
  out_of_stock: "bg-danger-soft text-danger",
};

export default function StatusPill({ status }: { status: string }) {
  const tone = TONE[status] ?? "bg-blush text-wine-dark";
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${tone}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
