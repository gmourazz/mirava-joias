import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Check, Loader2, PackageCheck } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { formatarBRL } from "../../lib/dinheiro";
import { formatDate } from "../../lib/pedidos";
import {
  advanceOrderStatus, getOrderDetail, NEXT_STATUSES, STATUS_LABEL,
  type AdminOrderDetail,
} from "../../lib/admin";

// Transições sem volta fácil — pede confirmação antes de aplicar.
const CONFIRMAR = new Set(["cancelled", "refunded", "out_of_stock"]);

export default function AdminPedidoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [pedido, setPedido] = useState<AdminOrderDetail | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    if (!id) return;
    setErro(null);
    try {
      setPedido(await getOrderDetail(id));
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui carregar o pedido");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (carregando) return <div className="px-6 py-10 sm:px-10"><p className="m-0 text-[13px] text-mauve">Carregando…</p></div>;

  if (erro || !pedido) {
    return (
      <div className="px-6 py-10 sm:px-10">
        <p className="m-0 flex items-center gap-2 rounded-[10px] bg-blush px-4 py-3 text-[12.5px] text-wine-dark">
          <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          {erro ?? "Pedido não encontrado"}
        </p>
      </div>
    );
  }

  const end = pedido.address ?? {};
  const lucroItens = pedido.items.reduce(
    (soma, it) => soma + (it.unit_price_cents - it.unit_cost_cents) * it.quantity, 0,
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:px-10">
      <Link to="/admin/pedidos" className="mb-5 flex w-fit items-center gap-1.5 text-[12.5px] text-mauve hover:text-wine">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
        Todos os pedidos
      </Link>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 font-serif text-[26px] font-normal text-wine">Pedido #{pedido.number}</h1>
          <p className="m-0 mt-1 text-[12.5px] text-ink-soft">
            Criado em {formatDate(pedido.created_at)}
            {pedido.paid_at && ` · pago em ${formatDate(pedido.paid_at)}`}
          </p>
        </div>
        <span className="rounded-full border border-blush bg-cream/60 px-4 py-1.5 text-[12px] font-medium text-wine-dark">
          {STATUS_LABEL[pedido.status] ?? pedido.status}
        </span>
      </div>

      <div className="grid gap-6 sm:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <section className="rounded-[16px] border border-blush bg-white p-5 shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
            <h2 className="m-0 mb-3 font-serif text-[15px]">Peças</h2>
            <div className="flex flex-col gap-2.5">
              {pedido.items.map((it, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="text-ink">
                    {it.quantity}× {it.name}{it.size && ` · ${it.size}`}
                    {it.sku && <span className="text-mauve"> ({it.sku})</span>}
                  </span>
                  <span className="shrink-0 text-ink-soft">
                    {formatarBRL(it.unit_price_cents)} <span className="text-mauve">/ custo {formatarBRL(it.unit_cost_cents)}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-1 border-t border-blush pt-3 text-[12.5px]">
              <Linha label="Subtotal" valor={formatarBRL(pedido.subtotal_cents)} />
              <Linha label="Frete" valor={formatarBRL(pedido.shipping_cents)} />
              {pedido.discount_cents > 0 && <Linha label="Desconto" valor={`− ${formatarBRL(pedido.discount_cents)}`} />}
              <Linha label="Total" valor={formatarBRL(pedido.total_cents)} destaque />
              <Linha label="Lucro das peças" valor={formatarBRL(lucroItens)} destaque />
            </div>
          </section>

          {pedido.payments.length > 0 && (
            <section className="rounded-[16px] border border-blush bg-white p-5 shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
              <h2 className="m-0 mb-3 font-serif text-[15px]">Pagamento</h2>
              {pedido.payments.map((p) => (
                <div key={p.mp_payment_id} className="flex flex-col gap-1 text-[12.5px] text-ink-soft">
                  <Linha label="Status" valor={p.status} />
                  {p.method && <Linha label="Método" valor={p.method} />}
                  {p.installments != null && p.installments > 1 && (
                    <Linha label="Parcelas" valor={`${p.installments}x`} />
                  )}
                  <Linha label="Valor" valor={formatarBRL(p.amount_cents)} />
                  {p.fee_cents != null && <Linha label="Taxa do Mercado Pago" valor={formatarBRL(p.fee_cents)} />}
                  {p.net_cents != null && <Linha label="Líquido" valor={formatarBRL(p.net_cents)} />}
                </div>
              ))}
            </section>
          )}

          <AcoesStatus pedido={pedido} onMudou={carregar} />
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-[16px] border border-blush bg-white p-5 shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
            <h2 className="m-0 mb-3 font-serif text-[15px]">Cliente</h2>
            <p className="m-0 text-[13px] text-ink">{pedido.customer_name}</p>
            <p className="m-0 text-[12.5px] text-ink-soft">{pedido.customer_email}</p>
            {pedido.customer_phone && <p className="m-0 text-[12.5px] text-ink-soft">{pedido.customer_phone}</p>}
            {pedido.customer_cpf && <p className="m-0 text-[12.5px] text-ink-soft">CPF {pedido.customer_cpf}</p>}
          </section>

          <section className="rounded-[16px] border border-blush bg-white p-5 shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
            <h2 className="m-0 mb-3 font-serif text-[15px]">Entregar em</h2>
            <p className="m-0 text-[12.5px] leading-relaxed text-ink-soft">
              {end.recipient ?? pedido.customer_name}<br />
              {end.street}, {end.number}{end.complement ? ` · ${end.complement}` : ""}<br />
              {end.neighborhood} · {end.city}/{end.state}<br />
              CEP {end.zip_code}
            </p>
            {pedido.shipping_method === "sedex" && (
              <span className="mt-2 inline-block rounded-full bg-wine px-2.5 py-1 text-[10px] font-medium text-white uppercase">
                SEDEX
              </span>
            )}
            {pedido.tracking_code && (
              <p className="m-0 mt-2 text-[12.5px] text-ink-soft">Rastreio: <strong className="text-ink">{pedido.tracking_code}</strong></p>
            )}
          </section>

          {(pedido.engraving || pedido.notes) && (
            <section className="rounded-[16px] border border-blush bg-white p-5 shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
              {pedido.engraving && (
                <>
                  <h2 className="m-0 mb-1.5 font-serif text-[15px]">Gravação</h2>
                  <p className="m-0 mb-3 text-[12.5px] text-ink-soft">{pedido.engraving}</p>
                </>
              )}
              {pedido.notes && (
                <>
                  <h2 className="m-0 mb-1.5 font-serif text-[15px]">Observações</h2>
                  <p className="m-0 text-[12.5px] text-ink-soft">{pedido.notes}</p>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Linha({ label, valor, destaque = false }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between ${destaque ? "font-medium text-ink" : "text-ink-soft"}`}>
      <span>{label}</span>
      <span>{valor}</span>
    </div>
  );
}

function AcoesStatus({ pedido, onMudou }: { pedido: AdminOrderDetail; onMudou: () => void }) {
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const proximos = NEXT_STATUSES[pedido.status] ?? [];

  async function ir(to: string) {
    if (CONFIRMAR.has(to) && !window.confirm(`Mudar o pedido #${pedido.number} para "${STATUS_LABEL[to]}"?`)) {
      return;
    }
    setErro(null);
    setProcessando(to);
    try {
      await advanceOrderStatus(pedido.id, to);
      onMudou();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui mudar o status");
    } finally {
      setProcessando(null);
    }
  }

  if (pedido.status === "received_by_owner") {
    return <DespacharForm pedido={pedido} onDespachado={onMudou} />;
  }

  if (proximos.length === 0) return null;

  return (
    <section className="rounded-[16px] border border-blush bg-white p-5 shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
      <h2 className="m-0 mb-3 font-serif text-[15px]">Mudar status</h2>
      <div className="flex flex-wrap gap-2">
        {proximos.map((to) => (
          <button
            key={to}
            type="button"
            onClick={() => void ir(to)}
            disabled={processando !== null}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-mauve px-4 py-2 text-[12px] text-ink hover:border-wine hover:text-wine disabled:opacity-50"
          >
            {processando === to && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />}
            {STATUS_LABEL[to] ?? to}
          </button>
        ))}
      </div>
      {erro && <p className="m-0 mt-3 text-[12px] text-wine-dark">{erro}</p>}
    </section>
  );
}

function DespacharForm({ pedido, onDespachado }: { pedido: AdminOrderDetail; onDespachado: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  async function despachar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api(`/gestao/pedidos/${pedido.id}/despachar`, {
        method: "POST",
        authenticated: true,
        body: { tracking_code: codigo },
      });
      setPronto(true);
      setTimeout(onDespachado, 1200);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui despachar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="rounded-[16px] border border-blush bg-white p-5 shadow-[0_6px_20px_-12px_rgba(92,42,70,0.2)]">
      <h2 className="m-0 mb-3 font-serif text-[15px]">Despachar</h2>
      {pronto ? (
        <p className="m-0 flex items-center gap-2 rounded-[10px] bg-cream px-4 py-3 text-[13px] text-wine-dark">
          <Check className="h-4 w-4" strokeWidth={2.2} />
          Despachado. A cliente já recebeu o e-mail com o rastreio.
        </p>
      ) : (
        <form onSubmit={despachar} className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="AA123456789BR"
            required
            className="min-w-0 flex-1 rounded-[10px] border border-mauve/50 px-3.5 py-2.5 text-[14px] tracking-[0.06em] outline-none focus:border-wine"
          />
          <button
            type="submit"
            disabled={enviando}
            className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-wine px-5 py-2.5 font-serif text-[12.5px] font-semibold tracking-[0.14em] text-white uppercase hover:bg-wine-dark disabled:opacity-50"
          >
            {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} /> : <PackageCheck className="h-3.5 w-3.5" strokeWidth={1.8} />}
            Despachar
          </button>
          {erro && <p className="m-0 w-full text-[12px] text-wine-dark">{erro}</p>}
        </form>
      )}
    </section>
  );
}
