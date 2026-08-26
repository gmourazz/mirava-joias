import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Download } from "lucide-react";
import { ApiError } from "../../lib/api";
import { formatarBRL } from "../../lib/dinheiro";
import { formatDate } from "../../lib/pedidos";
import { listAllOrders, PRONTOS_PARA_DESPACHAR, STATUS_LABEL, type AdminOrder } from "../../lib/admin";
import StatusPill from "../../components/admin/StatusPill";
import FilterTile from "../../components/admin/FilterTile";

// Pedidos que já saíram do fluxo ativo — não faz sentido mostrar "há N dias
// esperando" pra um pedido entregue há um mês.
const RESOLVIDOS = ["shipped", "delivered", "cancelled", "refunded", "out_of_stock"];

/** "pronto" é um atalho pra um grupo de status (pago → no lote → comprado →
 *  recebido: tudo o que já foi pago e ainda não foi despachado). Os demais
 *  valores de filtro são status reais, os mesmos do select detalhado —
 *  clicar num card ou escolher no select cai no mesmo estado. */
const FILTRO_PRONTO = "pronto";

function corresponde(pedido: AdminOrder, filtro: string): boolean {
  if (!filtro) return true;
  if (filtro === FILTRO_PRONTO) return PRONTOS_PARA_DESPACHAR.includes(pedido.status);
  return pedido.status === filtro;
}

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function baixarCSV(pedidos: AdminOrder[]) {
  const linhas = [
    ["Pedido", "Cliente", "Status", "Total", "Criado em"],
    ...pedidos.map((p) => [
      `#${p.number}`,
      p.customer_name,
      STATUS_LABEL[p.status] ?? p.status,
      formatarBRL(p.total_cents),
      formatDate(p.created_at),
    ]),
  ];
  const csv = linhas.map((linha) => linha.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pedidos-mirava-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPedidos() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pedidos, setPedidos] = useState<AdminOrder[]>([]);
  const [filtro, setFiltro] = useState(() => (location.state as { quickFilter?: string } | null)?.quickFilter ?? "");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setCarregando(true);
    listAllOrders()
      .then(setPedidos)
      .catch((e) => setErro(e instanceof ApiError ? e.message : "Não consegui carregar os pedidos"))
      .finally(() => setCarregando(false));
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return pedidos
      .filter((p) => corresponde(p, filtro))
      .filter((p) => !q || p.customer_name.toLowerCase().includes(q) || String(p.number).includes(q));
  }, [pedidos, filtro, busca]);

  const contagem = (f: string) => pedidos.filter((p) => corresponde(p, f)).length;
  const somaDe = (f: string) =>
    pedidos.filter((p) => corresponde(p, f)).reduce((soma, p) => soma + p.total_cents, 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 font-serif text-[26px] font-normal text-wine">Pedidos</h1>
          {!carregando && contagem(FILTRO_PRONTO) > 0 && (
            <p className="m-0 mt-1 text-[12.5px] text-ink-soft">
              {contagem(FILTRO_PRONTO)} {contagem(FILTRO_PRONTO) === 1 ? "pedido pronto" : "pedidos prontos"} pra despachar.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => baixarCSV(filtrados)}
          disabled={filtrados.length === 0}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-mauve bg-white px-4 py-2 text-[12px] text-ink transition-colors hover:border-wine hover:text-wine disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
          Exportar CSV
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <FilterTile
          label="Pagos · a despachar"
          n={contagem(FILTRO_PRONTO)}
          sublabel={formatarBRL(somaDe(FILTRO_PRONTO))}
          active={filtro === FILTRO_PRONTO}
          onClick={() => setFiltro(FILTRO_PRONTO)}
        />
        <FilterTile
          label="Aguardando pagamento"
          n={contagem("awaiting_payment")}
          sublabel={formatarBRL(somaDe("awaiting_payment"))}
          active={filtro === "awaiting_payment"}
          onClick={() => setFiltro("awaiting_payment")}
        />
        <FilterTile
          label="Enviados"
          n={contagem("shipped")}
          sublabel={formatarBRL(somaDe("shipped"))}
          active={filtro === "shipped"}
          onClick={() => setFiltro("shipped")}
        />
        <FilterTile
          label="Todos do período"
          n={pedidos.length}
          sublabel={formatarBRL(somaDe(""))}
          active={filtro === ""}
          onClick={() => setFiltro("")}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente ou número do pedido…"
          className="min-w-0 flex-1 rounded-[10px] border border-mauve/50 bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-wine"
        />
        <select
          value={Object.prototype.hasOwnProperty.call(STATUS_LABEL, filtro) ? filtro : ""}
          onChange={(e) => setFiltro(e.target.value)}
          className="rounded-[10px] border border-mauve/50 bg-white px-3 py-2.5 text-[12.5px] outline-none focus:border-wine"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {erro && (
        <p className="m-0 mb-5 flex items-center gap-2 rounded-[10px] bg-blush px-4 py-3 text-[12.5px] text-wine-dark">
          <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          {erro}
        </p>
      )}

      {carregando ? (
        <p className="m-0 text-[13px] text-mauve">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p className="m-0 text-[13px] text-mauve">Nenhum pedido encontrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-blush bg-white shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-blush bg-cream/40 text-left text-[10.5px] tracking-[0.08em] text-ink-soft uppercase">
                <th className="px-4 py-2.5 font-medium">Pedido</th>
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Esperando há</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 font-medium">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => {
                const dias = diasDesde(p.created_at);
                const emAndamento = !RESOLVIDOS.includes(p.status);
                return (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/admin/pedidos/${p.id}`)}
                    className="cursor-pointer border-b border-blush last:border-0 hover:bg-cream/30"
                  >
                    <td className="px-4 py-2.5 font-medium text-wine-dark">#{p.number}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{p.customer_name}</td>
                    <td className="px-4 py-2.5"><StatusPill status={p.status} /></td>
                    <td className="px-4 py-2.5">
                      {emAndamento && (
                        <span className={`text-[11.5px] ${dias >= 5 ? "font-medium text-danger" : dias >= 3 ? "text-warning" : "text-mauve"}`}>
                          {dias === 0 ? "hoje" : `${dias} ${dias === 1 ? "dia" : "dias"}`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink">{formatarBRL(p.total_cents)}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{formatDate(p.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
