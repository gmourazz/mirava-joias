// Minha conta (v5): topo próprio, faixa teal com a cliente e os números da
// conta, menu lateral e o conteúdo da aba ao lado. A aba vai na URL
// (?aba=pedidos), para o "Meus pedidos" do header cair direto nela.
//
// Abas do protótipo que dependem de backend inexistente ficaram de fora:
// Cupons, Mirava Club e Pagamentos (cartão salvo). Voltam quando houver dado
// de verdade por trás.

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronRight, CreditCard, Gift, Heart, HelpCircle, Home as HomeIcon, LayoutGrid, LogOut, MapPin, Package,
  Plus, RefreshCw, Trash2, Truck, User, type LucideIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { formatarBRL } from "../lib/dinheiro";
import { LOJA } from "../config/loja";
import { FAQ } from "../data/content";
import {
  STAGE_LABEL, formatDate, listOrders, stageOf, supportURL, type Order, type Stage,
} from "../lib/pedidos";
import {
  createAddress, deleteAddress, formatZip, listAddresses, lookupZip, onlyDigits,
  type Address, type NewAddress,
} from "../lib/enderecos";
import EntrarCadastro from "../components/EntrarCadastro";
import ProductCard from "../components/ProductCard";
import { listFavorites } from "../lib/favoritos";
import { useFavorites } from "../context/FavoritesContext";
import type { Product } from "../catalogo/tipos";

type Aba = "geral" | "pedidos" | "favoritos" | "enderecos" | "dados" | "trocas";

const ABAS: { key: Aba; label: string; Icon: LucideIcon }[] = [
  { key: "geral", label: "Visão geral", Icon: LayoutGrid },
  { key: "pedidos", label: "Meus pedidos", Icon: Package },
  { key: "favoritos", label: "Favoritos", Icon: Heart },
  { key: "enderecos", label: "Endereços", Icon: MapPin },
  { key: "dados", label: "Meus dados", Icon: User },
  { key: "trocas", label: "Trocas e devoluções", Icon: RefreshCw },
];

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export default function Conta() {
  const { user, loading, logout } = useAuth();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const aba = (ABAS.some((a) => a.key === params.get("aba")) ? params.get("aba") : "geral") as Aba;

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [addresses, setAddresses] = useState<Address[] | null>(null);

  useEffect(() => {
    if (!user) return;
    listOrders().then(setOrders).catch(() => setOrders([]));
    listAddresses().then(setAddresses).catch(() => setAddresses([]));
  }, [user]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [aba]);

  // Veio do checkout para entrar (?voltar=/checkout): depois do login, volta
  // para lá. Só caminho interno — "//site.com" seria um redirecionamento aberto.
  const voltar = params.get("voltar");
  useEffect(() => {
    if (user && voltar?.startsWith("/") && !voltar.startsWith("//")) navigate(voltar, { replace: true });
  }, [user, voltar, navigate]);

  if (loading) return null;
  if (!user) return <EntrarCadastro />;

  const irPara = (a: Aba) => setParams(a === "geral" ? {} : { aba: a });
  const sair = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-snow">
      <header className="sticky top-0 z-30 border-b border-line bg-white/97 backdrop-blur-[10px]">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-4 px-[clamp(16px,3vw,40px)]">
          <div className="flex items-center gap-4">
            <Link to="/" className="font-logo text-[24px] tracking-[0.28em] text-teal-dark hover:text-teal-dark">
              MIRAVA
            </Link>
            <span className="hidden h-6 w-px bg-line sm:block" />
            <span className="hidden items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-muted sm:flex">
              <User size={14} strokeWidth={1.8} />
              MINHA CONTA
            </span>
          </div>
          <Link to="/" className="flex items-center gap-2 text-[13.5px] font-semibold text-teal hover:text-teal-dark">
            <HomeIcon size={16} strokeWidth={1.8} />
            Voltar para a loja
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1280px] px-[clamp(16px,3vw,40px)] pt-6 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-[28px] bg-teal p-[clamp(20px,3vw,32px)] text-white">
          <div className="flex items-center gap-4">
            <span className="grid h-[84px] w-[84px] place-items-center rounded-full bg-white font-logo text-[32px] text-teal">
              {iniciais(user.name || user.email)}
            </span>
            <div className="grid gap-1">
              <span className="font-serif text-[clamp(26px,3vw,34px)] leading-none">Olá, {user.name.split(" ")[0] || "cliente"}</span>
              <span className="text-[14px] text-[#BFE3DF]">{user.email}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Numero label="PEDIDOS" valor={orders?.length} onClick={() => irPara("pedidos")} />
            <Numero label="ENDEREÇOS" valor={addresses?.length} onClick={() => irPara("enderecos")} />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(210px,250px)_1fr]">
          <nav className="h-fit rounded-3xl border border-line bg-white p-2.5 lg:sticky lg:top-24">
            <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:grid">
              {ABAS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => irPara(key)}
                  className={`flex shrink-0 cursor-pointer items-center gap-3 rounded-[14px] border-none px-3.5 py-3 text-left text-[14px] transition-colors ${
                    aba === key ? "bg-mist font-semibold text-teal" : "bg-transparent text-text hover:bg-fog"
                  }`}
                >
                  <Icon size={17} strokeWidth={1.7} />
                  {label}
                  {key === "pedidos" && orders && orders.length > 0 && (
                    <span className="ml-auto rounded-full bg-teal px-2 py-0.5 text-[11px] font-bold text-white">{orders.length}</span>
                  )}
                </button>
              ))}
              <Link to="/perguntas-frequentes" className="flex shrink-0 items-center gap-3 rounded-[14px] px-3.5 py-3 text-[14px] text-text hover:bg-fog hover:text-text">
                <HelpCircle size={17} strokeWidth={1.7} />
                Ajuda
              </Link>
              <span className="my-1 hidden h-px bg-line lg:block" />
              <button
                type="button"
                onClick={sair}
                className="flex shrink-0 cursor-pointer items-center gap-3 rounded-[14px] border-none bg-transparent px-3.5 py-3 text-left text-[14px] text-muted hover:bg-fog"
              >
                <LogOut size={17} strokeWidth={1.7} />
                Sair
              </button>
            </div>
          </nav>

          <main key={aba} className="animate-fade-in grid min-w-0 content-start gap-5">
            {aba === "geral" && <VisaoGeral orders={orders} irPara={irPara} />}
            {aba === "pedidos" && <MeusPedidos orders={orders} />}
            {aba === "favoritos" && <Favoritos />}
            {aba === "enderecos" && <Enderecos addresses={addresses} setAddresses={setAddresses} />}
            {aba === "dados" && <MeusDados />}
            {aba === "trocas" && <Trocas />}
          </main>
        </div>
      </div>
    </div>
  );
}

function Numero({ label, valor, onClick }: { label: string; valor: number | undefined; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="grid min-w-[120px] cursor-pointer gap-1 rounded-[20px] border-none bg-white/10 px-5 py-3.5 text-left text-white hover:bg-white/15">
      <span className="font-serif text-[26px] leading-none">{valor ?? "–"}</span>
      <span className="text-[11px] font-semibold tracking-[0.14em] text-teal-pale">{label}</span>
    </button>
  );
}

function Cartao({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 font-serif text-[24px] font-normal text-teal-dark">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

// ─── Visão geral ────────────────────────────────────────────────────────────

const STATUS: { stage: Stage; label: string; Icon: LucideIcon }[] = [
  { stage: "aguardando", label: "Aguardando pagamento", Icon: CreditCard },
  { stage: "preparacao", label: "Em preparação", Icon: Package },
  { stage: "enviado", label: "A caminho", Icon: Truck },
  { stage: "entregue", label: "Entregues", Icon: Gift },
];

function VisaoGeral({ orders, irPara }: { orders: Order[] | null; irPara: (a: Aba) => void }) {
  const andamento = orders?.find((o) => ["preparacao", "enviado"].includes(stageOf(o.status)));
  return (
    <>
      <Cartao
        titulo="Meus pedidos"
        acao={
          <button type="button" onClick={() => irPara("pedidos")} className="cursor-pointer border-none bg-transparent p-0 text-[12px] font-semibold tracking-[0.14em] text-teal">
            VER TODOS →
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATUS.map(({ stage, label, Icon }) => {
            const n = orders?.filter((o) => stageOf(o.status) === stage).length ?? 0;
            return (
              <button
                key={stage}
                type="button"
                onClick={() => irPara("pedidos")}
                className="flex cursor-pointer flex-col items-center gap-2 border-none bg-transparent p-2 text-center"
              >
                <span className="relative grid h-[54px] w-[54px] place-items-center rounded-full bg-mist text-teal">
                  <Icon size={22} strokeWidth={1.6} />
                  {n > 0 && (
                    <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-teal px-1 text-[11px] font-bold text-white">{n}</span>
                  )}
                </span>
                <span className="text-[13px] font-medium text-text">{label}</span>
              </button>
            );
          })}
        </div>
      </Cartao>

      {andamento && <CartaoPedido order={andamento} />}

      {orders && orders.length === 0 && <SemPedidos />}
    </>
  );
}

// ─── Pedidos ────────────────────────────────────────────────────────────────

const FILTROS: { key: Stage | "todos"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "aguardando", label: "Aguardando pagamento" },
  { key: "preparacao", label: "Em preparação" },
  { key: "enviado", label: "A caminho" },
  { key: "entregue", label: "Entregues" },
];

function MeusPedidos({ orders }: { orders: Order[] | null }) {
  const [filtro, setFiltro] = useState<Stage | "todos">("todos");
  if (!orders) return <p className="m-0 text-[14px] text-muted">Carregando seus pedidos…</p>;
  if (orders.length === 0) return <SemPedidos />;

  const lista = filtro === "todos" ? orders : orders.filter((o) => stageOf(o.status) === filtro);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const n = f.key === "todos" ? orders.length : orders.filter((o) => stageOf(o.status) === f.key).length;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFiltro(f.key)}
              className={`cursor-pointer rounded-full border px-4 py-2 text-[13.5px] font-semibold ${
                filtro === f.key ? "border-teal bg-teal text-white" : "border-line bg-white text-text hover:border-teal"
              }`}
            >
              {f.label} · {n}
            </button>
          );
        })}
      </div>
      {lista.length === 0 ? (
        <div className="rounded-3xl border border-line bg-white px-6 py-12 text-center">
          <p className="m-0 font-serif text-[22px] text-teal-dark">Nenhum pedido aqui</p>
          <p className="m-0 mt-1 text-[14px] text-muted">Quando houver pedidos com esse status, eles aparecem aqui.</p>
        </div>
      ) : (
        lista.map((o) => <CartaoPedido key={o.id} order={o} />)
      )}
    </>
  );
}

function CartaoPedido({ order }: { order: Order }) {
  const stage = stageOf(order.status);
  const pecas = order.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAFCFC] px-6 py-4">
        <div className="grid">
          <span className="text-[15.5px] font-semibold text-text">Pedido #{order.number}</span>
          <span className="text-[13px] text-muted">{formatDate(order.created_at)}</span>
        </div>
        <span
          className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${
            stage === "enviado" ? "bg-teal text-white" : stage === "entregue" || stage === "encerrado" ? "bg-chip text-text-2" : "bg-mist text-teal"
          }`}
        >
          {STAGE_LABEL[stage]}
        </span>
      </div>
      <div className="grid gap-2 px-6 py-4">
        {order.items.map((i, k) => (
          <div key={k} className="flex justify-between gap-3 text-[14px]">
            <span className="text-text">
              {i.name}
              {i.size && <span className="text-muted"> · {i.size}</span>}
              {i.quantity > 1 && <span className="text-muted"> · {i.quantity} un.</span>}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
        <span className="text-[14px] text-muted">
          {pecas} {pecas === 1 ? "peça" : "peças"} · <strong className="text-text">{formatarBRL(order.total_cents)}</strong>
        </span>
        <div className="flex gap-2">
          <a href={supportURL(order.number)} className="rounded-full border-[1.5px] border-line-strong bg-white px-4 py-2 text-[13px] font-semibold text-teal hover:border-teal">
            Ajuda
          </a>
          <Link to={`/pedido/${order.id}`} className="flex items-center gap-1 rounded-full bg-teal px-4 py-2 text-[13px] font-semibold text-white hover:bg-teal-dark hover:text-white">
            {stage === "enviado" ? "Rastrear pedido" : "Ver detalhes"}
            <ChevronRight size={15} strokeWidth={2} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function SemPedidos() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-white px-6 py-14 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-mist-3 text-teal">
        <Package size={26} strokeWidth={1.5} />
      </span>
      <p className="m-0 font-serif text-[24px] text-teal-dark">Nenhum pedido ainda</p>
      <Link to="/categoria/colecoes/todos" className="rounded-full bg-teal px-6 py-3.5 text-[14px] font-semibold text-white hover:bg-teal-dark hover:text-white">
        Ver as queridinhas
      </Link>
    </div>
  );
}

// ─── Favoritos ──────────────────────────────────────────────────────────────

function Favoritos() {
  const [lista, setLista] = useState<Product[] | null>(null);
  const { ids } = useFavorites();

  // Recarrega quando o conjunto muda: desfavoritar no card some daqui também.
  const chave = [...ids].sort().join(",");
  useEffect(() => {
    listFavorites().then(setLista).catch(() => setLista([]));
  }, [chave]);

  if (!lista) return <p className="m-0 text-[14px] text-muted">Carregando…</p>;
  return (
    <Cartao titulo="Favoritos" acao={<span className="text-[13.5px] text-muted">{lista.length} {lista.length === 1 ? "peça salva" : "peças salvas"}</span>}>
      {lista.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-mist-3 text-teal">
            <Heart size={26} strokeWidth={1.5} />
          </span>
          <p className="m-0 font-serif text-[22px] text-teal-dark">Sua lista de desejos está vazia</p>
          <p className="m-0 text-[14px] text-muted">Toque no coração das peças que você amar para salvá-las aqui.</p>
          <Link to="/categoria/colecoes/todos" className="rounded-full bg-teal px-6 py-3 text-[14px] font-semibold text-white hover:bg-teal-dark hover:text-white">
            Ver as queridinhas
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-4">
          {lista.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </Cartao>
  );
}

// ─── Endereços ──────────────────────────────────────────────────────────────

const ENDERECO_VAZIO: NewAddress = {
  label: "Casa", recipient: "", zip_code: "", street: "", number: "", complement: "",
  neighborhood: "", city: "", state: "", primary: false,
};

function Enderecos({ addresses, setAddresses }: { addresses: Address[] | null; setAddresses: (a: Address[]) => void }) {
  const [form, setForm] = useState<NewAddress | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (!addresses) return <p className="m-0 text-[14px] text-muted">Carregando…</p>;

  async function recarregar() {
    setAddresses(await listAddresses());
  }

  async function remover(id: string) {
    setErro(null);
    try {
      await deleteAddress(id);
      await recarregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui excluir");
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setErro(null);
    setSalvando(true);
    try {
      await createAddress({ ...form, zip_code: onlyDigits(form.zip_code), primary: addresses!.length === 0 });
      await recarregar();
      setForm(null);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui salvar o endereço");
    } finally {
      setSalvando(false);
    }
  }

  async function buscarCep(cep: string) {
    if (!form) return;
    setForm({ ...form, zip_code: cep });
    if (onlyDigits(cep).length === 8) {
      const achado = await lookupZip(cep);
      if (achado) setForm((f) => (f ? { ...f, zip_code: cep, ...achado } : f));
    }
  }

  return (
    <Cartao titulo="Endereços">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {addresses.map((a) => (
          <div key={a.id} className={`grid gap-2 rounded-[22px] border-[1.5px] p-5 ${a.primary ? "border-teal" : "border-line"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[15px] font-semibold text-text">
                <MapPin size={16} strokeWidth={1.8} className="text-teal" />
                {a.label || "Endereço"}
              </span>
              {a.primary && <span className="rounded-full bg-teal px-2.5 py-1 text-[10.5px] font-bold tracking-[0.1em] text-white">PRINCIPAL</span>}
            </div>
            <span className="text-[14px] leading-relaxed text-text-2">
              {a.recipient}
              <br />
              {a.street}, {a.number}
              {a.complement && ` · ${a.complement}`}
              <br />
              {a.neighborhood} · {a.city}/{a.state} · CEP {formatZip(a.zip_code)}
            </span>
            <button
              type="button"
              onClick={() => void remover(a.id)}
              className="flex w-fit cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[13px] font-semibold text-muted hover:text-[#B4443C]"
            >
              <Trash2 size={14} strokeWidth={1.8} />
              Excluir
            </button>
          </div>
        ))}

        {!form && (
          <button
            type="button"
            onClick={() => setForm(ENDERECO_VAZIO)}
            className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-line-strong bg-transparent text-[14px] font-semibold text-teal hover:border-teal"
          >
            <Plus size={20} strokeWidth={2} />
            Adicionar endereço
          </button>
        )}
      </div>

      {form && (
        <form onSubmit={salvar} className="animate-fade-in mt-4 grid gap-3.5 rounded-[22px] bg-snow p-5 sm:grid-cols-2">
          <Campo label="Quem recebe" value={form.recipient} onChange={(v) => setForm({ ...form, recipient: v })} required className="sm:col-span-2" />
          <Campo label="CEP" value={formatZip(form.zip_code)} onChange={(v) => void buscarCep(v)} required />
          <Campo label="Apelido (casa, trabalho…)" value={form.label} onChange={(v) => setForm({ ...form, label: v })} />
          <Campo label="Rua" value={form.street} onChange={(v) => setForm({ ...form, street: v })} required className="sm:col-span-2" />
          <Campo label="Número" value={form.number} onChange={(v) => setForm({ ...form, number: v })} required />
          <Campo label="Complemento" value={form.complement} onChange={(v) => setForm({ ...form, complement: v })} />
          <Campo label="Bairro" value={form.neighborhood} onChange={(v) => setForm({ ...form, neighborhood: v })} required />
          <div className="grid grid-cols-[1fr_76px] gap-3">
            <Campo label="Cidade" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required />
            <Campo label="UF" value={form.state} onChange={(v) => setForm({ ...form, state: v.toUpperCase().slice(0, 2) })} required />
          </div>
          <div className="flex items-center gap-4 sm:col-span-2">
            <button type="submit" disabled={salvando} className="cursor-pointer rounded-full border-none bg-teal px-6 py-3 text-[14px] font-semibold text-white hover:bg-teal-dark disabled:opacity-50">
              {salvando ? "Salvando…" : "Salvar endereço"}
            </button>
            <button type="button" onClick={() => setForm(null)} className="cursor-pointer border-none bg-transparent p-0 text-[13.5px] font-semibold text-muted">
              Cancelar
            </button>
          </div>
        </form>
      )}
      {erro && <p className="m-0 mt-3 rounded-[14px] bg-[#FDECEC] px-3.5 py-2.5 text-[13.5px] text-[#B4443C]">{erro}</p>}
    </Cartao>
  );
}

// ─── Meus dados ─────────────────────────────────────────────────────────────

function MeusDados() {
  const { user, refresh } = useAuth();
  const [nome, setNome] = useState(user?.name ?? "");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [estado, setEstado] = useState<"idle" | "salvando" | "ok">("idle");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<{ name: string; phone?: string; cpf?: string }>("/auth/eu", { authenticated: true })
      .then((me) => {
        setNome(me.name ?? "");
        setTelefone(me.phone ?? "");
        setCpf(me.cpf ?? "");
      })
      .catch(() => {});
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEstado("salvando");
    try {
      await api("/auth/perfil", { method: "PUT", authenticated: true, body: { name: nome, phone: onlyDigits(telefone), cpf: onlyDigits(cpf) } });
      await refresh();
      setEstado("ok");
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui salvar");
      setEstado("idle");
    }
  }

  return (
    <Cartao titulo="Meus dados">
      <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nome completo" value={nome} onChange={setNome} required />
        <Campo label="E-mail" value={user?.email ?? ""} onChange={() => {}} disabled />
        <Campo label="Celular" value={telefone} onChange={setTelefone} inputMode="tel" />
        <Campo label="CPF" value={cpf} onChange={setCpf} inputMode="numeric" />
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <button type="submit" disabled={estado === "salvando"} className="cursor-pointer rounded-full border-none bg-teal px-6 py-3.5 text-[14px] font-semibold text-white hover:bg-teal-dark disabled:opacity-50">
            {estado === "salvando" ? "Salvando…" : "Salvar alterações"}
          </button>
          {estado === "ok" && <span className="text-[13.5px] font-semibold text-success">Dados atualizados ✓</span>}
        </div>
        {erro && <p className="m-0 rounded-[14px] bg-[#FDECEC] px-3.5 py-2.5 text-[13.5px] text-[#B4443C] sm:col-span-2">{erro}</p>}
        <p className="m-0 text-[12.5px] text-muted sm:col-span-2">
          Para trocar o e-mail ou a senha, escreva para {LOJA.email}.
        </p>
      </form>
    </Cartao>
  );
}

// ─── Trocas ─────────────────────────────────────────────────────────────────

function Trocas() {
  const politica = FAQ.find((f) => f.q.startsWith("Posso trocar"))?.a;
  const passos = [
    { t: "Fale com a gente", d: "Envie por e-mail o número do pedido e fotos da peça." },
    { t: "Envie a peça", d: "Mandamos as orientações de postagem para você." },
    { t: "Receba a solução", d: "Vale-troca ou reembolso, conforme o caso." },
  ];
  return (
    <Cartao titulo="Trocas e devoluções">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {passos.map((p, i) => (
          <div key={p.t} className="grid content-start gap-2 rounded-[22px] bg-fog p-5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-teal font-serif text-[16px] text-white">{i + 1}</span>
            <span className="text-[15px] font-semibold text-text">{p.t}</span>
            <span className="text-[13.5px] leading-relaxed text-muted">{p.d}</span>
          </div>
        ))}
      </div>
      {politica && <p className="m-0 mt-5 text-[14px] leading-[1.7] text-text-2">{politica}</p>}
      <a
        href={`mailto:${LOJA.email}?subject=${encodeURIComponent("Troca ou devolução")}`}
        className="mt-5 inline-flex rounded-full bg-teal px-6 py-3.5 text-[14px] font-semibold text-white hover:bg-teal-dark hover:text-white"
      >
        Solicitar troca por e-mail
      </a>
    </Cartao>
  );
}

function Campo({
  label, value, onChange, required, disabled, inputMode, className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
  inputMode?: "numeric" | "tel";
  className?: string;
}) {
  return (
    <label className={`grid min-w-0 gap-1.5 ${className}`}>
      <span className="text-[12.5px] font-semibold text-text-2">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        inputMode={inputMode}
        className="w-full min-w-0 rounded-[14px] border-[1.5px] border-line bg-white px-3.5 py-[13px] text-[14.5px] text-text outline-none focus:border-teal disabled:bg-fog disabled:text-muted"
      />
    </label>
  );
}
