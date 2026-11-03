// Linha do tempo do pedido (v5) — o que a cliente abre quando quer saber
// "e aí?".
//
// Mostra quatro etapas, não os dez estados internos. Entre o pagamento e a
// postagem existem lote, compra na fornecedora e recebimento pela dona; para
// quem está esperando, isso é tudo a mesma coisa: "em preparação". A tradução
// mora em lib/pedidos.ts (e no Go, em dominio.PublicStage).

import { Check, Copy, Gift, Mail, Package, Truck, CreditCard } from "lucide-react";
import { useState } from "react";
import {
  STAGE_LABEL,
  TIMELINE,
  formatDate,
  stageOf,
  trackingURL,
  supportURL,
  type Order,
  type Stage,
} from "../lib/pedidos";
import { formatarBRL } from "../lib/dinheiro";

const ICONE: Record<Stage, typeof Check> = {
  aguardando: CreditCard,
  preparacao: Package,
  enviado: Truck,
  entregue: Gift,
  encerrado: Check,
};

export default function AcompanhamentoPedido({ order }: { order: Order }) {
  const [copiado, setCopiado] = useState(false);
  const stage = stageOf(order.status);
  const atual = TIMELINE.findIndex((t) => t.stage === stage);
  const encerrado = stage === "encerrado";

  function copiarRastreio() {
    if (!order.tracking_code) return;
    void navigator.clipboard.writeText(order.tracking_code).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-3xl border border-line bg-white p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 font-serif text-[26px] leading-tight font-normal text-teal-dark">Pedido #{order.number}</h2>
            <p className="m-0 mt-1 text-[13.5px] text-muted">
              Feito em {formatDate(order.created_at)}
              {order.shipping_method && ` · ${order.shipping_method === "sedex" ? "SEDEX" : "PAC"}`}
            </p>
          </div>
          <span className={`rounded-full px-4 py-1.5 text-[13px] font-semibold ${stage === "enviado" ? "bg-teal text-white" : "bg-mist text-teal"}`}>
            {STAGE_LABEL[stage]}
          </span>
        </div>

        {encerrado ? (
          <p className="m-0 rounded-[18px] bg-mist px-4 py-3.5 text-[14px] leading-relaxed text-text-2">
            Este pedido foi encerrado. Se você não pediu isso ou ficou com dúvida, escreve pra gente por e-mail que resolvemos.
          </p>
        ) : (
          <ol className="m-0 flex list-none flex-col p-0">
            {TIMELINE.map((etapa, i) => {
              const feito = i < atual;
              const agora = i === atual;
              const ultimo = i === TIMELINE.length - 1;
              const Icon = ICONE[etapa.stage];
              return (
                <li key={etapa.stage} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full ${
                        feito || agora ? "bg-teal text-white" : "bg-[#EEF3F2] text-faint"
                      }`}
                    >
                      {feito ? <Check size={16} strokeWidth={2.6} /> : <Icon size={16} strokeWidth={1.8} />}
                    </span>
                    {!ultimo && <span className={`w-0.5 flex-1 ${i < atual ? "bg-teal" : "bg-[#EEF3F2]"}`} />}
                  </div>

                  <div className={ultimo ? "pb-0" : "pb-6"}>
                    <p className={`m-0 pt-1.5 text-[15px] font-semibold ${feito || agora ? "text-text" : "text-faint"}`}>{etapa.label}</p>
                    <p className="m-0 mt-1 text-[13px] leading-relaxed text-muted">{etapa.hint}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {order.tracking_code && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[18px] bg-mist px-4 py-3.5">
            <span className="grid flex-1 gap-0.5">
              <span className="text-[12.5px] text-muted">Código de rastreio</span>
              <code className="font-mono text-[17px] font-bold tracking-[0.04em] text-text">{order.tracking_code}</code>
            </span>
            <button
              type="button"
              onClick={copiarRastreio}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-line-strong bg-white px-4 py-2 text-[13px] font-semibold text-teal"
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={1.8} />
              {copiado ? "Copiado" : "Copiar"}
            </button>
            <a
              href={trackingURL(order.tracking_code)}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] font-semibold text-teal underline"
            >
              Ver nos Correios ↗
            </a>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-line bg-white p-6">
        <h2 className="m-0 mb-4 font-serif text-[22px] font-normal text-teal-dark">Peças</h2>
        <div className="flex flex-col gap-3">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 text-[14px]">
              <span className="text-muted">
                <span className="font-medium text-text">{item.name}</span>
                {item.size && ` · ${item.size}`}
                {item.quantity > 1 && ` · ${item.quantity} un.`}
              </span>
              <span className="shrink-0 text-text">{formatarBRL(item.price_cents * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-[14px] text-text-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatarBRL(order.subtotal_cents)}</span>
          </div>
          <div className="flex justify-between">
            <span>Frete</span>
            <span>{order.shipping_cents === 0 ? <span className="font-semibold text-teal">Grátis</span> : formatarBRL(order.shipping_cents)}</span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between border-t border-line pt-3">
            <span className="text-[15px] font-semibold text-text">Total</span>
            <span className="text-[22px] font-bold text-teal">{formatarBRL(order.total_cents)}</span>
          </div>
        </div>
      </div>

      <a
        href={supportURL(order.number)}
        className="flex items-center justify-center gap-2.5 rounded-full bg-teal p-4 text-[14px] font-semibold text-white hover:bg-teal-dark hover:text-white"
      >
        <Mail className="h-4 w-4" strokeWidth={1.8} />
        Falar sobre este pedido
      </a>
    </div>
  );
}
