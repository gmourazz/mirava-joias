// Painel de gestão (design v5 — Mirava Admin.dc.html, decisão 19).
//
// Layout: sidebar teal-escura com o selo MASTER, topbar com a seção atual e o
// conteúdo ao lado. Só aparecem as seções que já funcionam de verdade; as
// outras do protótipo (marketing, cupons, automações, vitrine, banners…)
// dependem de regra nova — ver PLANO.md, seção 15.
//
// Esconder o painel aqui é usabilidade, não segurança: quem barra é o
// middleware requireAdmin na API.

import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Activity, Bell, Box, ExternalLink, LayoutGrid, Lock, LogOut, Menu, RefreshCw, Repeat, Search, Settings, ShoppingBag, Ticket, Users, Wallet, X, Sparkles, Zap, Megaphone, Image, type LucideIcon, Layers } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { adminApi, type Summary } from "./api";
import VisaoGeral from "./VisaoGeral";
import Pedidos from "./Pedidos";
import Produtos from "./Produtos";
import Financeiro from "./Financeiro";
import Sincronizacao from "./Sincronizacao";
import Clientes from "./Clientes";
import Atividades from "./Atividades";
import Configuracoes from "./Configuracoes";
import Cupons from "./Cupons";
import Marketing from "./Marketing";
import Conteudo from "./Conteudo";
import Colecoes from "./Colecoes";
import Trocas from "./Trocas";
import Vitrine from "./Vitrine";
import Automacoes from "./Automacoes";

// Ordem do design v5. "despacho" = o que o papel de despacho vê (decisão 27).
const NAV: { to: string; label: string; Icon: LucideIcon; despacho?: boolean }[] = [
  { to: "/admin", label: "Visão geral", Icon: LayoutGrid },
  { to: "/admin/produtos", label: "Produtos", Icon: Box },
  { to: "/admin/vitrine", label: "Vitrine da loja", Icon: Sparkles },
  { to: "/admin/colecoes", label: "Coleções", Icon: Layers },
  { to: "/admin/sincronizacao", label: "Sincronização", Icon: RefreshCw },
  { to: "/admin/automacoes", label: "Automações", Icon: Zap },
  { to: "/admin/pedidos", label: "Pedidos", Icon: ShoppingBag, despacho: true },
  { to: "/admin/financeiro", label: "Financeiro", Icon: Wallet },
  { to: "/admin/trocas", label: "Trocas e devoluções", Icon: Repeat },
  { to: "/admin/marketing", label: "Marketing", Icon: Megaphone },
  { to: "/admin/clientes", label: "Clientes", Icon: Users },
  { to: "/admin/cupons", label: "Cupons", Icon: Ticket },
  { to: "/admin/conteudo", label: "Banners e avisos", Icon: Image },
  { to: "/admin/configuracoes", label: "Configurações", Icon: Settings },
  { to: "/admin/atividades", label: "Atividades", Icon: Activity },
];

type Papel = "master" | "dispatch";

export default function AdminApp() {
  const { user, loading } = useAuth();
  const [acesso, setAcesso] = useState<"verificando" | "ok" | "negado" | "erro">("verificando");
  const [papel, setPapel] = useState<Papel>("master");

  useEffect(() => {
    if (!user) return;
    adminApi
      .me()
      .then((r) => {
        setPapel(r.role ?? "master");
        setAcesso("ok");
      })
      .catch((e) => setAcesso(e instanceof ApiError && e.status === 403 ? "negado" : "erro"));
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/conta?voltar=/admin" replace />;
  if (acesso === "verificando") return <div className="min-h-screen bg-fog" />;
  if (acesso !== "ok") return <SemAcesso erro={acesso === "erro"} />;

  return (
    <Moldura papel={papel}>
      {papel === "dispatch" ? (
        <Routes>
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="*" element={<Navigate to="/admin/pedidos" replace />} />
        </Routes>
      ) : (
      <Routes>
        <Route index element={<VisaoGeral />} />
        <Route path="pedidos" element={<Pedidos />} />
        <Route path="produtos" element={<Produtos />} />
        <Route path="sincronizacao" element={<Sincronizacao />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="trocas" element={<Trocas />} />
        <Route path="vitrine" element={<Vitrine />} />
        <Route path="colecoes" element={<Colecoes />} />
        <Route path="cupons" element={<Cupons />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="conteudo" element={<Conteudo />} />
        <Route path="avaliacoes" element={<Navigate to="/admin/marketing?aba=avaliacoes" replace />} />
        <Route path="automacoes" element={<Automacoes />} />
        <Route path="atividades" element={<Atividades />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
      )}
    </Moldura>
  );
}

function Moldura({ children, papel }: { children: ReactNode; papel: Papel }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  const nav = papel === "dispatch" ? NAV.filter((n) => n.despacho) : NAV;
  const atual = nav.find((n) => (n.to === "/admin" ? pathname === "/admin" : pathname.startsWith(n.to))) ?? nav[0];

  useEffect(() => setMenuAberto(false), [pathname]);

  const sidebar = (
    <aside className="flex h-full flex-col gap-[22px] bg-teal-dark px-3.5 py-[22px] text-[#D9ECEA]">
      <div className="grid gap-2 px-2">
        <span className="font-logo text-[24px] leading-none tracking-[0.28em] text-white">MIRAVA</span>
        <span className="w-fit rounded-full bg-teal px-2.5 py-1 text-[10px] font-bold tracking-[0.18em] text-teal-pale">{papel === "dispatch" ? "DESPACHO" : "ADMIN MASTER"}</span>
      </div>
      <nav className="grid gap-1">
        {nav.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/admin"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-[11px] text-[14px] transition-colors ${
                isActive ? "bg-teal font-semibold text-white hover:text-white" : "text-[#D9ECEA] hover:bg-white/8 hover:text-white"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={1.7} className={isActive ? "text-white" : "text-teal-pale"} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto grid gap-2">
        <Link to="/" target="_blank" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13.5px] text-[#D9ECEA] hover:bg-white/8 hover:text-white">
          <ExternalLink size={16} strokeWidth={1.7} />
          Ver loja
        </Link>
        <button
          type="button"
          onClick={logout}
          className="flex cursor-pointer items-center gap-2 rounded-xl border-none bg-transparent px-3 py-2.5 text-left text-[13.5px] text-[#D9ECEA] hover:bg-white/8"
        >
          <LogOut size={16} strokeWidth={1.7} />
          Sair
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-fog font-sans text-[14px] text-text lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      <div className="sticky top-0 hidden h-screen lg:block">{sidebar}</div>
      {menuAberto && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-teal-dark/40" onClick={() => setMenuAberto(false)} />
          <div className="animate-fade-in absolute inset-y-0 left-0 w-[260px]">{sidebar}</div>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-fog/92 px-[clamp(14px,2.5vw,32px)] py-3.5 backdrop-blur-[10px]">
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setMenuAberto((v) => !v)}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl border-none bg-white text-teal-dark lg:hidden"
          >
            {menuAberto ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="grid">
            <span className="text-[12px] text-muted">Admin / {atual.label}</span>
            <span className="font-serif text-[clamp(20px,2vw,26px)] leading-tight text-teal-dark">{atual.label}</span>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <BuscaTopo />
            <Sino />
            <span className="grid h-10 w-10 place-items-center rounded-full bg-teal font-logo text-[14px] text-white">
              {(user?.name ?? "A").slice(0, 2).toUpperCase()}
            </span>
            <span className="hidden text-[13px] leading-tight sm:grid">
              <strong className="text-text">{user?.name}</strong>
              <span className="text-muted">Master</span>
            </span>
          </div>
        </header>
        <main key={atual.to} className="animate-pop grid gap-[18px] px-[clamp(16px,2.5vw,32px)] pt-6 pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}

// Busca do topo: número de pedido vai para Pedidos; o resto procura peça em
// Produtos (nome ou SKU).
function BuscaTopo() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = q.trim();
        if (!t) return;
        navigate(/^#?\d+$/.test(t) ? `/admin/pedidos?busca=${encodeURIComponent(t.replace("#", ""))}` : `/admin/produtos?busca=${encodeURIComponent(t)}`);
        setQ("");
      }}
      className="hidden items-center gap-2 rounded-full border-[1.5px] border-line bg-white px-3.5 py-2 md:flex"
    >
      <Search size={15} strokeWidth={1.8} className="text-teal" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar peça, SKU, pedido…"
        className="w-[min(220px,22vw)] border-none bg-transparent text-[13.5px] outline-none"
      />
    </form>
  );
}

// Sino: os mesmos pendentes da visão geral, num menu suspenso.
function Sino() {
  const [aberto, setAberto] = useState(false);
  const [resumo, setResumo] = useState<Summary | null>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    adminApi.summary().then(setResumo).catch(() => {});
  }, [pathname]);

  const st = resumo?.by_status ?? {};
  const avisos = resumo
    ? [
        { n: resumo.late, t: "pedido(s) atrasado(s)", to: "/admin/pedidos?prazo=atrasados" },
        { n: resumo.near_deadline, t: "pedido(s) perto do prazo de 20 dias", to: "/admin/pedidos?prazo=perto" },
        { n: (st.paid ?? 0) + (st.in_batch ?? 0), t: "pedido(s) pago(s) para comprar na Lilly", to: "/admin/pedidos?etapa=comprar" },
        { n: st.received_by_owner ?? 0, t: "pedido(s) prontos para despachar", to: "/admin/pedidos?etapa=despachar" },
        { n: st.out_of_stock ?? 0, t: "pedido(s) sem estoque na Lilly", to: "/admin/pedidos?etapa=problema" },
        { n: resumo.price_alerts, t: "alerta(s) de preço da Lilly", to: "/admin/produtos?status=alerta" },
      ].filter((a) => a.n > 0)
    : [];

  return (
    <div className="relative" onMouseLeave={() => setAberto(false)}>
      <button
        type="button"
        aria-label="Notificações"
        onClick={() => setAberto((v) => !v)}
        className="relative grid h-10 w-10 cursor-pointer place-items-center rounded-full border-none bg-white text-teal-dark"
      >
        <Bell size={18} strokeWidth={1.8} />
        {avisos.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#D4574B] px-1 text-[10px] font-bold text-white">
            {avisos.length}
          </span>
        )}
      </button>
      {aberto && (
        <div className="absolute top-full right-0 z-30 pt-2">
          <div className="animate-drop grid w-[min(340px,86vw)] rounded-[20px] border border-line bg-white p-2 shadow-[0_24px_60px_rgba(11,74,77,0.18)]">
            <span className="px-3 py-2 text-[13px] font-semibold text-text">Notificações · {avisos.length} {avisos.length === 1 ? "nova" : "novas"}</span>
            {avisos.length === 0 ? (
              <span className="px-3 pb-3 text-[13px] text-muted">Tudo em dia ✦</span>
            ) : (
              avisos.map((a) => (
                <Link key={a.to} to={a.to} onClick={() => setAberto(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] text-text hover:bg-mist hover:text-text">
                  <span className="font-serif text-[20px] leading-none text-teal-dark">{a.n}</span>
                  {a.t}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SemAcesso({ erro }: { erro: boolean }) {
  const { logout } = useAuth();
  return (
    <div className="grid min-h-screen place-items-center bg-fog px-6">
      <div className="grid max-w-md justify-items-center gap-4 rounded-3xl border border-line bg-white p-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-mist text-teal">
          <Lock size={24} strokeWidth={1.7} />
        </span>
        <h1 className="m-0 font-serif text-[28px] font-normal text-teal-dark">
          {erro ? "Não consegui abrir o painel" : "Acesso restrito"}
        </h1>
        <p className="m-0 text-[14.5px] leading-relaxed text-text-2">
          {erro
            ? "O servidor não respondeu. Confira se a API está no ar e tente de novo."
            : "Esta área é só da administração da loja. Entre com a conta de administradora."}
        </p>
        <div className="flex gap-3">
          <Link to="/" className="rounded-full border-[1.5px] border-line-strong px-5 py-3 text-[14px] font-semibold text-teal">
            Voltar para a loja
          </Link>
          {!erro && (
            <button type="button" onClick={logout} className="cursor-pointer rounded-full border-none bg-teal px-5 py-3 text-[14px] font-semibold text-white">
              Trocar de conta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
