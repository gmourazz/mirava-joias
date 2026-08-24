// Casca do painel administrativo — sidebar + conteúdo, SEM a casca da loja
// (Header, AnnouncementBar, Newsletter, Footer, CartDrawer). É uma ferramenta
// interna, não uma página de vitrine, e não faz sentido a dona ver banner de
// cupom ou "adicionar à sacola" enquanto está conferindo receita do mês.
//
// Acesso restrito aqui, uma vez só — as páginas filhas (Outlet) não repetem
// essa checagem. Login exigido; depois disso, `admins.role` decide o resto
// (ver protegidoPorAdmin/protegidoPorSystem no Go, que são a proteção real).

import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Lock, LogIn, LogOut, Package, ShoppingBag, Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Monogram from "./Monogram";

const NAV = [
  { to: "/admin", label: "Visão geral", icon: LayoutDashboard, end: true },
  { to: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag, end: false },
  { to: "/admin/produtos", label: "Produtos", icon: Package, end: false },
];

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) return null;

  if (!user) {
    return (
      <CentralMessage
        icon={LogIn}
        title="Painel da Mirava"
        text="Entre com sua conta para continuar."
        ctaLabel="Entrar"
        ctaTo="/conta"
        ctaState={{ from: location.pathname }}
      />
    );
  }

  if (!user.is_admin) {
    return (
      <CentralMessage
        icon={Lock}
        title="Acesso restrito"
        text="Esta área é só para a administração da loja."
      />
    );
  }

  const items = [...NAV];
  if (user.admin_role === "system") {
    items.push({ to: "/admin/administradores", label: "Administradores", icon: Users, end: false });
  }

  return (
    <div className="flex min-h-screen bg-[#FBF6F8] font-sans text-ink">
      <aside className="flex w-64 shrink-0 flex-col bg-white shadow-[2px_0_16px_-6px_rgba(92,42,70,0.12)]">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex cursor-pointer items-center gap-3 border-none border-b border-blush bg-none px-6 py-6 text-left"
        >
          <Monogram className="h-7 w-9 shrink-0" color="#8E3B6B" />
          <span className="flex flex-col">
            <span className="font-script text-[22px] leading-none text-wine-dark">Mirava</span>
            <span className="mt-1 text-[9px] tracking-[0.16em] text-mauve uppercase">
              Painel administrativo
            </span>
          </span>
        </button>

        <nav className="flex flex-1 flex-col gap-1 px-3 pt-5">
          {items.map((item) => {
            const active = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-[12px] px-3.5 py-2.5 text-[13.5px] transition-colors ${
                  active
                    ? "bg-[linear-gradient(135deg,#d46a9f_0%,#8e3b6b_100%)] text-white shadow-[0_6px_16px_-4px_rgba(142,59,107,0.5)]"
                    : "text-ink-soft hover:bg-cream"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 border-t border-blush px-5 py-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush font-serif text-[12.5px] text-wine-dark">
            {iniciais(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-[12.5px] text-ink">{user.name}</p>
            <p className="m-0 text-[10.5px] text-mauve">
              {user.admin_role === "system" ? "Master" : "Admin"}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Sair"
            className="flex shrink-0 cursor-pointer items-center border-none bg-none p-1.5 text-mauve hover:text-wine-dark"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

function CentralMessage({
  icon: Icon, title, text, ctaLabel, ctaTo, ctaState,
}: {
  icon: typeof LogIn; title: string; text: string; ctaLabel?: string; ctaTo?: string;
  ctaState?: { from: string };
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#5c2a46_0%,#8e3b6b_100%)] px-4">
      <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/[0.06]" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-white/[0.05]" />
      <div className="pointer-events-none absolute right-24 bottom-10 h-32 w-32 rounded-full bg-white/[0.04]" />

      <div className="animate-rise relative w-full max-w-sm rounded-[24px] bg-white p-9 text-center shadow-[0_30px_60px_-20px_rgba(30,10,20,0.55)]">
        <Monogram className="mx-auto h-8 w-11" color="#D46A9F" />
        <span className="mt-4 flex h-11 w-11 items-center justify-center rounded-full bg-blush text-wine-dark mx-auto">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </span>
        <h1 className="m-0 mt-4 font-serif text-2xl text-wine-dark">{title}</h1>
        <p className="m-0 mt-3 mb-7 text-[13px] leading-relaxed text-ink-soft">{text}</p>
        {ctaLabel && ctaTo && (
          <Link
            to={ctaTo}
            state={ctaState}
            className="inline-block rounded-full bg-wine px-7 py-3 font-serif text-[13px] font-semibold tracking-[0.16em] text-white uppercase transition-colors hover:bg-wine-dark"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
