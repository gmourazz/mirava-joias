// Pedidos do painel (v5): cartões do fluxo sob encomenda, faixa explicando o
// caminho, filtros, tabela com a barra do prazo de 20 dias úteis e o botão do
// próximo passo. Etapa e prazo vêm prontos da API; filtro é feito aqui.
//
// Filtros vão na URL (?etapa=, ?envio=, ?prazo=, ?abrir=) para os atalhos da
// visão geral caírem direto na lista certa.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, Clock, Download, ShoppingCart, type LucideIcon, PackageCheck, Truck, Store } from "lucide-react";
import { formatarBRL } from "../lib/dinheiro";
import { adminApi, STAGE_PILL, SHIP_LABEL, dataCurta, type AdminOrder, type AdminStage } from "./api";
import PedidoDrawer from "./PedidoDrawer";
import ListaCompras from "./ListaCompras";
import AgendaDespachos from "./AgendaDespachos";
import Select from "../components/Select";
import { baixarCSV } from "./csv";

const FLUXO: { stage: AdminStage; label: string; dica: string; Icon: LucideIcon }[] = [
  { stage: "comprar", label: "Comprar na Lilly", dica: "Pagos: faça a compra no site da Lilly", Icon: ShoppingCart },
  { stage: "na_lilly", label: "Na Lilly", dica: "Aguardando chegar até você", Icon: Store },
  { stage: "despachar", label: "Para despachar", dica: "Peças em mãos, falta o rastreio", Icon: PackageCheck },
  { stage: "despachado", label: "Despachados", dica: "A caminho da cliente", Icon: Truck },
];

const CHIPS: { key: AdminStage | "todos"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "aguardando", label: "Aguardando pgto" },
  { key: "comprar", label: "Comprar" },
  { key: "na_lilly", label: "Na Lilly" },
  { key: "despachar", label: "Para despachar" },
  { key: "despachado", label: "Despachados" },
  { key: "entregue", label: "Entregues" },
  { key: "problema", label: "Sem estoque" },
  { key: "encerrado", label: "Encerrados" },
];

export default function Pedidos() {
  const [pedidos, setPedidos] = useState<AdminOrder[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const [listaAberta, setListaAberta] = useState(false);
  const [agenda, setAgenda] = useState(false);

  const etapa = (params.get("etapa") ?? "todos") as AdminStage | "todos";
  const envio = params.get("envio") ?? "";
  const prazo = params.get("prazo") ?? "";
  const abrir = params.get("abrir");
  const busca = (params.get("busca") ?? "").trim().toLowerCase().replace(/^#/, "");

  const carregar = useCallback(() => {
    adminApi.orders().then(setPedidos).catch((e: Error) => setErro(e.message));
  }, []);
  useEffect(carregar, [carregar]);

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  if (erro) return <p className="m-0 rounded-[20px] bg-[#FDECEC] p-5 text-[#B4443C]">{erro}</p>;
  if (!pedidos) return <p className="m-0 text-muted">Carregando…</p>;

  const conta = (s: AdminStage) => pedidos.filter((o) => o.stage === s).length;
  const pertoDoPrazo = pedidos.filter((o) => o.deadline && (o.deadline.near || o.deadline.late)).length;
  const pecasParaComprar = pedidos.filter((o) => o.stage === "comprar").reduce((s, o) => s + o.items_count, 0);

  const lista = pedidos.filter(
    (o) =>
      (etapa === "todos" || o.stage === etapa) &&
      (!envio || o.shipping_method === envio) &&
      (!prazo || (prazo === "perto" && o.deadline?.near) || (prazo === "atrasados" && o.deadline?.late)) &&
      (!busca ||
        String(o.number) === busca ||
        o.customer_name.toLowerCase().includes(busca) ||
        o.customer_email.toLowerCase().includes(busca) ||
        (o.tracking_code ?? "").toLowerCase().includes(busca)),
  );

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        {FLUXO.map(({ stage, label, dica, Icon }) => {
          const ativo = etapa === stage;
          return (
            <button
              key={stage}
              type="button"
              onClick={() => setParam("etapa", ativo ? "" : stage)}
              className={`grid cursor-pointer gap-2 rounded-[20px] border-[1.5px] bg-white p-4 text-left transition-colors ${ativo ? "border-teal" : "border-line hover:border-line-strong"}`}
            >
              <span className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-mist text-teal">
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <span className="font-serif text-[26px] leading-none text-teal-dark">{conta(stage)}</span>
              </span>
              <strong className="text-[14.5px] text-text">{label}</strong>
              <span className="text-[12.5px] text-muted">{dica}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setParam("prazo", prazo === "perto" ? "" : "perto")}
          className={`grid cursor-pointer gap-2 rounded-[20px] border-[1.5px] p-4 text-left ${prazo === "perto" ? "border-[#C4483D] bg-[#FDECEC]" : "border-line bg-white"}`}
        >
          <span className="flex items-center justify-between">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#FDECEC] text-[#C4483D]">
              <Clock size={18} strokeWidth={1.8} />
            </span>
            <span className="font-serif text-[26px] leading-none text-[#C4483D]">{pertoDoPrazo}</span>
          </span>
          <strong className="text-[14.5px] text-text">Perto do prazo</strong>
          <span className="text-[12.5px] text-muted">Até 4 dias úteis para vencer, ou atrasados</span>
        </button>
      </section>

      <div className="flex items-start gap-3 rounded-2xl bg-mist px-5 py-4 text-[13.5px] leading-relaxed text-text-2">
        <Clock size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-teal" />
        <span>
          Fluxo sob encomenda: a cliente paga → o pedido entra no lote → <strong className="text-text">você compra na Lilly</strong> (lista de compras) →
          recebe as peças → despacha com o código. Prazo de <strong className="text-text">até 20 dias úteis</strong> desde o pagamento.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setListaAberta(true)}
          className="flex cursor-pointer items-center gap-2 rounded-full border-none bg-teal px-5 py-3 text-[13.5px] font-semibold text-white hover:bg-teal-dark"
        >
          <ShoppingCart size={16} strokeWidth={1.8} />
          Lista de compras Lilly · {pecasParaComprar} {pecasParaComprar === 1 ? "peça" : "peças"}
        </button>
        <button
          type="button"
          onClick={() => setAgenda((v) => !v)}
          className={`flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-5 py-2.5 text-[13.5px] font-semibold ${
            agenda ? "border-teal bg-teal text-white" : "border-line-strong bg-white text-teal hover:border-teal"
          }`}
        >
          <CalendarDays size={16} strokeWidth={1.8} />
          Agenda de despachos
        </button>
        <button
          type="button"
          onClick={() => exportarCSV(lista)}
          className="flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-line-strong bg-white px-5 py-2.5 text-[13.5px] font-semibold text-teal hover:border-teal"
        >
          <Download size={16} strokeWidth={1.8} />
          Exportar planilha
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Select
            value={envio}
            active={Boolean(envio)}
            onChange={(v) => setParam("envio", v)}
            options={[{ value: "", label: "Envio: todos" }, { value: "economico", label: "PAC" }, { value: "sedex", label: "SEDEX" }]}
          />
          <Select
            value={prazo}
            active={Boolean(prazo)}
            onChange={(v) => setParam("prazo", v)}
            options={[{ value: "", label: "Prazo: todos" }, { value: "perto", label: "Perto do prazo" }, { value: "atrasados", label: "Atrasados" }]}
          />
        </div>
      </div>

      {agenda && <AgendaDespachos pedidos={pedidos} abrir={(id) => setParam("abrir", id)} />}

      {busca && (
        <div className="flex items-center gap-2 text-[13.5px] text-text-2">
          Buscando por <strong>“{params.get("busca")}”</strong>
          <button type="button" onClick={() => setParam("busca", "")} className="cursor-pointer border-none bg-transparent p-0 font-semibold text-teal">
            limpar
          </button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {CHIPS.map((c) => {
          const n = c.key === "todos" ? pedidos.length : conta(c.key);
          const ativo = etapa === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setParam("etapa", c.key === "todos" ? "" : c.key)}
              className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-full border-none px-4 py-2 text-[13px] font-semibold ${ativo ? "bg-teal text-white" : "bg-white text-text hover:bg-mist"}`}
            >
              {c.label}
              <span className={`rounded-full px-1.5 text-[11px] ${ativo ? "bg-white/20" : "bg-chip text-muted"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      <section className="overflow-x-auto rounded-[20px] border border-line bg-white">
        <div className="min-w-[1000px]">
          <div className="grid grid-cols-[80px_minmax(150px,1.3fr)_64px_92px_90px_64px_150px_150px_140px] gap-3 border-b border-line px-5 py-3 text-[11.5px] font-bold tracking-[0.06em] text-muted uppercase">
            <span>Pedido</span>
            <span>Cliente</span>
            <span>Pago em</span>
            <span>Total</span>
            <span>Seu lucro</span>
            <span>Envio</span>
            <span>Prazo (20 dias úteis)</span>
            <span>Status</span>
            <span>Próximo passo</span>
          </div>
          {lista.length === 0 ? (
            <p className="m-0 px-5 py-12 text-center text-muted">Nenhum pedido com esses filtros.</p>
          ) : (
            lista.map((o) => (
              <Linha key={o.id} o={o} abrir={() => setParam("abrir", o.id)} abrirLista={() => setListaAberta(true)} />
            ))
          )}
        </div>
      </section>

      {abrir && (
        <PedidoDrawer
          id={abrir}
          fechar={() => setParam("abrir", "")}
          mudou={carregar}
        />
      )}
      {listaAberta && (
        <ListaCompras
          fechar={() => setListaAberta(false)}
          mudou={carregar}
        />
      )}
    </>
  );
}

function Linha({ o, abrir, abrirLista }: { o: AdminOrder; abrir: () => void; abrirLista: () => void }) {
  const pill = STAGE_PILL[o.stage];
  const lucro = o.subtotal_cents - o.cost_cents;
  const d = o.deadline;
  const perto = d && (d.near || d.late);
  const passo = proximoPasso(o.stage);

  return (
    <div
      className={`grid cursor-pointer grid-cols-[80px_minmax(150px,1.3fr)_64px_92px_90px_64px_150px_150px_140px] items-center gap-3 border-b border-[#EEF3F2] px-5 py-3.5 last:border-b-0 hover:bg-[#F7FAFA] ${
        d && d.left <= 2 ? "bg-[#FFFAF2]" : ""
      }`}
      onClick={abrir}
    >
      <span className="font-semibold text-teal">#{o.number}</span>
      <span className="grid min-w-0">
        <span className="truncate font-medium text-text">{o.customer_name}</span>
        <span className="text-[12px] text-muted">
          {o.items_count} {o.items_count === 1 ? "peça" : "peças"}
          {o.batch_number && ` · lote #${o.batch_number}`}
        </span>
      </span>
      <span className="text-text-2">{dataCurta(o.paid_at)}</span>
      <span className="font-semibold">{formatarBRL(o.total_cents)}</span>
      <span className="font-semibold text-success">{formatarBRL(lucro)}</span>
      <span>
        {o.shipping_method && (
          <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${o.shipping_method === "sedex" ? "bg-teal-dark text-white" : "bg-mist text-teal"}`}>
            {SHIP_LABEL[o.shipping_method]}
          </span>
        )}
      </span>
      <span className="grid gap-1.5">
        {d ? (
          <>
            <span className={`text-[12.5px] font-semibold ${d.late ? "text-[#C4483D]" : perto ? "text-[#B07A12]" : "text-teal"}`}>
              {d.late
                ? `Atrasado ${-d.left} ${-d.left === 1 ? "dia útil" : "dias úteis"}`
                : d.left === 0
                  ? `Vence hoje · ${dataCurta(d.due)}`
                  : `${d.left} dias úteis · até ${dataCurta(d.due)}`}
            </span>
            <span className="h-1 w-[110px] overflow-hidden rounded-full bg-[#F0F4F4]">
              <span
                className={`block h-full ${d.late ? "bg-[#C4483D]" : perto ? "bg-[#B07A12]" : "bg-teal"}`}
                style={{ width: `${Math.min(100, (d.used / 20) * 100)}%` }}
              />
            </span>
          </>
        ) : (
          <span className={`text-[12.5px] ${o.stage === "entregue" ? "font-semibold text-success" : "text-faint"}`}>
            {o.stage === "aguardando" ? "Inicia após pagamento" : o.stage === "entregue" ? "Entregue" : o.stage === "despachado" ? "Despachado" : "—"}
          </span>
        )}
      </span>
      <span>
        <span className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap" style={{ background: pill.bg, color: pill.fg }}>
          {pill.label}
        </span>
      </span>
      <span onClick={(e) => e.stopPropagation()}>
        {passo && (
          <button
            type="button"
            onClick={passo.lista ? abrirLista : abrir}
            className={`cursor-pointer rounded-full px-3.5 py-2 text-[12.5px] font-semibold whitespace-nowrap ${
              passo.primario ? "border-none bg-teal text-white hover:bg-teal-dark" : "border-[1.5px] border-line-strong bg-white text-teal hover:border-teal"
            }`}
          >
            {passo.label}
          </button>
        )}
      </span>
    </div>
  );
}

function proximoPasso(stage: AdminStage): { label: string; primario: boolean; lista?: boolean } | null {
  switch (stage) {
    case "comprar":
      return { label: "Lista de compras", primario: true, lista: true };
    case "na_lilly":
      return { label: "Recebi da Lilly", primario: false };
    case "despachar":
      return { label: "Despachar", primario: true };
    case "despachado":
      return { label: "Marcar entregue", primario: false };
    case "problema":
      return { label: "Resolver", primario: true };
    default:
      return { label: "Ver detalhes", primario: false };
  }
}

function exportarCSV(lista: AdminOrder[]) {
  const linhas = [
    ["Pedido", "Cliente", "E-mail", "Pago em", "Total", "Atacado", "Lucro", "Envio", "Prazo", "Status", "Rastreio"],
    ...lista.map((o) => [
      `#${o.number}`,
      o.customer_name,
      o.customer_email,
      o.paid_at ? new Date(o.paid_at).toLocaleDateString("pt-BR") : "",
      (o.total_cents / 100).toFixed(2).replace(".", ","),
      (o.cost_cents / 100).toFixed(2).replace(".", ","),
      ((o.subtotal_cents - o.cost_cents) / 100).toFixed(2).replace(".", ","),
      o.shipping_method ? SHIP_LABEL[o.shipping_method] : "",
      o.deadline ? new Date(o.deadline.due).toLocaleDateString("pt-BR") : "",
      STAGE_PILL[o.stage].label,
      o.tracking_code ?? "",
    ]),
  ];
  baixarCSV("pedidos-mirava.csv", linhas);
}
