import { useEffect, useState } from "react";
import {
  AlertCircle, CalendarDays, ChevronDown, Copy, Loader2, Receipt,
  RefreshCw, ShoppingBag, Sparkles, Wallet, type LucideIcon,
} from "lucide-react";
import { ApiError } from "../../lib/api";
import { formatarBRL } from "../../lib/dinheiro";
import { formatDate } from "../../lib/pedidos";
import {
  getDashboard, getShoppingList, triggerSync,
  STATUS_LABEL, SYNC_STATUS_LABEL,
  type DashboardStats, type ShoppingItem,
} from "../../lib/admin";

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
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
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:px-10">
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
          <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
            <Cartao icon={Wallet} titulo="Receita hoje" valor={formatarBRL(stats.revenue_today_cents)} />
            <Cartao icon={CalendarDays} titulo="Receita do mês" valor={formatarBRL(stats.revenue_month_cents)} />
            <Cartao icon={Sparkles} titulo="Lucro estimado do mês" valor={formatarBRL(stats.profit_month_cents)} destaque />
            <Cartao icon={ShoppingBag} titulo="Pedidos hoje" valor={String(stats.orders_today)} />
            <Cartao icon={ShoppingBag} titulo="Pedidos do mês" valor={String(stats.orders_month)} />
            <Cartao icon={Receipt} titulo="Ticket médio" valor={formatarBRL(stats.average_ticket_cents)} />
          </section>

          <p className="m-0 mt-2 text-[11px] leading-relaxed text-mauve">
            Lucro estimado = receita − custo das peças − taxa do Mercado Pago − embalagem.
            Não inclui o frete pago aos Correios (esse custo só existe somado por lote, não por pedido).
          </p>

          <section className="mt-9 grid gap-5 sm:grid-cols-2">
            <LoteCard batch={stats.open_batch} />
            <SincronizacaoCard sync={stats.last_sync} onSincronizado={carregar} />
          </section>

          <section className="mt-9">
            <h2 className="m-0 mb-3 font-serif text-[18px] font-normal">Pedidos por status</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.status_counts)
                .filter(([, n]) => n > 0)
                .map(([status, n]) => (
                  <span
                    key={status}
                    className="rounded-full border border-blush bg-cream/60 px-3.5 py-1.5 text-[12px] text-ink-soft"
                  >
                    {STATUS_LABEL[status] ?? status} <strong className="text-ink">{n}</strong>
                  </span>
                ))}
              {Object.values(stats.status_counts).every((n) => n === 0) && (
                <span className="text-[12.5px] text-mauve">Nenhum pedido ainda.</span>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Cartao({
  icon: Icon, titulo, valor, destaque = false,
}: {
  icon: LucideIcon; titulo: string; valor: string; destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-[16px] border p-4 shadow-[0_6px_20px_-10px_rgba(92,42,70,0.25)] transition-shadow hover:shadow-[0_10px_26px_-10px_rgba(92,42,70,0.3)] ${
        destaque
          ? "border-wine/40 bg-[linear-gradient(160deg,#fff9fb_0%,#fdeaf2_100%)]"
          : "border-blush bg-white"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            destaque ? "bg-wine text-white" : "bg-blush text-wine-dark"
          }`}
        >
          <Icon className="h-[15px] w-[15px]" strokeWidth={1.8} />
        </span>
        <p className="m-0 text-[10.5px] tracking-[0.08em] text-ink-soft uppercase">{titulo}</p>
      </div>
      <p className={`m-0 mt-2.5 font-serif text-[21px] ${destaque ? "text-wine-dark" : "text-ink"}`}>{valor}</p>
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
      <div className="rounded-[16px] border border-blush bg-white p-5 shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
        <h3 className="m-0 mb-1 font-serif text-[15px]">Lote</h3>
        <p className="m-0 text-[12.5px] text-ink-soft">Nenhum lote aberto no momento.</p>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((batch.cost_cents / batch.goal_cents) * 100));
  const perto = batch.oldest_business_days >= 5;

  return (
    <div className="rounded-[16px] border border-blush bg-white p-5 shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
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
        <h3 className="m-0 font-serif text-[15px]">Catálogo</h3>
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
