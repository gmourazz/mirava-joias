// Etiqueta + declaração de conteúdo (v5), para imprimir e colar na caixa.
//
// O endereço da cliente é o do pedido; o remetente vem de Configurações
// (em branco para preencher à mão enquanto não for cadastrado). A declaração
// lista as peças com o valor pago.

import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { formatarBRL } from "../lib/dinheiro";
import { useEffect, useState } from "react";
import { SHIP_LABEL, lojaApi, type AdminOrderDetail, type StoreSettings } from "./api";
import logoPreto from "../assets/logos/2 - Logo sem SEMIJOIAS/mirava-logo-preto.svg";

export default function Etiqueta({ pedido, fechar }: { pedido: AdminOrderDetail; fechar: () => void }) {
  const a = pedido.address ?? {};
  const [loja, setLoja] = useState<StoreSettings | null>(null);
  useEffect(() => {
    lojaApi.settings().then(setLoja).catch(() => {});
  }, []);
  // Portal no body: o conteúdo do painel tem animação de entrada, que cria
  // um contexto de empilhamento — sem o portal, o véu não cobriria o topo
  // nem a sidebar.
  return createPortal(
    <div className="print-area fixed inset-0 z-[80] grid place-items-center overflow-y-auto p-4 print:static print:block print:p-0">
      <div className="animate-fade-in absolute inset-0 bg-teal-dark/40 print:hidden" onClick={fechar} />
      <div className="animate-pop relative grid max-h-[90vh] w-[min(720px,100%)] gap-5 overflow-y-auto rounded-3xl bg-white p-6 print:max-h-none print:w-full print:rounded-none print:p-0">
        <div className="flex items-center justify-between print:hidden">
          <span className="font-serif text-[24px] text-teal-dark">Etiqueta e declaração · #{pedido.number}</span>
          <button type="button" aria-label="Fechar" onClick={fechar} className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-none bg-chip">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-4 rounded-xl border-2 border-text p-5 font-mono text-[13px] text-text">
          <div className="flex items-center justify-between">
            <img src={logoPreto} alt="Mirava" className="h-9 w-auto" />
            <span className="rounded border-2 border-text px-2 py-1 font-bold">
              {pedido.shipping_method ? SHIP_LABEL[pedido.shipping_method] : "CORREIOS"}
            </span>
          </div>
          {pedido.tracking_code && <span className="text-center text-[15px] font-bold tracking-[0.2em]">{pedido.tracking_code}</span>}
          <div className="grid gap-1 border-t-2 border-dashed border-text pt-3">
            <strong>DESTINATÁRIO</strong>
            <span>{a.recipient ?? pedido.customer_name}</span>
            <span>
              {a.street}, {a.number}
              {a.complement && ` · ${a.complement}`}
            </span>
            <span>{a.neighborhood}</span>
            <span>
              {a.city}/{a.state} · CEP {a.zip_code}
            </span>
          </div>
          <div className="grid gap-1 border-t-2 border-dashed border-text pt-3">
            <strong>REMETENTE</strong>
            <span>{loja?.sender_name || loja?.store_name || "Mirava Semijoias"}</span>
            {loja?.sender_street ? (
              <>
                <span>
                  {loja.sender_street}, {loja.sender_number}
                  {loja.sender_complement && ` · ${loja.sender_complement}`}
                </span>
                <span>
                  {loja.sender_neighborhood} · {loja.sender_city}/{loja.sender_state} · CEP {loja.sender_zip.replace(/(\d{5})(\d{3})/, "$1-$2")}
                </span>
              </>
            ) : (
              <>
                <span className="mt-2 border-b border-text" />
                <span className="mt-4 border-b border-text" />
              </>
            )}
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border-2 border-text p-5 text-[13px] text-text">
          <strong className="text-center tracking-[0.1em]">DECLARAÇÃO DE CONTEÚDO</strong>
          <div className="grid grid-cols-[1fr_50px_100px] gap-2 border-b border-text pb-1 font-bold">
            <span>Conteúdo</span>
            <span className="text-center">Qtd</span>
            <span className="text-right">Valor</span>
          </div>
          {pedido.items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_50px_100px] gap-2">
              <span>{it.name}</span>
              <span className="text-center">{it.quantity}</span>
              <span className="text-right">{formatarBRL(it.price_cents * it.quantity)}</span>
            </div>
          ))}
          {pedido.discount_cents > 0 && (
            <div className="grid grid-cols-[1fr_100px] gap-2">
              <span>Desconto</span>
              <span className="text-right">− {formatarBRL(pedido.discount_cents)}</span>
            </div>
          )}
          <div className="grid grid-cols-[1fr_100px] gap-2 border-t border-text pt-1 font-bold">
            <span>Total</span>
            <span className="text-right">{formatarBRL(pedido.subtotal_cents - pedido.discount_cents)}</span>
          </div>
          <p className="m-0 text-[12px]">
            Declaro que não me enquadro no conceito de contribuinte previsto na Lei Complementar nº 87/1996.
          </p>
          <span className="mt-6 border-t border-text pt-1 text-center text-[12px]">Assinatura do remetente</span>
        </div>

        {pedido.gift_wrap && (
          // Cartão do presente: sai na mesma folha, para recortar e escrever
          // à mão — a mensagem é da cliente, não vai impressa na caixa.
          <div className="grid gap-2 rounded-xl border-2 border-dashed border-text p-5 text-[13px] text-text">
            <strong className="tracking-[0.1em]">PRESENTE · CARTÃO</strong>
            <span className="text-[15px] leading-relaxed whitespace-pre-line">{pedido.gift_message || "(sem mensagem)"}</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => window.print()}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-full border-none bg-teal px-5 py-3.5 text-[14px] font-semibold text-white hover:bg-teal-dark print:hidden"
        >
          <Printer size={16} strokeWidth={1.8} />
          Imprimir
        </button>
      </div>
    </div>,
    document.body,
  );
}
