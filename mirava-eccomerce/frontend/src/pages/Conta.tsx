// Minha conta (v5): topo próprio, faixa teal com a cliente e os números da
// conta, menu lateral e o conteúdo da aba ao lado. A aba vai na URL
// (?aba=pedidos), para o "Meus pedidos" do header cair direto nela.
//
// Pagamentos (cartão salvo) ficou de fora: o pagamento é no Mercado Pago
// (decisão 25), nenhum cartão passa por aqui.

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronRight, CreditCard, Gift, Heart, HelpCircle, Home as HomeIcon, LayoutGrid, LogOut, MapPin, Package,
  Copy, Plus, RefreshCw, Sparkles, Star, Ticket, Trash2, Truck, User, type LucideIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { formatarBRL } from "../lib/dinheiro";
import { LOJA } from "../config/loja";
import {
  STAGE_LABEL, formatDate, listOrders, stageOf, supportURL, type Order, type Stage,
} from "../lib/pedidos";
import {
  createAddress, deleteAddress, formatZip, listAddresses, lookupZip, onlyDigits,
  type Address, type NewAddress,
} from "../lib/enderecos";
import EntrarCadastro from "../components/EntrarCadastro";
import ProductCard from "../components/ProductCard";
import { useProducts } from "../catalogo/hooks";
import { listFavorites } from "../lib/favoritos";
import { useFavorites } from "../context/FavoritesContext";
import type { Product } from "../catalogo/tipos";
import { imageUrl } from "../catalogo/consultas";
import {
  RETURN_STAGES, clubStatus, createReturn, createReview, forgotPassword, myCoupons, myReturns, reviewables,
  type ClubStatus, type MyCoupon, type ReturnRequest, type Reviewable,
} from "../lib/extras";

type Aba = "geral" | "pedidos" | "favoritos" | "cupons" | "clube" | "avaliar" | "enderecos" | "dados" | "trocas";

const ABAS: { key: Aba; label: string; Icon: LucideIcon }[] = [
  { key: "geral", label: "Visão geral", Icon: LayoutGrid },
  { key: "pedidos", label: "Meus pedidos", Icon: Package },
  { key: "favoritos", label: "Favoritos", Icon: Heart },
  { key: "cupons", label: "Meus cupons", Icon: Ticket },
  { key: "clube", label: "Mirava Club", Icon: Sparkles },
  { key: "avaliar", label: "Avaliar compras", Icon: Star },
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
  const [club, setClub] = useState<ClubStatus | null>(null);
  const [desde, setDesde] = useState("");

  useEffect(() => {
    if (!user) return;
    listOrders().then(setOrders).catch(() => setOrders([]));
    listAddresses().then(setAddresses).catch(() => setAddresses([]));
    clubStatus().then(setClub).catch(() => {});
    api<{ created_at?: string }>("/auth/eu", { authenticated: true })
      .then((me) => setDesde(me.created_at?.slice(0, 4) ?? ""))
      .catch(() => {});
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
              <span className="text-[14px] text-[#BFE3DF]">
                {user.email}
                {desde && ` · cliente desde ${desde}`}
              </span>
              {club && (
                <button type="button" onClick={() => irPara("clube")} className="mt-1 flex w-fit cursor-pointer items-center gap-2 rounded-full border-none bg-white/12 px-3 py-1 text-[11px] font-bold tracking-[0.14em] text-white">
                  <Sparkles size={12} /> NÍVEL {NIVEL[club.level].toUpperCase()} · {club.balance} PONTOS
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Numero label="PEDIDOS" valor={orders?.length} onClick={() => irPara("pedidos")} />
            <Numero label="PONTOS" valor={club?.balance} onClick={() => irPara("clube")} />
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
            {aba === "cupons" && <MeusCupons />}
            {aba === "clube" && <Clube />}
            {aba === "avaliar" && <Avaliar />}
            {aba === "trocas" && <Trocas orders={orders} />}
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

      <EscolhidasPraVoce />
    </>
  );
}

/** "Escolhidas pra você" (v5): as mais vendidas da loja, sem as que ela já
 *  favoritou — sugestão honesta, sem fingir personalização que não existe. */
function EscolhidasPraVoce() {
  const { data } = useProducts({ bestSellers: true, limit: 12 });
  const { isFavorite } = useFavorites();
  const pecas = data.filter((p) => p.available && !isFavorite(p.id)).slice(0, 4);
  if (pecas.length === 0) return null;
  return (
    <Cartao titulo="Escolhidas pra você">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {pecas.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </Cartao>
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
  const [nascimento, setNascimento] = useState("");
  const [novidades, setNovidades] = useState(true);
  const [linkSenha, setLinkSenha] = useState<string | null>(null);
  const [estado, setEstado] = useState<"idle" | "salvando" | "ok">("idle");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<{ name: string; phone?: string; cpf?: string; birth_date?: string; accepts_email?: boolean }>("/auth/eu", { authenticated: true })
      .then((me) => {
        setNome(me.name ?? "");
        setTelefone(me.phone ?? "");
        setCpf(me.cpf ?? "");
        setNascimento(me.birth_date ?? "");
        setNovidades(me.accepts_email ?? true);
      })
      .catch(() => {});
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEstado("salvando");
    try {
      await api("/auth/perfil", { method: "PUT", authenticated: true, body: { name: nome, phone: onlyDigits(telefone), cpf: onlyDigits(cpf), birth_date: nascimento, accepts_email: novidades } });
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
        <label className="grid min-w-0 gap-1.5">
          <span className="text-[12.5px] font-semibold text-text-2">Data de nascimento</span>
          <input
            type="date"
            value={nascimento}
            onChange={(e) => setNascimento(e.target.value)}
            className="w-full min-w-0 rounded-[14px] border-[1.5px] border-line bg-white px-3.5 py-[12px] text-[14.5px] text-text outline-none focus:border-teal"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 self-end pb-3 text-[14px] text-text-2">
          <input type="checkbox" checked={novidades} onChange={(e) => setNovidades(e.target.checked)} className="h-4 w-4 accent-teal" />
          Quero receber novidades e cupons por e-mail
        </label>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <button type="submit" disabled={estado === "salvando"} className="cursor-pointer rounded-full border-none bg-teal px-6 py-3.5 text-[14px] font-semibold text-white hover:bg-teal-dark disabled:opacity-50">
            {estado === "salvando" ? "Salvando…" : "Salvar alterações"}
          </button>
          {estado === "ok" && <span className="text-[13.5px] font-semibold text-success">Dados atualizados ✓</span>}
        </div>
        {erro && <p className="m-0 rounded-[14px] bg-[#FDECEC] px-3.5 py-2.5 text-[13.5px] text-[#B4443C] sm:col-span-2">{erro}</p>}
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4 sm:col-span-2">
          <span className="text-[14px] font-semibold text-text">Senha</span>
          <button
            type="button"
            onClick={() => {
              if (user?.email) void forgotPassword(user.email).then((r) => setLinkSenha(r.nota)).catch(() => setLinkSenha("Não consegui mandar o link agora."));
            }}
            className="cursor-pointer rounded-full border-[1.5px] border-line bg-white px-4 py-2 text-[13px] font-semibold text-teal hover:border-teal"
          >
            Mandar link para trocar a senha
          </button>
          {linkSenha && <span className="text-[13px] text-text-2">{linkSenha}</span>}
        </div>
        <p className="m-0 text-[12.5px] text-muted sm:col-span-2">Para trocar o e-mail da conta, escreva para {LOJA.email}.</p>
      </form>
    </Cartao>
  );
}

// ─── Trocas ─────────────────────────────────────────────────────────────────

const TEXTAREA =
  "w-full resize-none rounded-[14px] border-[1.5px] border-line bg-white px-3.5 py-3 text-[14px] text-text outline-none focus:border-teal";

const MS_DIA = 86_400_000;

function Trocas({ orders }: { orders: Order[] | null }) {
  const [list, setList] = useState<ReturnRequest[] | null>(null);
  const [orderId, setOrderId] = useState("");
  const [kind, setKind] = useState<"troca" | "reembolso">("troca");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recarregar = () => myReturns().then(setList).catch(() => setList([]));
  useEffect(() => {
    void recarregar();
  }, []);

  // Só pedidos entregues há até 7 dias e sem troca aberta. O servidor confere
  // de novo — aqui é só para não oferecer o que vai ser recusado.
  const abertas = new Set((list ?? []).filter((r) => r.stage !== "done" && r.stage !== "rejected").map((r) => r.order_id));
  const elegiveis = (orders ?? []).filter(
    (o) => o.status === "delivered" && o.delivered_at && Date.now() - new Date(o.delivered_at).getTime() <= 7 * MS_DIA && !abertas.has(o.id),
  );

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await createReturn(orderId, kind, reason.trim());
      setOrderId("");
      setReason("");
      await recarregar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não consegui registrar o pedido de troca");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {list && list.length > 0 && (
        <Cartao titulo="Minhas solicitações">
          <div className="grid gap-3">
            {list.map((r) => (
              <EtapasTroca key={r.id} r={r} />
            ))}
          </div>
        </Cartao>
      )}

      <Cartao titulo="Pedir troca ou devolução">
        <p className="m-0 mb-4 text-[14px] leading-[1.7] text-text-2">
          Você tem 7 dias corridos depois de receber a peça para pedir troca ou devolução, como manda o Código de Defesa
          do Consumidor. Depois que a gente aprovar, mandamos as orientações de postagem por e-mail.
        </p>
        {elegiveis.length === 0 ? (
          <p className="m-0 rounded-[18px] bg-fog px-4 py-3.5 text-[14px] text-muted">
            Nenhum pedido entregue nos últimos 7 dias. Precisa de ajuda com outro pedido?{" "}
            <a href={`mailto:${LOJA.email}?subject=${encodeURIComponent("Troca ou devolução")}`} className="font-semibold text-teal underline">
              Fale com a gente
            </a>
            .
          </p>
        ) : (
          <form onSubmit={enviar} className="grid gap-3.5">
            <label className="grid gap-1.5">
              <span className="text-[12.5px] font-semibold text-text-2">Pedido</span>
              <select
                required
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="rounded-[14px] border-[1.5px] border-line bg-white px-3.5 py-[13px] text-[14.5px] text-text outline-none focus:border-teal"
              >
                <option value="">Escolha o pedido</option>
                {elegiveis.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.number} · {o.items.map((i) => i.name).join(", ")}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              {(["troca", "reembolso"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`cursor-pointer rounded-full border-[1.5px] px-5 py-2.5 text-[13.5px] font-semibold ${
                    kind === k ? "border-teal bg-teal text-white" : "border-line bg-white text-text hover:border-teal"
                  }`}
                >
                  {k === "troca" ? "Quero trocar" : "Quero devolver"}
                </button>
              ))}
            </div>
            <label className="grid gap-1.5">
              <span className="text-[12.5px] font-semibold text-text-2">O que aconteceu?</span>
              <textarea required minLength={5} maxLength={1000} rows={4} value={reason} onChange={(e) => setReason(e.target.value)} className={TEXTAREA} />
            </label>
            {error && <span className="text-[13px] text-[#B4443C]">{error}</span>}
            <button
              type="submit"
              disabled={sending}
              className="w-fit cursor-pointer rounded-full border-none bg-teal px-6 py-3.5 text-[14px] font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
            >
              {sending ? "Enviando…" : "Enviar solicitação"}
            </button>
          </form>
        )}
      </Cartao>
    </>
  );
}

function EtapasTroca({ r }: { r: ReturnRequest }) {
  const recusada = r.stage === "rejected";
  const atual = RETURN_STAGES.findIndex((s) => s.key === r.stage);
  return (
    <div className="rounded-[22px] border border-line p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[15px] font-semibold text-text">
          Pedido #{r.order_number} · {r.kind === "troca" ? "Troca" : "Devolução"}
        </span>
        <span className="text-[12.5px] text-muted">{formatDate(r.created_at)}</span>
      </div>
      {r.items_summary && <p className="m-0 mt-1 text-[13px] text-muted">{r.items_summary}</p>}
      {recusada ? (
        <p className="m-0 mt-3 rounded-[14px] bg-[#FDECEC] px-3.5 py-2.5 text-[13px] text-[#B4443C]">Solicitação não aprovada.</p>
      ) : (
        <ol className="m-0 mt-4 grid list-none grid-cols-4 gap-1.5 p-0">
          {RETURN_STAGES.map((s, i) => (
            <li key={s.key} className="grid gap-1.5">
              <span className={`h-1.5 rounded-full ${i <= atual ? "bg-teal" : "bg-line"}`} />
              <span className={`text-[11.5px] leading-tight ${i === atual ? "font-semibold text-teal" : "text-muted"}`}>{s.label}</span>
            </li>
          ))}
        </ol>
      )}
      {r.admin_note && <p className="m-0 mt-3 text-[13.5px] leading-relaxed text-text-2">{r.admin_note}</p>}
    </div>
  );
}

// ─── Meus cupons ─────────────────────────────────────────────────────────────

function MeusCupons() {
  const [list, setList] = useState<MyCoupon[] | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  useEffect(() => {
    myCoupons().then(setList).catch(() => setList([]));
  }, []);
  return (
    <Cartao titulo="Meus cupons">
      {list === null ? (
        <p className="m-0 text-[14px] text-muted">Carregando…</p>
      ) : list.length === 0 ? (
        <p className="m-0 rounded-[18px] bg-fog px-4 py-3.5 text-[14px] text-muted">Nenhum cupom disponível agora. Os cupons novos aparecem aqui.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((c) => (
            <div key={c.code} className={`grid gap-2 rounded-[22px] border-[1.5px] border-dashed p-5 ${c.usable ? "border-teal bg-[#F1F8F7]" : "border-line bg-fog opacity-70"}`}>
              <span className="font-serif text-[26px] leading-none text-teal-dark">
                {c.kind === "percent" ? `${c.value}% off` : `${formatarBRL(c.value)} off`}
              </span>
              <span className="text-[13px] text-text-2">
                {c.description ?? "Nas peças da compra."}
                {c.min_subtotal_cents > 0 && ` Mínimo de ${formatarBRL(c.min_subtotal_cents)} em peças.`}
                {c.ends_at && ` Vale até ${new Date(c.ends_at).toLocaleDateString("pt-BR")}.`}
              </span>
              {c.usable ? (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(c.code);
                    setCopiado(c.code);
                  }}
                  className="flex w-fit cursor-pointer items-center gap-2 rounded-full border-none bg-white px-4 py-2 font-mono text-[14px] font-bold tracking-[0.1em] text-teal-dark"
                >
                  {c.code} <Copy size={14} /> {copiado === c.code && <span className="font-sans text-[12px] font-semibold tracking-normal text-teal">copiado</span>}
                </button>
              ) : (
                <span className="text-[12.5px] font-semibold text-muted">{c.reason}</span>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="m-0 mt-4 text-[12.5px] text-muted">Um cupom por pedido; cupom e pontos do Mirava Club não somam no mesmo pedido.</p>
    </Cartao>
  );
}

// ─── Mirava Club ────────────────────────────────────────────────────────────

const NIVEL: Record<ClubStatus["level"], string> = { brilho: "Brilho", encanto: "Encanto", joia_rara: "Joia Rara" };

function Clube() {
  const [club, setClub] = useState<ClubStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    clubStatus()
      .then(setClub)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Não consegui carregar seus pontos"));
  }, []);

  if (error) return <Cartao titulo="Mirava Club"><p className="m-0 text-[14px] text-[#B4443C]">{error}</p></Cartao>;
  if (!club) return <Cartao titulo="Mirava Club"><p className="m-0 text-[14px] text-muted">Carregando…</p></Cartao>;

  const progresso = club.next_level_at > 0 ? Math.min(100, (club.earned / club.next_level_at) * 100) : 100;
  return (
    <>
      <section className="rounded-3xl bg-teal-dark p-7 text-white">
        <span className="text-[11px] font-semibold tracking-[0.18em] text-teal-pale">MIRAVA CLUB · NÍVEL {NIVEL[club.level].toUpperCase()}</span>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="font-serif text-[48px] leading-none">{club.balance}</span>
            <span className="ml-2 text-[14px] text-teal-pale">pontos</span>
          </div>
          <span className="text-[14px] text-teal-pale">
            valem <strong className="text-white">{formatarBRL(club.balance_value)}</strong> de desconto
          </span>
        </div>
        {club.next_level_at > 0 && (
          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-white" style={{ width: `${progresso}%` }} />
            </div>
            <span className="mt-2 block text-[12.5px] text-teal-pale">
              Faltam {club.next_level_at - club.earned} pontos para o próximo nível
            </span>
          </div>
        )}
      </section>

      <Cartao titulo="Como funciona">
        <ul className="m-0 grid gap-2.5 pl-5 text-[14px] leading-[1.7] text-text-2">
          <li>Cada R$ 1 em peças vira 1 ponto, creditado quando o pedido é entregue.</li>
          <li>
            Cada {club.points_per_block} pontos valem {formatarBRL(club.cents_per_block)} de desconto nas peças — é só marcar
            "usar meus pontos" no checkout.
          </li>
          <li>Pontos e cupom não se somam no mesmo pedido, e o desconto vai até 30% do valor das peças.</li>
          <li>Se um pedido em que você usou pontos for cancelado, os pontos voltam para você.</li>
        </ul>
      </Cartao>

      <Cartao titulo="Extrato">
        {club.statement.length === 0 ? (
          <p className="m-0 text-[14px] text-muted">Seus pontos aparecem aqui depois da primeira compra entregue.</p>
        ) : (
          <div className="grid divide-y divide-line">
            {club.statement.map((l) => (
              <div key={l.order_id} className="flex items-center justify-between gap-3 py-3 text-[14px]">
                <span className="text-text">
                  Pedido #{l.order_number}
                  <span className="ml-2 text-[12.5px] text-muted">{formatDate(l.date)}</span>
                </span>
                <span className="flex gap-3">
                  {l.earned > 0 && <span className="font-semibold text-teal">+{l.earned}</span>}
                  {l.used > 0 && <span className="font-semibold text-text-2">−{l.used}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </Cartao>
    </>
  );
}

// ─── Avaliar compras ────────────────────────────────────────────────────────

function Avaliar() {
  const [list, setList] = useState<Reviewable[] | null>(null);
  const [enviadas, setEnviadas] = useState<Set<string>>(new Set());
  useEffect(() => {
    reviewables().then(setList).catch(() => setList([]));
  }, []);

  const pendentes = (list ?? []).filter((r) => !enviadas.has(r.product_id));
  return (
    <Cartao titulo="Avaliar compras">
      <p className="m-0 mb-5 text-[14px] leading-[1.7] text-text-2">
        Conte como ficou a peça. A avaliação aparece na página do produto depois que a gente der uma olhada, só com o
        seu primeiro nome e a inicial do sobrenome.
      </p>
      {list === null ? (
        <p className="m-0 text-[14px] text-muted">Carregando…</p>
      ) : pendentes.length === 0 ? (
        <p className="m-0 rounded-[18px] bg-fog px-4 py-3.5 text-[14px] text-muted">
          {enviadas.size > 0 ? "Obrigada! Recebemos sua avaliação." : "Nenhuma peça para avaliar agora. Elas aparecem aqui quando o pedido é entregue."}
        </p>
      ) : (
        <div className="grid gap-3">
          {pendentes.map((r) => (
            <FormAvaliacao key={r.product_id} r={r} onDone={() => setEnviadas((s) => new Set(s).add(r.product_id))} />
          ))}
        </div>
      )}
    </Cartao>
  );
}

function FormAvaliacao({ r, onDone }: { r: Reviewable; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const img = imageUrl(r.image ?? undefined);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Escolha de 1 a 5 estrelas.");
      return;
    }
    setError(null);
    setSending(true);
    try {
      await createReview(r.product_id, rating, text.trim());
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não consegui enviar a avaliação");
      setSending(false);
    }
  }

  return (
    <form onSubmit={enviar} className="grid gap-3 rounded-[22px] border border-line p-5">
      <div className="flex items-center gap-3">
        {img ? <img src={img} alt="" className="h-14 w-14 rounded-[14px] bg-mist-3 object-cover" /> : <span className="h-14 w-14 rounded-[14px] bg-mist-3" />}
        <span className="min-w-0 flex-1">
          <Link to={`/produto/${r.slug}`} className="block truncate text-[15px] font-semibold text-text hover:text-teal">
            {r.name}
          </Link>
          <span className="text-[12.5px] text-muted">Pedido #{r.order_number}</span>
        </span>
      </div>
      <div className="flex gap-1" role="radiogroup" aria-label="Nota">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)}
            className="cursor-pointer border-none bg-transparent p-0.5 text-teal"
          >
            <Star size={24} strokeWidth={1.5} fill={n <= rating ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
      <textarea rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Como ficou? (opcional)" className={TEXTAREA} />
      {error && <span className="text-[13px] text-[#B4443C]">{error}</span>}
      <button
        type="submit"
        disabled={sending}
        className="w-fit cursor-pointer rounded-full border-none bg-teal px-6 py-3 text-[14px] font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
      >
        {sending ? "Enviando…" : "Enviar avaliação"}
      </button>
    </form>
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
