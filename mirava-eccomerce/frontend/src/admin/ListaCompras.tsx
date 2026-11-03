// "Lista de compras Use Lilly" (v5), com a regra do lote (decisão 23): cada
// lote mostra a barra até a meta de R$300 de frete grátis no atacado e a
// idade do pedido mais antigo contra o teto de 5 dias úteis. As peças vêm
// agrupadas por SKU, prontas para copiar no carrinho da Lilly.
//
// "Já comprei tudo na Lilly" move os pedidos do lote para "comprado"; "Recebi
// as peças" move para "recebido". As duas ações moram na API (PurchaseBatch,
// ReceiveBatch), em transação.

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Copy, Download, ExternalLink, PackageCheck, X } from "lucide-react";
import { formatarBRL } from "../lib/dinheiro";
import { imageUrl } from "../catalogo/consultas";
import { ApiError } from "../lib/api";
import { adminApi, dataCurta, type Batch } from "./api";
import { baixarCSV, reaisCSV } from "./csv";

const STATUS_LOTE: Record<Batch["status"], string> = {
  open: "Aberto · acumulando",
  closed: "Fechado · comprar na Lilly",
  purchased: "Comprado · esperando chegar",
};

export default function ListaCompras({ fechar, mudou }: { fechar: () => void; mudou: () => void }) {
  const [lotes, setLotes] = useState<Batch[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = () => adminApi.batches().then(setLotes).catch((e: Error) => setErro(e.message));
  useEffect(() => {
    void carregar();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fechar]);

  const visiveis = lotes?.filter((l) => l.items.length > 0 || l.status !== "open") ?? [];

  // Portal no body: o conteúdo do painel tem animação de entrada, que cria
  // um contexto de empilhamento — sem o portal, o véu não cobriria o topo
  // nem a sidebar.
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="animate-fade-in absolute inset-0 bg-teal-dark/40" onClick={fechar} />
      <div className="animate-pop relative flex max-h-[90vh] w-[min(720px,100%)] flex-col overflow-hidden rounded-3xl bg-white">
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
          <div className="grid gap-1">
            <span className="font-serif text-[26px] leading-none text-teal-dark">Lista de compras Use Lilly</span>
            <span className="text-[13px] text-muted">Copie a lista e faça a compra no site da Lilly</span>
          </div>
          <button type="button" aria-label="Fechar" onClick={fechar} className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-none bg-chip">
            <X size={18} />
          </button>
        </div>

        <div className="grid flex-1 content-start gap-5 overflow-y-auto px-6 py-5">
          {erro && <p className="m-0 rounded-2xl bg-[#FDECEC] px-4 py-3 text-[13.5px] text-[#B4443C]">{erro}</p>}
          {!lotes && !erro && <p className="m-0 text-muted">Carregando…</p>}
          {lotes && visiveis.length === 0 && (
            <p className="m-0 py-10 text-center text-muted">Nenhum pedido pago aguardando compra na Lilly.</p>
          )}
          {visiveis.map((l) => (
            <Lote key={l.id} lote={l} depois={() => { void carregar(); mudou(); }} />
          ))}
        </div>

        <div className="border-t border-line px-6 py-4">
          <a
            href="https://www.uselilly.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 text-[13.5px] font-semibold text-teal"
          >
            Abrir site da Lilly <ExternalLink size={14} strokeWidth={1.8} />
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Lote({ lote, depois }: { lote: Batch; depois: () => void }) {
  const [ref, setRef] = useState(lote.supplier_order_ref ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const pecas = lote.items.reduce((s, i) => s + i.quantity, 0);
  const meta = Math.min(100, (lote.total_cost_cents / lote.goal_cents) * 100);
  const falta = Math.max(0, lote.goal_cents - lote.total_cost_cents);
  const tetoBatido = lote.oldest_days >= lote.days_cap;

  const texto = lote.items.map((i) => `${i.quantity}x ${i.sku ?? "sem SKU"} ${i.name}${i.size ? ` (${i.size})` : ""}`).join("\n");

  async function acao(fn: () => Promise<unknown>) {
    setErro(null);
    setSalvando(true);
    try {
      await fn();
      depois();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="grid gap-4 rounded-[20px] border border-line p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-[16px] text-text">Lote #{lote.number}</strong>
        <span className="rounded-full bg-mist px-3 py-1 text-[12px] font-semibold text-teal">{STATUS_LOTE[lote.status]}</span>
      </div>

      {lote.status !== "purchased" && (
        <div className="grid gap-2">
          <div className="flex flex-wrap justify-between gap-2 text-[13px]">
            <span className="text-text-2">
              {falta > 0 ? <>Faltam <strong className="text-text">{formatarBRL(falta)}</strong> para o frete grátis no atacado</> : <strong className="text-success">Meta de frete grátis atingida ✦</strong>}
            </span>
            <span className={tetoBatido ? "font-semibold text-[#C4483D]" : "text-muted"}>
              Pedido mais antigo: {lote.oldest_days} de {lote.days_cap} dias úteis
            </span>
          </div>
          <span className="h-2 overflow-hidden rounded-full bg-[#E0EAE9]">
            <span className="block h-full rounded-full bg-teal transition-[width] duration-500" style={{ width: `${meta}%` }} />
          </span>
          {tetoBatido && falta > 0 && (
            <span className="text-[12.5px] text-[#C4483D]">Passou do teto de dias: compre mesmo sem a meta e pague o frete — atraso custa mais.</span>
          )}
        </div>
      )}

      {lote.items.length > 0 ? (
        <div className="grid">
          <div className="grid grid-cols-[1fr_96px_44px_84px_90px] gap-2 border-b border-line pb-2 text-[11.5px] font-bold tracking-[0.06em] text-muted uppercase">
            <span>Peça</span>
            <span>SKU</span>
            <span className="text-center">Qtd</span>
            <span className="text-right">Atacado</span>
            <span className="text-right">Subtotal</span>
          </div>
          {lote.items.map((i, k) => {
            const foto = imageUrl(i.image ?? undefined);
            return (
              <div key={k} className="grid grid-cols-[1fr_96px_44px_84px_90px] items-center gap-2 border-b border-[#EEF3F2] py-2.5 text-[13.5px]">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-mist-3">{foto && <img src={foto} alt="" className="h-full w-full object-cover" />}</span>
                  <span className="truncate">{i.name}{i.size && <span className="text-muted"> · {i.size}</span>}</span>
                </span>
                <span className="font-mono text-[12.5px]">{i.sku ?? "—"}</span>
                <span className="text-center font-semibold">{i.quantity}</span>
                <span className="text-right">{formatarBRL(i.unit_cost_cents)}</span>
                <span className="text-right font-semibold">{formatarBRL(i.subtotal_cents)}</span>
              </div>
            );
          })}
          <div className="mt-3 flex items-center justify-between rounded-xl bg-mist px-4 py-3">
            <span className="text-[13.5px] text-text-2">
              Total a pagar na Lilly · {pecas} {pecas === 1 ? "peça" : "peças"} de {lote.orders_count} {lote.orders_count === 1 ? "pedido" : "pedidos"}
            </span>
            <strong className="text-[17px] text-teal-dark">{formatarBRL(lote.total_cost_cents)}</strong>
          </div>
        </div>
      ) : (
        <p className="m-0 text-[13.5px] text-muted">Nenhuma peça neste lote ainda.</p>
      )}

      {lote.status === "purchased" && lote.purchased_at && (
        <span className="text-[13px] text-text-2">
          Comprado em {dataCurta(lote.purchased_at)}
          {lote.supplier_order_ref && <> · pedido na Lilly <strong>{lote.supplier_order_ref}</strong></>}
        </span>
      )}

      {erro && <p className="m-0 rounded-xl bg-[#FDECEC] px-3.5 py-2.5 text-[13px] text-[#B4443C]">{erro}</p>}

      <div className="flex flex-wrap gap-2">
        {lote.items.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(texto).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1800); })}
              className="flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-line-strong bg-white px-4 py-2.5 text-[13px] font-semibold text-teal"
            >
              <Copy size={15} strokeWidth={1.8} />
              {copiado ? "Copiada!" : "Copiar lista"}
            </button>
            <button
              type="button"
              onClick={() =>
                baixarCSV(`compra-lilly-lote-${lote.number}.csv`, [
                  ["Peça", "SKU", "Tamanho", "Qtd", "Atacado", "Subtotal"],
                  ...lote.items.map((i) => [i.name, i.sku ?? "", i.size ?? "", i.quantity, reaisCSV(i.unit_cost_cents), reaisCSV(i.subtotal_cents)]),
                ])
              }
              className="flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-line-strong bg-white px-4 py-2.5 text-[13px] font-semibold text-teal"
            >
              <Download size={15} strokeWidth={1.8} />
              Exportar planilha
            </button>
          </>
        )}
      </div>

      {lote.status !== "purchased" && lote.items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="Nº do pedido na Lilly (opcional)"
            className="min-w-[200px] flex-1 rounded-full border-[1.5px] border-line px-4 py-2.5 text-[13.5px] outline-none focus:border-teal"
          />
          <button
            type="button"
            disabled={salvando}
            onClick={() => void acao(() => adminApi.purchaseBatch(lote.id, ref))}
            className="cursor-pointer rounded-full border-none bg-teal px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-teal-dark disabled:opacity-50"
          >
            Já comprei tudo na Lilly
          </button>
        </div>
      )}

      {lote.status === "purchased" && (
        <button
          type="button"
          disabled={salvando}
          onClick={() => void acao(() => adminApi.receiveBatch(lote.id))}
          className="flex w-fit cursor-pointer items-center gap-2 rounded-full border-none bg-teal px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-teal-dark disabled:opacity-50"
        >
          <PackageCheck size={16} strokeWidth={1.8} />
          Recebi as peças deste lote
        </button>
      )}
    </section>
  );
}
