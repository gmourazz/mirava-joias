// Botão da cliente para cancelar o pedido, com confirmação. Se já houve
// pagamento, o servidor estorna no Mercado Pago antes de cancelar.

import { useState } from "react";
import { X } from "lucide-react";
import { ApiError } from "../lib/api";
import { formatarBRL } from "../lib/dinheiro";
import { cancelOrder, podeCancelar, type Order } from "../lib/pedidos";

export default function CancelarPedido({ order, onCancelado }: { order: Order; onCancelado: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!podeCancelar(order.status)) return null;

  const pago = order.status !== "awaiting_payment";

  async function cancelar() {
    setEnviando(true);
    setErro(null);
    try {
      await cancelOrder(order.id);
      onCancelado();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui cancelar agora. Tente de novo.");
      setEnviando(false);
    }
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-line-strong bg-white px-4 py-2 text-[13px] font-semibold text-text-2 hover:border-[#B4443C] hover:text-[#B4443C]"
      >
        <X size={14} strokeWidth={2} />
        Cancelar pedido
      </button>
    );
  }

  return (
    <div className="grid w-full gap-3 rounded-[18px] bg-[#FDECEC] px-4 py-3.5 text-[13.5px] leading-relaxed text-[#B4443C]">
      <p className="m-0">
        {pago
          ? `Cancelar o pedido #${order.number}? Estornamos ${formatarBRL(order.total_cents)} pelo Mercado Pago, e o prazo para o valor aparecer depende do seu banco ou da operadora do cartão.`
          : `Cancelar o pedido #${order.number}? Nada foi cobrado.`}
      </p>
      {erro && <p className="m-0 font-semibold">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={enviando}
          onClick={() => void cancelar()}
          className="cursor-pointer rounded-full border-none bg-[#B4443C] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {enviando ? "Cancelando…" : "Sim, cancelar"}
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={() => setConfirmando(false)}
          className="cursor-pointer rounded-full border-none bg-white px-4 py-2 text-[13px] font-semibold text-text-2"
        >
          Manter pedido
        </button>
      </div>
    </div>
  );
}
