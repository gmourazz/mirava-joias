// Visão geral do painel (v5): "Precisa da sua atenção" com os pendentes do
// dia por prioridade, indicadores do mês, gráfico de vendas, estado da
// sincronização e pedidos recentes. Tudo vem do banco (GET /admin/resumo).

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, Bell, Check, Clock, CreditCard, RefreshCw, ShoppingCart, Sparkles, Truck, type LucideIcon,
} from "lucide-react";
import { formatarBRL } from "../lib/dinheiro";
import { adminApi, STAGE_PILL, dataCurta, type AdminOrder, type Summary } from "./api";

type Prioridade = "urgente" | "hoje" | "semana" | "quando";

const PRIORIDADE: Record<Prioridade, { label: string; bg: string; fg: string; ordem: number }> = {
  urgente: { label: "URGENTE", bg: "#FDECEC", fg: "#C4483D", ordem: 0 },
  hoje: { label: "HOJE", bg: "#FFF4E0", fg: "#9A6B12", ordem: 1 },
  semana: { label: "ESTA SEMANA", bg: "#EAF5F4", fg: "#0F6E73", ordem: 2 },
  quando: { label: "QUANDO PUDER", bg: "#F2F5F5", fg: "#6C7E7F", ordem: 3 },
};

interface Pendencia {
  Icon: LucideIcon;
  label: string;
  sub: string;
  n: number;
  prioridade: Prioridade;
  cta: string;
  to?: string;
}

export default function VisaoGeral() {
  const [resumo, setResumo] = useState<Summary | null>(null);
  const [pedidos, setPedidos] = useState<AdminOrder[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<7 | 14>(14);

  useEffect(() => {
    adminApi.summary().then(setResumo).catch((e: Error) => setErro(e.message));
    adminApi.orders().then(setPedidos).catch(() => {});
  }, []);

  if (erro) return <p className="m-0 rounded-[20px] bg-[#FDECEC] p-5 text-[#B4443C]">{erro}</p>;
  if (!resumo) return <p className="m-0 text-muted">Carregando…</p>;

  const st = resumo.by_status;
  const pendencias: Pendencia[] = [
    { Icon: Clock, label: "Atrasados", sub: "Passaram dos 20 dias úteis", n: resumo.late, prioridade: "urgente", cta: "Ver pedidos", to: "/admin/pedidos?prazo=atrasados" },
    { Icon: Clock, label: "Perto do prazo", sub: "Até 4 dias úteis para os 20 dias", n: resumo.near_deadline, prioridade: "urgente", cta: "Priorizar", to: "/admin/pedidos?prazo=perto" },
    { Icon: ShoppingCart, label: "Comprar na Lilly", sub: "Pedidos pagos aguardando sua compra", n: (st.paid ?? 0) + (st.in_batch ?? 0), prioridade: "hoje", cta: "Ver pedidos", to: "/admin/pedidos?etapa=comprar" },
    { Icon: Truck, label: "Prontos para despachar", sub: "Peças em mãos, falta o rastreio", n: st.received_by_owner ?? 0, prioridade: "hoje", cta: "Despachar", to: "/admin/pedidos?etapa=despachar" },
    { Icon: AlertTriangle, label: "Sem estoque na Lilly", sub: "Fale com a cliente: troca ou estorno", n: st.out_of_stock ?? 0, prioridade: "hoje", cta: "Resolver", to: "/admin/pedidos?etapa=problema" },
    { Icon: CreditCard, label: "Aguardando pagamento", sub: "Pedidos criados, pagamento não confirmado", n: st.awaiting_payment ?? 0, prioridade: "semana", cta: "Ver pedidos", to: "/admin/pedidos?etapa=aguardando" },
    { Icon: RefreshCw, label: "Alertas de preço da Lilly", sub: "Variação acima de 30% travada pelo disjuntor", n: resumo.price_alerts, prioridade: "semana", cta: "Revisar", to: "/admin/produtos?status=alerta" },
    { Icon: Sparkles, label: "Peças despublicadas", sub: "Encontradas na Lilly, aguardando revisão", n: resumo.unpublished, prioridade: "quando", cta: "Ver peças", to: "/admin/produtos?status=despublicados" },
  ];
  const ativas = pendencias.filter((p) => p.n > 0).sort((a, b) => PRIORIDADE[a.prioridade].ordem - PRIORIDADE[b.prioridade].ordem);
  const emDia = pendencias.filter((p) => p.n === 0);
  const totalPendente = ativas.reduce((s, p) => s + p.n, 0);

  const vendas = resumo.sales.slice(-periodo);
  const maxVenda = Math.max(1, ...vendas.map((v) => v.total_cents));
  const totalPeriodo = vendas.reduce((s, v) => s + v.total_cents, 0);
  const ticket = resumo.month_orders > 0 ? Math.round(resumo.month_revenue_cents / resumo.month_orders) : 0;
  const margem = resumo.month_revenue_cents > 0 ? Math.round((resumo.month_profit_cents / resumo.month_revenue_cents) * 100) : 0;

  return (
    <>
      <section className="rounded-[20px] border border-line bg-white p-[22px]">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#FDECEC] text-[#D4574B]">
            <Bell size={20} strokeWidth={1.8} />
          </span>
          <div className="grid">
            <strong className="text-[17px] text-text">Precisa da sua atenção</strong>
            <span className="text-[13px] text-muted">
              Hoje, {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · {totalPendente} {totalPendente === 1 ? "item pendente" : "itens pendentes"}
            </span>
          </div>
        </div>

        {ativas.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-3">
            {ativas.map((p) => {
              const pr = PRIORIDADE[p.prioridade];
              return (
                <div key={p.label} className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-line p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: pr.bg, color: pr.fg }}>
                    <p.Icon size={19} strokeWidth={1.8} />
                  </span>
                  <span className="grid min-w-[170px] flex-1 gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="text-[14.5px] text-text">{p.label}</strong>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.06em]" style={{ background: pr.bg, color: pr.fg }}>
                        {pr.label}
                      </span>
                    </span>
                    <span className="text-[12.5px] text-muted">{p.sub}</span>
                  </span>
                  <span className="font-serif text-[24px] text-teal-dark">{p.n}</span>
                  {p.to ? (
                    <Link to={p.to} className="shrink-0 rounded-full border-[1.5px] border-line-strong px-3.5 py-1.5 text-[12.5px] font-semibold text-teal hover:border-teal">
                      {p.cta}
                    </Link>
                  ) : (
                    <span className="shrink-0 rounded-full bg-chip px-3.5 py-1.5 text-[12.5px] font-semibold text-muted">{p.cta}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {emDia.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
            <span>Em dia:</span>
            {emDia.map((p) => (
              <span key={p.label} className="flex items-center gap-1 rounded-full bg-[#E3F6F1] px-2.5 py-1 text-success">
                <Check size={12} strokeWidth={2.4} />
                {p.label}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3">
        <Kpi label="Faturamento do mês" valor={formatarBRL(resumo.month_revenue_cents)} />
        <Kpi label="Pedidos pagos no mês" valor={String(resumo.month_orders)} />
        <Kpi label="Lucro estimado do mês" valor={formatarBRL(resumo.month_profit_cents)} nota="venda − atacado; sem frete e taxas" />
        <Kpi label="Ticket médio" valor={formatarBRL(ticket)} nota={resumo.month_orders > 0 ? `margem média ${margem}%` : undefined} />
      </section>

      <section className="grid grid-cols-1 gap-[18px] xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-[20px] border border-line bg-white p-[22px]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="grid">
              <strong className="text-[16px] text-text">Vendas</strong>
              <span className="text-[13px] text-muted">{formatarBRL(totalPeriodo)} no período</span>
            </div>
            <div className="flex gap-1 rounded-full bg-fog p-1">
              {([7, 14] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodo(p)}
                  className={`cursor-pointer rounded-full border-none px-3.5 py-1.5 text-[12.5px] font-semibold ${
                    periodo === p ? "bg-white text-teal shadow-[0_2px_8px_rgba(11,74,77,0.08)]" : "bg-transparent text-muted"
                  }`}
                >
                  {p} dias
                </button>
              ))}
            </div>
          </div>
          <div className="flex h-[200px] items-end gap-2">
            {vendas.map((v, i) => {
              const ultimo = i === vendas.length - 1;
              const dia = new Date(v.day.slice(0, 10) + "T12:00:00");
              return (
                <div key={v.day} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className="pointer-events-none absolute -top-1 rounded-md bg-teal-dark px-2 py-1 text-[11px] whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {formatarBRL(v.total_cents)}
                  </span>
                  <span
                    className={`w-full max-w-[34px] rounded-[8px_8px_4px_4px] transition-[height] duration-600 ${ultimo ? "bg-teal-dark" : "bg-teal"}`}
                    style={{ height: `${Math.max(2, (v.total_cents / maxVenda) * 170)}px`, opacity: v.total_cents ? 1 : 0.25 }}
                  />
                  <span className="text-[10.5px] text-muted">{ultimo ? "Hoje" : dia.toLocaleDateString("pt-BR", { day: "2-digit" })}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid content-start gap-3 rounded-[20px] bg-teal p-[22px] text-white">
          <div className="flex items-center justify-between">
            <strong className="text-[16px]">Sincronização Use Lilly</strong>
            <span className="rounded-full bg-white/15 px-2.5 py-1 font-logo text-[11px] tracking-[0.18em]">LILLY</span>
          </div>
          <span className="text-[13px] text-[#BFE3DF]">
            Última leitura: {resumo.last_sync_at ? new Date(resumo.last_sync_at).toLocaleString("pt-BR") : "nunca"}
            {resumo.last_sync_status && ` · ${resumo.last_sync_status}`}
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            <MiniStat label="Peças publicadas" valor={resumo.published} />
            <MiniStat label="Despublicadas" valor={resumo.unpublished} />
            <MiniStat label="Alertas de preço" valor={resumo.price_alerts} />
            <MiniStat label="Sem estoque (pedidos)" valor={st.out_of_stock ?? 0} />
          </div>
          <Link to="/admin/sincronizacao" className="text-[12.5px] font-semibold text-white underline hover:text-white">Ver histórico da sincronização →</Link>
        </div>
      </section>

      <section className="rounded-[20px] border border-line bg-white p-[22px]">
        <div className="mb-3 flex items-center justify-between">
          <strong className="text-[16px] text-text">Pedidos recentes</strong>
          <Link to="/admin/pedidos" className="text-[13px] font-semibold text-teal">Ver todos →</Link>
        </div>
        {pedidos.length === 0 ? (
          <p className="m-0 py-6 text-center text-muted">Nenhum pedido ainda.</p>
        ) : (
          <div className="grid">
            {pedidos.slice(0, 5).map((o) => {
              const pill = STAGE_PILL[o.stage];
              return (
                <Link key={o.id} to={`/admin/pedidos?abrir=${o.id}`} className="grid grid-cols-[70px_1fr_auto_auto] items-center gap-3 border-t border-[#EEF3F2] py-3 text-text first:border-t-0 hover:bg-[#F7FAFA] hover:text-text">
                  <span className="font-semibold text-teal">#{o.number}</span>
                  <span className="grid min-w-0">
                    <span className="truncate font-medium">{o.customer_name}</span>
                    <span className="text-[12px] text-muted">{dataCurta(o.paid_at ?? o.created_at)}</span>
                  </span>
                  <span className="font-semibold">{formatarBRL(o.total_cents)}</span>
                  <span className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap" style={{ background: pill.bg, color: pill.fg }}>
                    {pill.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function Kpi({ label, valor, nota }: { label: string; valor: string; nota?: string }) {
  return (
    <div className="grid gap-1.5 rounded-[20px] border border-line bg-white p-[18px]">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="font-serif text-[clamp(22px,2.2vw,28px)] leading-none text-teal-dark">{valor}</span>
      {nota && <span className="text-[12px] text-muted">{nota}</span>}
    </div>
  );
}

function MiniStat({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="grid gap-0.5 rounded-2xl bg-white/10 p-3">
      <span className="font-serif text-[22px] leading-none">{valor}</span>
      <span className="text-[11.5px] text-[#BFE3DF]">{label}</span>
    </div>
  );
}
