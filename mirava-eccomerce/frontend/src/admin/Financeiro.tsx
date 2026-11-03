// Financeiro do painel (v5): fechamento do mês com faturamento, custo na
// Lilly, taxas reais do Mercado Pago, embalagem, frete dos lotes e o lucro
// líquido; "para onde vai cada R$ 100", lucro por categoria, peças que mais
// dão lucro e a tabela de pedidos do mês.
//
// Toda conta é do servidor (dominio.MonthlyFinance). A tela só exibe e
// calcula proporções para desenhar as barras.

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { formatarBRL } from "../lib/dinheiro";
import { CATEGORY_LABEL } from "../catalogo/tipos";
import { reportApi, SHIP_LABEL, dataCurta, type FinanceMonth } from "./api";
import { baixarCSV, reaisCSV } from "./csv";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function andarMes(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nomeMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

export default function Financeiro() {
  const [mes, setMes] = useState(mesAtual);
  const [dados, setDados] = useState<FinanceMonth | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setDados(null);
    setErro(null);
    reportApi.finance(mes).then(setDados).catch((e: Error) => setErro(e.message));
  }, [mes]);

  const atual = mes === mesAtual();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Mês anterior" onClick={() => setMes(andarMes(mes, -1))} className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-[1.5px] border-line bg-white text-teal">
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-[180px] text-center font-serif text-[22px] text-teal-dark first-letter:uppercase">{nomeMes(mes)}</span>
          <button
            type="button"
            aria-label="Próximo mês"
            disabled={atual}
            onClick={() => setMes(andarMes(mes, 1))}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-[1.5px] border-line bg-white text-teal disabled:opacity-40"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        {dados && dados.orders.length > 0 && (
          <button
            type="button"
            onClick={() => exportar(dados)}
            className="flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-line-strong bg-white px-5 py-2.5 text-[13.5px] font-semibold text-teal"
          >
            <Download size={16} strokeWidth={1.8} />
            Exportar relatório
          </button>
        )}
      </div>

      {erro && <p className="m-0 rounded-[20px] bg-[#FDECEC] p-4 text-[#B4443C]">{erro}</p>}
      {!dados && !erro && <p className="m-0 text-muted">Carregando…</p>}

      {dados && (
        <>
          <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-3">
            <Kpi label="Faturamento" valor={dados.revenue_cents} nota={`${dados.orders_count} ${dados.orders_count === 1 ? "pedido pago" : "pedidos pagos"} · inclui frete`} />
            <Kpi label="Custo Use Lilly" valor={-dados.cost_cents} nota={pct(dados.cost_cents, dados.subtotal_cents)} />
            <Kpi label="Taxas do Mercado Pago" valor={-dados.fees_cents} nota={`${pct(dados.fees_cents, dados.subtotal_cents)} · taxa real de cada pagamento`} />
            <Kpi label="Embalagem" valor={-dados.packaging_cents} nota={`${formatarBRL(dados.packaging_each_cents)} por pedido`} />
            <Kpi label="Frete dos lotes" valor={-dados.batch_freight_cents} nota="pago à Lilly em lote abaixo da meta" />
            <div className="col-span-full grid gap-1 rounded-[20px] bg-teal p-5 text-white">
              <span className="text-[13px] text-[#BFE3DF]">Lucro líquido do mês</span>
              <span className="font-serif text-[clamp(28px,3vw,38px)] leading-none">{formatarBRL(dados.net_profit_cents)}</span>
              <span className="text-[13px] text-[#BFE3DF]">
                {Math.round(dados.net_margin_pct)}% da venda das peças · lucro bruto {formatarBRL(dados.gross_profit_cents)} · frete cobrado das clientes (
                {formatarBRL(dados.shipping_cents)}) é repasse aos Correios e não entra no lucro
              </span>
            </div>
          </section>

          {dados.subtotal_cents > 0 ? (
            <>
              <ParaOndeVai dados={dados} />
              <section className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
                <Barras
                  titulo="Lucro por categoria no mês"
                  itens={dados.categories.map((c) => ({ ...c, label: CATEGORY_LABEL[c.label as keyof typeof CATEGORY_LABEL] ?? c.label }))}
                />
                <Barras titulo="Peças que mais dão lucro" itens={dados.top_pieces} />
              </section>
              <TabelaPedidos dados={dados} />
            </>
          ) : (
            <p className="m-0 rounded-[20px] border border-line bg-white p-10 text-center text-muted">Nenhum pedido pago em {nomeMes(mes)}.</p>
          )}
        </>
      )}
    </>
  );
}

function pct(parte: number, total: number) {
  return total > 0 ? `${Math.round((parte / total) * 100)}% da venda` : "—";
}

function Kpi({ label, valor, nota }: { label: string; valor: number; nota: string }) {
  return (
    <div className="grid gap-1.5 rounded-[20px] border border-line bg-white p-[18px]">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className={`font-serif text-[clamp(20px,2vw,26px)] leading-none ${valor < 0 ? "text-[#B4443C]" : "text-teal-dark"}`}>
        {valor < 0 ? `− ${formatarBRL(-valor)}` : formatarBRL(valor)}
      </span>
      <span className="text-[12px] text-muted">{nota}</span>
    </div>
  );
}

function ParaOndeVai({ dados }: { dados: FinanceMonth }) {
  const base = dados.subtotal_cents;
  const fatias = [
    { label: "Lucro líquido", v: Math.max(0, dados.net_profit_cents), cor: "#0F6E73" },
    { label: "Custo Lilly", v: dados.cost_cents, cor: "#9FDCD5" },
    { label: "Embalagem e frete dos lotes", v: dados.packaging_cents + dados.batch_freight_cents, cor: "#CFE6E4" },
    { label: "Taxas", v: dados.fees_cents, cor: "#E8B4AE" },
  ];
  return (
    <section className="grid gap-3 rounded-[20px] border border-line bg-white p-[22px]">
      <strong className="text-[16px] text-text">Para onde vai cada R$ 100 em peças vendidas</strong>
      <div className="flex h-[22px] overflow-hidden rounded-full bg-fog">
        {fatias.map((f) => (
          <span key={f.label} style={{ width: `${(f.v / base) * 100}%`, background: f.cor }} title={f.label} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-text-2">
        {fatias.map((f) => (
          <span key={f.label} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: f.cor }} />
            {f.label} · <strong className="text-text">R$ {Math.round((f.v / base) * 100)}</strong>
          </span>
        ))}
      </div>
    </section>
  );
}

function Barras({ titulo, itens }: { titulo: string; itens: { label: string; units: number; profit_cents: number }[] }) {
  const max = Math.max(1, ...itens.map((i) => i.profit_cents));
  return (
    <section className="grid content-start gap-3 rounded-[20px] border border-line bg-white p-[22px]">
      <strong className="text-[16px] text-text">{titulo}</strong>
      {itens.length === 0 && <span className="text-muted">Sem vendas no mês.</span>}
      {itens.map((i) => (
        <div key={i.label} className="grid gap-1.5">
          <div className="flex justify-between gap-3 text-[13.5px]">
            <span className="truncate text-text">{i.label}</span>
            <span className="shrink-0 font-semibold text-success">{formatarBRL(i.profit_cents)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#F0F4F4]">
              <span className="block h-full rounded-full bg-teal" style={{ width: `${(i.profit_cents / max) * 100}%` }} />
            </span>
            <span className="w-16 shrink-0 text-right text-[12px] text-muted">{i.units} {i.units === 1 ? "peça" : "peças"}</span>
          </div>
        </div>
      ))}
    </section>
  );
}

function TabelaPedidos({ dados }: { dados: FinanceMonth }) {
  return (
    <section className="overflow-x-auto rounded-[20px] border border-line bg-white">
      <div className="min-w-[860px]">
        <div className="grid grid-cols-[80px_minmax(160px,1fr)_70px_100px_100px_90px_90px_110px] gap-3 border-b border-line px-5 py-3 text-[11.5px] font-bold tracking-[0.06em] text-muted uppercase">
          <span>Pedido</span>
          <span>Cliente</span>
          <span>Pago</span>
          <span>Peças</span>
          <span>Atacado</span>
          <span>Taxa</span>
          <span>Frete</span>
          <span>Lucro</span>
        </div>
        {dados.orders.map((o) => (
          <div key={o.id} className="grid grid-cols-[80px_minmax(160px,1fr)_70px_100px_100px_90px_90px_110px] items-center gap-3 border-b border-[#EEF3F2] px-5 py-3 text-[13.5px] last:border-b-0">
            <span className="font-semibold text-teal">#{o.number}</span>
            <span className="truncate">{o.customer_name}</span>
            <span className="text-text-2">{dataCurta(o.paid_at)}</span>
            <span>{formatarBRL(o.subtotal_cents)}</span>
            <span className="text-[#B4443C]">− {formatarBRL(o.cost_cents)}</span>
            <span className="text-[#B4443C]">− {formatarBRL(o.fee_cents)}</span>
            <span className="text-muted">
              {o.shipping_cents === 0 ? "grátis" : formatarBRL(o.shipping_cents)}
              {o.shipping_method && ` · ${SHIP_LABEL[o.shipping_method]}`}
            </span>
            <span className="font-semibold text-success">{formatarBRL(o.subtotal_cents - o.cost_cents - o.fee_cents)}</span>
          </div>
        ))}
      </div>
      <p className="m-0 border-t border-line px-5 py-3 text-[12px] text-muted">
        Lucro por pedido = peças − atacado − taxa. Embalagem e frete dos lotes entram só no total do mês.
      </p>
    </section>
  );
}

function exportar(d: FinanceMonth) {
  baixarCSV(`financeiro-${d.month}.csv`, [
    ["Pedido", "Cliente", "Pago em", "Peças", "Frete", "Total", "Atacado", "Taxa MP"],
    ...d.orders.map((o) => [
      `#${o.number}`,
      o.customer_name,
      new Date(o.paid_at).toLocaleDateString("pt-BR"),
      reaisCSV(o.subtotal_cents),
      reaisCSV(o.shipping_cents),
      reaisCSV(o.total_cents),
      reaisCSV(o.cost_cents),
      reaisCSV(o.fee_cents),
    ]),
    [],
    ["Faturamento", reaisCSV(d.revenue_cents)],
    ["Custo Lilly", reaisCSV(d.cost_cents)],
    ["Taxas Mercado Pago", reaisCSV(d.fees_cents)],
    ["Embalagem", reaisCSV(d.packaging_cents)],
    ["Frete dos lotes", reaisCSV(d.batch_freight_cents)],
    ["Lucro líquido", reaisCSV(d.net_profit_cents)],
  ]);
}
