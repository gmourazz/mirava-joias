import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, CalendarDays, ChevronDown, ChevronRight, Copy, EyeOff,
  Loader2, Package, PackageSearch, Receipt, RefreshCw, ShieldAlert,
  ShoppingBag, Sparkles, Wallet, type LucideIcon,
} from "lucide-react";
import { ApiError } from "../../lib/api";
import { formatarBRL } from "../../lib/dinheiro";
import { formatDate } from "../../lib/pedidos";
import {
  getDashboard, getShoppingList, listAdminProducts, triggerSync,
  PRONTOS_PARA_DESPACHAR, STATUS_LABEL, SYNC_STATUS_LABEL,
  type AdminProduct, type DashboardStats, type ShoppingItem,
} from "../../lib/admin";
import RevenueChart from "../../components/admin/RevenueChart";
import BarList, { type BarListItem } from "../../components/admin/BarList";
import MetricCard from "../../components/admin/MetricCard";

function topProductItems(products: DashboardStats["top_products"]): BarListItem[] {
  return products.map((p) => ({
    label: p.name,
    value: p.revenue_cents,
    formattedValue: formatarBRL(p.revenue_cents),
  }));
}

function statusItems(counts: DashboardStats["status_counts"]): BarListItem[] {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([status, n]) => ({
      label: STATUS_LABEL[status] ?? status,
      value: n,
      formattedValue: String(n),
    }));
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [produtos, setProdutos] = useState<AdminProduct[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setErro(null);
    try {
      setStats(await getDashboard());
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui carregar o painel");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
    // Catálogo completo só pra "Saúde do catálogo" — vem à parte porque
    // /admin/dashboard não devolve contagem de produto nenhuma; se falhar,
    // a seção some, o resto do painel continua de pé.
    listAdminProducts().then(setProdutos).catch(() => setProdutos(null));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-script text-[20px] text-wine">Bem-vinda de volta</span>
          <h1 className="m-0 mt-0.5 font-serif text-[28px] font-normal text-wine-dark">Visão geral</h1>
        </div>
        <button
          type="button"
          onClick={() => void carregar()}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-mauve bg-white px-4 py-2 text-[11.5px] text-ink transition-colors hover:border-wine hover:text-wine"
        >
          <RefreshCw className="h-3 w-3" strokeWidth={1.8} />
          Atualizar
        </button>
      </div>

      {erro && (
        <p className="m-0 mb-6 flex items-center gap-2 rounded-[10px] bg-blush px-4 py-3 text-[12.5px] text-wine-dark">
          <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          {erro}
        </p>
      )}

      {carregando ? (
        <p className="m-0 text-[13px] text-mauve">Carregando…</p>
      ) : stats ? (
        <>
          <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <MetricCard icon={CalendarDays} titulo="Receita do mês" valor={formatarBRL(stats.revenue_month_cents)} />
            <MetricCard icon={Sparkles} titulo="Lucro estimado do mês" valor={formatarBRL(stats.profit_month_cents)} destaque />
            <MetricCard icon={Receipt} titulo="Ticket médio" valor={formatarBRL(stats.average_ticket_cents)} />
          </section>

          <section className="mt-3.5 flex flex-wrap items-stretch rounded-[16px] border border-blush bg-white">
            <FaixaDia icon={Wallet} titulo="Receita hoje" valor={formatarBRL(stats.revenue_today_cents)} />
            <FaixaDia icon={ShoppingBag} titulo="Pedidos hoje" valor={String(stats.orders_today)} />
            <FaixaDia icon={ShoppingBag} titulo="Pedidos do mês" valor={String(stats.orders_month)} />
            <p className="m-0 flex flex-1 items-center px-5 py-3.5 text-[11px] leading-relaxed text-mauve">
              Lucro estimado = receita − custo das peças − taxa do Mercado Pago − embalagem.
              Não inclui o frete pago aos Correios (esse custo só existe somado por lote, não por pedido).
            </p>
          </section>

          <TarefasCard stats={stats} onIrParaLote={() => document.getElementById("lote")?.scrollIntoView({ behavior: "smooth" })} />
          <SaudeCatalogoCard produtos={produtos} />

          <section className="mt-9 rounded-[18px] border border-blush bg-white p-6 shadow-[0_8px_26px_-14px_rgba(92,42,70,0.22)]">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="m-0 font-serif text-[17px] font-normal text-ink">Receita — últimos 14 dias</h2>
              <span className="text-[11px] text-mauve">passe o mouse pra ver o dia</span>
            </div>
            <RevenueChart data={stats.daily_revenue} />
          </section>

          <section className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="rounded-[16px] border border-blush bg-white p-5 shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
              <h2 className="m-0 mb-4 font-serif text-[15px]">Mais vendidos do mês</h2>
              <BarList items={topProductItems(stats.top_products)} />
            </div>
            <div className="rounded-[16px] border border-blush bg-white p-5 shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
              <h2 className="m-0 mb-4 font-serif text-[15px]">Pedidos por status</h2>
              <BarList items={statusItems(stats.status_counts)} />
            </div>
          </section>

          <section className="mt-6 grid gap-5 sm:grid-cols-2">
            <LoteCard batch={stats.open_batch} />
            <SincronizacaoCard sync={stats.last_sync} onSincronizado={carregar} />
          </section>
        </>
      ) : null}
    </div>
  );
}

/** Uma fatia da faixa "hoje" — divisória vertical entre as fatias, exceto
 *  a última (a nota fica ali do lado, sem divisória dupla). */
function FaixaDia({ icon: Icon, titulo, valor }: { icon: LucideIcon; titulo: string; valor: string }) {
  return (
    <div className="flex items-center gap-3 border-r border-blush px-5 py-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blush text-wine-dark">
        <Icon className="h-[15px] w-[15px]" strokeWidth={1.8} />
      </span>
      <div>
        <p className="m-0 text-[10px] tracking-[0.08em] text-mauve uppercase">{titulo}</p>
        <p className="m-0 font-serif text-[17px] text-ink">{valor}</p>
      </div>
    </div>
  );
}

interface Tarefa {
  titulo: string;
  detalhe: string;
  acaoLabel: string;
  ir: () => void;
  icon: LucideIcon;
}

/** "Precisa de você hoje" — sempre derivado de campos que a API já manda
 *  (status_counts, open_batch, last_sync). Nada aqui é inventado: se um
 *  número zerar, a tarefa correspondente simplesmente não aparece. */
function TarefasCard({ stats, onIrParaLote }: { stats: DashboardStats; onIrParaLote: () => void }) {
  const navigate = useNavigate();

  const prontos = Object.entries(stats.status_counts)
    .filter(([status]) => PRONTOS_PARA_DESPACHAR.includes(status))
    .reduce((soma, [, n]) => soma + n, 0);
  const loteNoTeto = stats.open_batch != null && stats.open_batch.oldest_business_days >= 5;
  const travados = stats.last_sync?.locked_prices ?? 0;

  const tarefas: Tarefa[] = [];
  if (prontos > 0) {
    tarefas.push({
      titulo: `${prontos} ${prontos === 1 ? "pedido pago" : "pedidos pagos"} esperando despacho`,
      detalhe: "Confira o mais antigo primeiro",
      acaoLabel: "Ver pedidos",
      icon: ShoppingBag,
      ir: () => navigate("/admin/pedidos", { state: { quickFilter: "pronto" } }),
    });
  }
  if (loteNoTeto && stats.open_batch) {
    tarefas.push({
      titulo: `Lote #${stats.open_batch.number} no teto de prazo`,
      detalhe: `Pedido mais antigo com ${stats.open_batch.oldest_business_days} dias úteis`,
      acaoLabel: "Ver lote",
      icon: Package,
      ir: onIrParaLote,
    });
  }
  if (travados > 0) {
    tarefas.push({
      titulo: `${travados} ${travados === 1 ? "preço travado" : "preços travados"} pelo disjuntor`,
      detalhe: "Custo mudou mais que o esperado na última sincronização",
      acaoLabel: "Revisar preços",
      icon: ShieldAlert,
      ir: () => navigate("/admin/produtos", { state: { pendentes: true } }),
    });
  }

  if (tarefas.length === 0) return null;

  return (
    <section className="mt-6 rounded-[16px] border border-blush bg-white p-5 shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="m-0 font-serif text-[15px]">Precisa de você hoje</h2>
        <span className="rounded-full bg-blush px-2.5 py-1 text-[10.5px] font-semibold text-wine-dark">
          {tarefas.length} {tarefas.length === 1 ? "pendência" : "pendências"}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {tarefas.map((t) => (
          <button
            key={t.titulo}
            type="button"
            onClick={t.ir}
            className="flex w-full cursor-pointer items-center gap-3 rounded-[12px] border border-transparent bg-cream/40 p-3.5 text-left transition-colors hover:border-blush hover:bg-white"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blush text-wine-dark">
              <t.icon className="h-[15px] w-[15px]" strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <p className="m-0 truncate text-[13.5px] font-medium text-ink">{t.titulo}</p>
              <p className="m-0 text-[11.5px] text-mauve">{t.detalhe}</p>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-wine">
              {t.acaoLabel}
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Contagens reais tiradas do catálogo já carregado — nada de "sem foto"
 *  ou "sem giro há 30 dias" aqui: a API de produtos não guarda isso, e um
 *  número inventado num painel financeiro é pior que nenhum número. */
function SaudeCatalogoCard({ produtos }: { produtos: AdminProduct[] | null }) {
  if (!produtos) return null;

  const publicados = produtos.filter((p) => p.published).length;
  const ocultos = produtos.length - publicados;
  const travados = produtos.filter((p) => p.suggested_price_cents != null).length;

  return (
    <section className="mt-6 rounded-[16px] border border-blush bg-white p-5 shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
      <h2 className="m-0 mb-4 font-serif text-[15px]">Saúde do catálogo</h2>
      <div className="grid grid-cols-3 gap-3">
        <MiniStat icon={Package} label="Publicados" valor={publicados} />
        <MiniStat icon={EyeOff} label="Ocultos" valor={ocultos} />
        <MiniStat icon={PackageSearch} label="Travados p/ revisão" valor={travados} atencao={travados > 0} />
      </div>
    </section>
  );
}

function MiniStat({
  icon: Icon, label, valor, atencao = false,
}: {
  icon: LucideIcon; label: string; valor: number; atencao?: boolean;
}) {
  return (
    <div className={`rounded-[12px] border p-3.5 ${atencao ? "border-warning/40 bg-warning-soft" : "border-blush bg-cream/40"}`}>
      <Icon className={`h-4 w-4 ${atencao ? "text-warning" : "text-mauve"}`} strokeWidth={1.8} />
      <p className={`m-0 mt-2 font-serif text-[19px] ${atencao ? "text-warning" : "text-ink"}`}>{valor}</p>
      <p className="m-0 text-[10.5px] tracking-[0.04em] text-ink-soft uppercase">{label}</p>
    </div>
  );
}

function LoteCard({ batch }: { batch: DashboardStats["open_batch"] }) {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<ShoppingItem[] | null>(null);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function alternarLista() {
    if (!aberto && itens === null) {
      setCarregandoLista(true);
      try {
        const r = await getShoppingList();
        setItens(r.items);
      } catch {
        setItens([]);
      } finally {
        setCarregandoLista(false);
      }
    }
    setAberto((v) => !v);
  }

  async function copiarLista() {
    if (!itens || itens.length === 0) return;
    const texto = itens
      .map((it) => `${it.quantity}x ${it.sku ?? "(sem código)"} — ${it.name}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard bloqueado (permissão, http sem TLS): sem drama, a lista
      // continua visível na tela pra copiar na mão.
    }
  }

  if (!batch) {
    return (
      <div id="lote" className="rounded-[16px] border border-blush bg-white p-5 shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
        <h3 className="m-0 mb-1 font-serif text-[15px]">Lote</h3>
        <p className="m-0 text-[12.5px] text-ink-soft">Nenhum lote aberto no momento.</p>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((batch.cost_cents / batch.goal_cents) * 100));
  const perto = batch.oldest_business_days >= 5;

  return (
    <div id="lote" className="rounded-[16px] border border-blush bg-white p-5 shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="m-0 font-serif text-[15px]">Lote #{batch.number}</h3>
        <span className="text-[11.5px] text-mauve">{batch.order_count} pedidos</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-blush">
        <div className="h-full rounded-full bg-wine transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="m-0 mt-2 text-[12.5px] text-ink-soft">
        {formatarBRL(batch.cost_cents)} de {formatarBRL(batch.goal_cents)} para frete grátis ({pct}%)
      </p>
      <p className={`m-0 mt-1 text-[12.5px] ${perto ? "font-medium text-wine-dark" : "text-ink-soft"}`}>
        Pedido mais antigo: {batch.oldest_business_days} dias úteis
        {perto && " — no teto, deve fechar em breve"}
      </p>

      <button
        type="button"
        onClick={() => void alternarLista()}
        className="mt-3 flex cursor-pointer items-center gap-1.5 border-none bg-none p-0 text-[12px] font-medium text-wine hover:text-wine-dark"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${aberto ? "rotate-180" : ""}`} strokeWidth={2} />
        Lista de compra pra Lilly
      </button>

      {aberto && (
        <div className="mt-3 border-t border-blush pt-3">
          {carregandoLista ? (
            <p className="m-0 text-[12px] text-mauve">Carregando…</p>
          ) : !itens || itens.length === 0 ? (
            <p className="m-0 text-[12px] text-mauve">Sem itens no lote ainda.</p>
          ) : (
            <>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {itens.map((it, i) => (
                  <li key={i} className="flex items-baseline justify-between text-[12.5px]">
                    <span className="text-ink-soft">
                      {it.quantity}× <strong className="text-ink">{it.sku ?? "—"}</strong> {it.name}
                    </span>
                    <span className="shrink-0 pl-2 text-mauve">{formatarBRL(it.subtotal_cents)}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => void copiarLista()}
                className="mt-3 flex cursor-pointer items-center gap-1.5 rounded-full border border-mauve px-3.5 py-1.5 text-[11.5px] text-ink hover:border-wine hover:text-wine"
              >
                <Copy className="h-3 w-3" strokeWidth={1.8} />
                {copiado ? "Copiado!" : "Copiar lista"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SincronizacaoCard({
  sync,
  onSincronizado,
}: {
  sync: DashboardStats["last_sync"];
  onSincronizado: () => void;
}) {
  const [disparando, setDisparando] = useState(false);
  const [nota, setNota] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const emAndamento = sync?.status === "running";

  async function sincronizar() {
    setDisparando(true);
    setErro(null);
    setNota(null);
    try {
      const r = await triggerSync();
      setNota(r.nota ?? "Sincronização iniciada");
      onSincronizado();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui iniciar a sincronização");
    } finally {
      setDisparando(false);
    }
  }

  return (
    <div className="rounded-[16px] border border-blush bg-white p-5 shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-2">
          <h3 className="m-0 font-serif text-[15px]">Catálogo</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold tracking-[0.05em] uppercase ${
              emAndamento
                ? "animate-pulse bg-warning-soft text-warning"
                : sync?.status === "error"
                  ? "bg-danger-soft text-danger"
                  : "bg-cream text-mauve"
            }`}
          >
            {emAndamento ? "rodando" : sync ? (SYNC_STATUS_LABEL[sync.status] ?? sync.status) : "ocioso"}
          </span>
        </span>
        <button
          type="button"
          onClick={() => void sincronizar()}
          disabled={disparando || emAndamento}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-wine px-4 py-2 text-[11.5px] font-medium tracking-[0.05em] text-white uppercase hover:bg-wine-dark disabled:opacity-50"
        >
          {disparando || emAndamento ? (
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
          ) : (
            <RefreshCw className="h-3 w-3" strokeWidth={2} />
          )}
          Sincronizar
        </button>
      </div>

      {nota && <p className="m-0 mt-2 text-[12px] text-wine-dark">{nota}</p>}
      {erro && <p className="m-0 mt-2 text-[12px] text-wine-dark">{erro}</p>}

      <p className="m-0 mt-2 text-[11px] leading-relaxed text-mauve">
        Lê o catálogo inteiro da fornecedora — pode levar horas. Roda em segundo
        plano, dá pra sair da tela.
      </p>

      {sync ? (
        <div className="mt-3 border-t border-blush pt-3 text-[12.5px] text-ink-soft">
          <p className="m-0">
            Última rodada: <strong className="text-ink">{SYNC_STATUS_LABEL[sync.status] ?? sync.status}</strong>
            {" · "}{formatDate(sync.started_at)}
          </p>
          <p className="m-0 mt-1">
            {sync.processed} processados · {sync.created} novos · {sync.updated} atualizados
            {sync.failed > 0 && ` · ${sync.failed} falhas`}
            {sync.locked_prices > 0 && ` · ${sync.locked_prices} preços travados p/ revisão`}
          </p>
          {sync.error && <p className="m-0 mt-1 text-wine-dark">{sync.error}</p>}
        </div>
      ) : (
        <p className="m-0 mt-3 border-t border-blush pt-3 text-[12.5px] text-ink-soft">
          Nenhuma sincronização registrada ainda.
        </p>
      )}
    </div>
  );
}
