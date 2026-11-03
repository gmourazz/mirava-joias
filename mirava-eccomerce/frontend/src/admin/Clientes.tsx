// Clientes (v5): as contas da loja com quanto cada uma comprou, busca por
// nome ou e-mail e um drawer com os pedidos da cliente.
//
// Do protótipo ficam de fora níveis, etiquetas e anotações: precisam de
// tabela nova (decisão pendente, bloco 3).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Mail, Search, X } from "lucide-react";
import { formatarBRL } from "../lib/dinheiro";
import { extraApi, STAGE_PILL, dataCurta, type AdminOrder, type Customer } from "./api";

export default function Clientes() {
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<Customer[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<Customer | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      extraApi.customers(busca.trim()).then(setLista).catch((e: Error) => setErro(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  const compraram = lista?.filter((c) => c.orders > 0).length ?? 0;
  const recompra = lista?.filter((c) => c.orders > 1).length ?? 0;

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Contas" valor={lista?.length ?? 0} />
        <Stat label="Já compraram" valor={compraram} />
        <Stat label="Compraram mais de uma vez" valor={recompra} />
      </section>

      <label className="flex items-center gap-2 rounded-full border-[1.5px] border-line bg-white px-4 py-2.5">
        <Search size={16} strokeWidth={1.8} className="text-teal" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou e-mail…"
          className="min-w-0 flex-1 border-none bg-transparent text-[14px] outline-none"
        />
      </label>

      {erro && <p className="m-0 rounded-[20px] bg-[#FDECEC] p-4 text-[#B4443C]">{erro}</p>}

      <section className="overflow-x-auto rounded-[20px] border border-line bg-white">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[minmax(220px,1.6fr)_80px_120px_100px_90px_100px] gap-3 border-b border-line px-5 py-3 text-[11.5px] font-bold tracking-[0.06em] text-muted uppercase">
            <span>Cliente</span>
            <span>Pedidos</span>
            <span>Total gasto</span>
            <span>Última</span>
            <span>Favoritos</span>
            <span>Desde</span>
          </div>
          {!lista ? (
            <p className="m-0 px-5 py-10 text-center text-muted">Carregando…</p>
          ) : lista.length === 0 ? (
            <p className="m-0 px-5 py-10 text-center text-muted">Nenhuma cliente encontrada.</p>
          ) : (
            lista.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setAberta(c)}
                className="grid w-full cursor-pointer grid-cols-[minmax(220px,1.6fr)_80px_120px_100px_90px_100px] items-center gap-3 border-0 border-b border-[#EEF3F2] bg-transparent px-5 py-3 text-left text-[13.5px] last:border-b-0 hover:bg-[#F7FAFA]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar nome={c.name || c.email} />
                  <span className="grid min-w-0">
                    <span className="truncate font-medium text-text">
                      {c.name || "—"}
                      {c.is_admin && <span className="ml-2 rounded-full bg-teal-dark px-2 py-0.5 text-[10px] font-bold text-white">ADMIN</span>}
                    </span>
                    <span className="truncate text-[12px] text-muted">{c.email}</span>
                  </span>
                </span>
                <span className="font-semibold">{c.orders}</span>
                <span className="font-semibold text-success">{formatarBRL(c.spent_cents)}</span>
                <span className="text-text-2">{dataCurta(c.last_order_at)}</span>
                <span className="text-text-2">{c.favorites}</span>
                <span className="text-text-2">{new Date(c.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</span>
              </button>
            ))
          )}
        </div>
      </section>

      {aberta && <ClienteDrawer cliente={aberta} fechar={() => setAberta(null)} />}
    </>
  );
}

function ClienteDrawer({ cliente, fechar }: { cliente: Customer; fechar: () => void }) {
  const [pedidos, setPedidos] = useState<AdminOrder[] | null>(null);

  useEffect(() => {
    extraApi.customerOrders(cliente.id).then(setPedidos).catch(() => setPedidos([]));
  }, [cliente.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fechar]);

  const ticket = cliente.orders > 0 ? Math.round(cliente.spent_cents / cliente.orders) : 0;

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div className="animate-fade-in absolute inset-0 bg-teal-dark/35" onClick={fechar} />
      <aside className="animate-drawer absolute inset-y-0 right-0 flex w-[min(460px,100%)] flex-col bg-white">
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
          <div className="flex items-center gap-3">
            <Avatar nome={cliente.name || cliente.email} grande />
            <div className="grid">
              <span className="font-serif text-[22px] leading-tight text-teal-dark">{cliente.name || "Sem nome"}</span>
              <span className="text-[13px] text-muted">{cliente.email}</span>
              {cliente.phone && <span className="text-[13px] text-muted">{cliente.phone}</span>}
            </div>
          </div>
          <button type="button" aria-label="Fechar" onClick={fechar} className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-none bg-chip">
            <X size={18} />
          </button>
        </div>
        <div className="grid flex-1 content-start gap-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-3 gap-2">
            <Mini label="Pedidos" valor={String(cliente.orders)} />
            <Mini label="Total gasto" valor={formatarBRL(cliente.spent_cents)} />
            <Mini label="Ticket médio" valor={formatarBRL(ticket)} />
          </div>
          <section className="grid gap-2">
            <span className="text-[12px] font-bold tracking-[0.06em] text-muted uppercase">Histórico de pedidos</span>
            {!pedidos ? (
              <span className="text-muted">Carregando…</span>
            ) : pedidos.length === 0 ? (
              <span className="text-muted">Nenhum pedido ainda.</span>
            ) : (
              pedidos.map((o) => {
                const pill = STAGE_PILL[o.stage];
                return (
                  <Link
                    key={o.id}
                    to={`/admin/pedidos?abrir=${o.id}`}
                    className="grid grid-cols-[60px_1fr_auto] items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-[13.5px] text-text hover:border-line-strong hover:text-text"
                  >
                    <span className="font-semibold text-teal">#{o.number}</span>
                    <span className="grid">
                      <span>{formatarBRL(o.total_cents)}</span>
                      <span className="text-[12px] text-muted">{dataCurta(o.paid_at ?? o.created_at)} · {o.items_count} peças</span>
                    </span>
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap" style={{ background: pill.bg, color: pill.fg }}>
                      {pill.label}
                    </span>
                  </Link>
                );
              })
            )}
          </section>
        </div>
        <div className="border-t border-line px-6 py-4">
          <a
            href={`mailto:${cliente.email}`}
            className="flex items-center justify-center gap-2 rounded-full bg-teal py-3 text-[14px] font-semibold text-white hover:bg-teal-dark hover:text-white"
          >
            <Mail size={16} strokeWidth={1.8} />
            Escrever para a cliente
          </a>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function Avatar({ nome, grande = false }: { nome: string; grande?: boolean }) {
  const p = nome.trim().split(/\s+/);
  const ini = ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-mist font-logo text-teal ${grande ? "h-[52px] w-[52px] text-[18px]" : "h-9 w-9 text-[13px]"}`}>
      {ini}
    </span>
  );
}

function Stat({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="grid gap-1.5 rounded-[20px] border border-line bg-white p-[18px]">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="font-serif text-[26px] leading-none text-teal-dark">{valor}</span>
    </div>
  );
}

function Mini({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="grid gap-1 rounded-xl bg-fog p-3">
      <span className="text-[11.5px] text-muted">{label}</span>
      <strong className="text-text">{valor}</strong>
    </div>
  );
}
