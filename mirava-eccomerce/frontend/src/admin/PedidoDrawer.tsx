// Drawer "Pedido #N" (v5): cliente, envio, prazo, peças com o custo
// congelado, andamento (eventos do banco), ações manuais e o bloco de
// despacho com o código de rastreio. As ações oferecidas vêm da API
// (dominio.ManualActions) — a tela não decide o que pode.

import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";
import { Check, Printer, X } from "lucide-react";
import { formatarBRL } from "../lib/dinheiro";
import { imageUrl } from "../catalogo/consultas";
import { ApiError } from "../lib/api";
import { ACTION_LABEL, STAGE_PILL, SHIP_LABEL, adminApi, dataCurta, type AdminOrderDetail, type OrderStatus } from "./api";
import Etiqueta from "./Etiqueta";

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Pedido realizado",
  paid: "Pagamento confirmado",
  in_batch: "Entrou no lote de compra",
  purchased_from_supplier: "Pedido feito na Use Lilly",
  received_by_owner: "Recebido do fornecedor",
  shipped: "Despachado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  refunded: "Estornado",
  out_of_stock: "Sem estoque na fornecedora",
};

// Ações que mexem com dinheiro ou encerram o pedido pedem confirmação.
const CONFIRMAR: Partial<Record<OrderStatus, string>> = {
  cancelled: "Cancelar este pedido? A cliente não será cobrada.",
  refunded: "Marcar como estornado? Faça o estorno no painel do Mercado Pago antes.",
  out_of_stock: "Marcar como sem estoque na Lilly? Fale com a cliente sobre troca ou estorno.",
};

export default function PedidoDrawer({ id, fechar, mudou }: { id: string; fechar: () => void; mudou: () => void }) {
  const [pedido, setPedido] = useState<AdminOrderDetail | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rastreio, setRastreio] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState<OrderStatus | null>(null);
  const [etiqueta, setEtiqueta] = useState(false);

  const carregar = () => adminApi.order(id).then(setPedido).catch((e: Error) => setErro(e.message));
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fechar]);

  async function executar(acao: () => Promise<unknown>) {
    setErro(null);
    setSalvando(true);
    try {
      await acao();
      await carregar();
      mudou();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui salvar");
    } finally {
      setSalvando(false);
      setConfirmar(null);
    }
  }

  const transicao = (to: OrderStatus) => {
    if (!pedido) return;
    if (CONFIRMAR[to] && confirmar !== to) {
      setConfirmar(to);
      return;
    }
    void executar(() => adminApi.transition(pedido.id, pedido.status, to));
  };

  const rastreioLimpo = rastreio.replace(/\s/g, "").toUpperCase();
  const rastreioValido = /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/.test(rastreioLimpo);

  // Portal no body: o conteúdo do painel tem animação de entrada, que cria
  // um contexto de empilhamento — sem o portal, o véu não cobriria o topo
  // nem a sidebar.
  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div className="animate-fade-in absolute inset-0 bg-teal-dark/35" onClick={fechar} />
      <aside className="animate-drawer absolute inset-y-0 right-0 flex w-[min(520px,100%)] flex-col bg-white">
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
          <div className="grid gap-1.5">
            <span className="font-serif text-[26px] leading-none text-teal-dark">Pedido {pedido ? `#${pedido.number}` : ""}</span>
            {pedido && (
              <span className="w-fit rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: STAGE_PILL[pedido.stage].bg, color: STAGE_PILL[pedido.stage].fg }}>
                {STAGE_PILL[pedido.stage].label}
              </span>
            )}
          </div>
          <button type="button" aria-label="Fechar" onClick={fechar} className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-none bg-chip text-text">
            <X size={18} />
          </button>
        </div>

        <div className="grid flex-1 content-start gap-4 overflow-y-auto px-6 py-5">
          {!pedido && !erro && <p className="m-0 text-muted">Carregando…</p>}
          {erro && <p className="m-0 rounded-2xl bg-[#FDECEC] px-4 py-3 text-[13.5px] text-[#B4443C]">{erro}</p>}

          {pedido && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Caixa titulo="Cliente">
                  <strong className="text-text">{pedido.customer_name}</strong>
                  <span className="break-all text-muted">{pedido.customer_email}</span>
                  {pedido.customer_phone && <span className="text-muted">{pedido.customer_phone}</span>}
                </Caixa>
                <Caixa titulo="Envio escolhido">
                  <strong className="text-text">Correios {pedido.shipping_method ? SHIP_LABEL[pedido.shipping_method] : "—"}</strong>
                  <span className="text-muted">{pedido.shipping_cents === 0 ? "Frete grátis" : `Frete pago ${formatarBRL(pedido.shipping_cents)}`}</span>
                </Caixa>
              </div>

              {pedido.address && (
                <Caixa titulo="Endereço">
                  <span className="text-text-2">
                    {pedido.address.recipient && <>{pedido.address.recipient}<br /></>}
                    {pedido.address.street}, {pedido.address.number}
                    {pedido.address.complement && ` · ${pedido.address.complement}`}
                    <br />
                    {pedido.address.neighborhood} · {pedido.address.city}/{pedido.address.state} · CEP {pedido.address.zip_code}
                  </span>
                </Caixa>
              )}

              {pedido.deadline && (
                <div className={`grid gap-2 rounded-2xl border-[1.5px] p-4 ${pedido.deadline.late ? "border-[#C4483D]" : pedido.deadline.near ? "border-[#B07A12]" : "border-line"}`}>
                  <span className="text-[12px] font-bold tracking-[0.06em] text-muted uppercase">Prazo de entrega</span>
                  <strong className={pedido.deadline.late ? "text-[#C4483D]" : pedido.deadline.near ? "text-[#B07A12]" : "text-teal"}>
                    {pedido.deadline.late ? `Atrasado ${-pedido.deadline.left} dias úteis` : `${pedido.deadline.left} dias úteis restantes`}
                  </strong>
                  <span className="h-1.5 overflow-hidden rounded-full bg-[#F0F4F4]">
                    <span className="block h-full bg-teal" style={{ width: `${Math.min(100, (pedido.deadline.used / 20) * 100)}%` }} />
                  </span>
                  <span className="text-[12.5px] text-muted">
                    Pago em {dataCurta(pedido.paid_at)} · entrega até {dataCurta(pedido.deadline.due)} (20 dias úteis)
                  </span>
                </div>
              )}

              <section className="grid gap-3">
                <span className="text-[12px] font-bold tracking-[0.06em] text-muted uppercase">Peças</span>
                {pedido.items.map((it, i) => {
                  const foto = imageUrl(it.image ?? undefined);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-mist-3">
                        {foto && <img src={foto} alt="" className="h-full w-full object-cover" />}
                      </span>
                      <span className="grid min-w-0 flex-1">
                        <span className="truncate font-medium text-text">
                          {it.quantity > 1 && `${it.quantity}× `}
                          {it.name}
                        </span>
                        <span className="font-mono text-[12px] text-muted">
                          {it.sku ?? "sem SKU"}
                          {it.size && ` · ${it.size}`}
                        </span>
                      </span>
                      <span className="grid text-right">
                        <span className="font-semibold">{formatarBRL(it.price_cents * it.quantity)}</span>
                        <span className="text-[12px] text-muted">atacado {formatarBRL(it.cost_cents * it.quantity)}</span>
                      </span>
                    </div>
                  );
                })}
                <div className="grid grid-cols-3 gap-2">
                  <MiniCaixa label="Você paga na Lilly" valor={formatarBRL(pedido.cost_cents)} />
                  <MiniCaixa label="Cliente pagou" valor={formatarBRL(pedido.total_cents)} />
                  <MiniCaixa label="Seu lucro" valor={formatarBRL(pedido.subtotal_cents - pedido.cost_cents)} verde />
                </div>
              </section>

              <section className="grid gap-2">
                <span className="text-[12px] font-bold tracking-[0.06em] text-muted uppercase">Andamento</span>
                <ol className="m-0 grid list-none p-0">
                  {[{ to_status: "awaiting_payment", created_at: pedido.created_at, origin: "system" }, ...pedido.events].map((e, i, arr) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex flex-col items-center">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-teal text-white">
                          <Check size={13} strokeWidth={3} />
                        </span>
                        {i < arr.length - 1 && <span className="w-0.5 flex-1 bg-teal" />}
                      </span>
                      <span className="grid pb-3">
                        <span className="font-medium text-text">{STATUS_LABEL[e.to_status] ?? e.to_status}</span>
                        <span className="text-[12px] text-muted">
                          {new Date(e.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          {e.origin === "admin" && " · pelo painel"}
                          {e.to_status === "shipped" && pedido.tracking_code && ` · ${pedido.tracking_code}`}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>

              {pedido.status === "received_by_owner" && (
                <section className="grid gap-3 rounded-2xl bg-mist p-4">
                  <strong className="text-text">Despachar pedido</strong>
                  <span className="text-[13.5px] text-text-2">
                    A cliente escolheu <strong>{pedido.shipping_method ? SHIP_LABEL[pedido.shipping_method] : "—"}</strong>. Cole o código de rastreio dos
                    Correios: ela recebe um e-mail na hora.
                  </span>
                  <input
                    value={rastreio}
                    onChange={(e) => setRastreio(e.target.value.toUpperCase())}
                    placeholder="Ex.: QB123456789BR"
                    className="rounded-[14px] border-[1.5px] border-line bg-white px-3.5 py-3 font-mono text-[15px] uppercase outline-none focus:border-teal"
                  />
                  <button
                    type="button"
                    disabled={!rastreioValido || salvando}
                    onClick={() => void executar(() => adminApi.ship(pedido.id, rastreioLimpo))}
                    className="cursor-pointer rounded-full border-none bg-teal px-5 py-3 text-[14px] font-semibold text-white hover:bg-teal-dark disabled:cursor-not-allowed disabled:bg-faint"
                  >
                    Despachar e enviar e-mail para a cliente
                  </button>
                </section>
              )}

              {(pedido.status === "received_by_owner" || pedido.status === "shipped") && (
                <button
                  type="button"
                  onClick={() => setEtiqueta(true)}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-line-strong bg-white px-5 py-3 text-[14px] font-semibold text-teal hover:border-teal"
                >
                  <Printer size={16} strokeWidth={1.8} />
                  Etiqueta + declaração de conteúdo
                </button>
              )}

              {confirmar && (
                <p className="m-0 rounded-2xl bg-[#FFF4E0] px-4 py-3 text-[13.5px] text-[#9A6B12]">
                  {CONFIRMAR[confirmar]} Clique de novo para confirmar.
                </p>
              )}
            </>
          )}
        </div>

        {pedido && pedido.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-line px-6 py-4">
            {pedido.actions.map((to) => {
              const perigosa = Boolean(CONFIRMAR[to]);
              return (
                <button
                  key={to}
                  type="button"
                  disabled={salvando}
                  onClick={() => transicao(to)}
                  className={`flex-1 cursor-pointer rounded-full px-4 py-3 text-[13.5px] font-semibold whitespace-nowrap disabled:opacity-50 ${
                    perigosa
                      ? `border-[1.5px] ${confirmar === to ? "border-[#B4443C] bg-[#B4443C] text-white" : "border-[#F3C9C4] bg-white text-[#B4443C]"}`
                      : "border-none bg-teal text-white hover:bg-teal-dark"
                  }`}
                >
                  {ACTION_LABEL[to] ?? to}
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {etiqueta && pedido && <Etiqueta pedido={pedido} fechar={() => setEtiqueta(false)} />}
    </div>,
    document.body,
  );
}

function Caixa({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-1 rounded-2xl bg-fog p-4 text-[13.5px]">
      <span className="text-[11.5px] font-bold tracking-[0.06em] text-muted uppercase">{titulo}</span>
      {children}
    </div>
  );
}

function MiniCaixa({ label, valor, verde = false }: { label: string; valor: string; verde?: boolean }) {
  return (
    <div className="grid gap-1 rounded-xl bg-fog p-3">
      <span className="text-[11.5px] text-muted">{label}</span>
      <strong className={verde ? "text-success" : "text-text"}>{valor}</strong>
    </div>
  );
}
