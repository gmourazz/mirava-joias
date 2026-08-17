// Linha do tempo do pedido — o que a cliente abre quando quer saber "e aí?".
//
// Mostra quatro etapas, não os nove estados internos. Entre o pagamento e a
// postagem existem lote, compra na fornecedora e recebimento pela dona; para
// quem está esperando, isso é tudo a mesma coisa: "em preparação". A tradução
// mora em lib/pedidos.ts (e no Go, em dominio.PublicStage).

import { Check, Copy, Mail, Package, Truck } from "lucide-react";
import { useState } from "react";
import {
  STAGE_LABEL,
  TIMELINE,
  formatDate,
  stageOf,
  trackingURL,
  supportURL,
  type Order,
} from "../lib/pedidos";
import { formatarBRL } from "../lib/dinheiro";

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
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-blush pb-4">
        <div>
          <h1 className="m-0 font-serif text-[26px] leading-tight font-normal">
            Pedido #{order.number}
          </h1>
          <p className="m-0 mt-1 text-[12px] text-mauve">
            Feito em {formatDate(order.created_at)}
          </p>
        </div>
        <span className="rounded-full bg-cream px-4 py-1.5 text-[11.5px] tracking-[0.1em] text-wine-dark uppercase">
          {STAGE_LABEL[stage]}
        </span>
      </div>

      {encerrado ? (
        <p className="m-0 rounded-[12px] bg-blush px-4 py-3.5 text-[13px] leading-relaxed text-wine-dark">
          Este pedido foi encerrado. Se você não pediu isso ou ficou com dúvida,
          escreve pra gente por e-mail que resolvemos.
        </p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-0 p-0">
          {TIMELINE.map((etapa, i) => {
            const feito = i <= atual;
            const ultimo = i === TIMELINE.length - 1;
            return (
              <li key={etapa.stage} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition"
                    style={{
                      borderColor: feito ? "#8E3B6B" : "#E3B1C8",
                      background: feito ? "#8E3B6B" : "transparent",
                      color: feito ? "#fff" : "#E3B1C8",
                    }}
                  >
                    {feito ? <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> : null}
                  </span>
                  {!ultimo && (
                    <span
                      className="w-px flex-1"
                      style={{ background: i < atual ? "#8E3B6B" : "#FFE5F0" }}
                    />
                  )}
                </div>

                <div className={ultimo ? "pb-0" : "pb-7"}>
                  <p
                    className="m-0 font-serif text-[16px] leading-none"
                    style={{ color: feito ? "#8E3B6B" : "#B49AA6" }}
                  >
                    {etapa.label}
                  </p>
                  <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                    {etapa.hint}
                  </p>

                  {etapa.stage === "enviado" && order.tracking_code && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <code className="rounded-[8px] bg-cream px-3 py-1.5 font-sans text-[13px] tracking-[0.06em] text-ink">
                        {order.tracking_code}
                      </code>
                      <button
                        type="button"
                        onClick={copiarRastreio}
                        className="flex cursor-pointer items-center gap-1 border-none bg-none p-1 text-[11.5px] text-mauve hover:text-wine"
                      >
                        <Copy className="h-3 w-3" strokeWidth={1.8} />
                        {copiado ? "copiado" : "copiar"}
                      </button>
                      <a
                        href={trackingURL(order.tracking_code)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-full border border-mauve px-3.5 py-1.5 text-[11.5px] text-ink hover:border-wine hover:text-wine"
                      >
                        <Truck className="h-3 w-3" strokeWidth={1.8} />
                        Rastrear nos Correios
                      </a>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Itens */}
      <div className="border-t border-blush pt-6">
        <h2 className="m-0 mb-4 flex items-center gap-2 font-serif text-[17px] font-normal">
          <Package className="h-4 w-4 text-wine" strokeWidth={1.6} />
          Peças
        </h2>
        <div className="flex flex-col gap-3">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-ink-soft">
                <span className="font-serif text-[14.5px] text-ink">{item.name}</span>
                {item.size && ` · ${item.size}`}
                {item.quantity > 1 && ` · ${item.quantity} un.`}
              </span>
              <span className="shrink-0 text-ink">
                {formatarBRL(item.price_cents * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-1.5 border-t border-blush pt-4 text-[13px]">
          <div className="flex justify-between text-ink-soft">
            <span>Subtotal</span>
            <span>{formatarBRL(order.subtotal_cents)}</span>
          </div>
          <div className="flex justify-between text-ink-soft">
            <span>Frete</span>
            <span>
              {order.shipping_cents === 0 ? (
                <span className="text-wine">Grátis</span>
              ) : (
                formatarBRL(order.shipping_cents)
              )}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between border-t border-blush pt-3">
            <span className="text-[11px] tracking-[0.18em] text-ink-soft uppercase">Total</span>
            <span className="text-[20px] text-ink">{formatarBRL(order.total_cents)}</span>
          </div>
        </div>
      </div>

      <a
        href={supportURL(order.number)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2.5 rounded-full border border-wine/70 p-3.5 font-serif text-[13px] font-semibold tracking-[0.16em] text-wine uppercase hover:bg-wine hover:text-white"
      >
        <Mail className="h-4 w-4" strokeWidth={1.6} />
        Falar sobre este pedido
      </a>
    </div>
  );
}
