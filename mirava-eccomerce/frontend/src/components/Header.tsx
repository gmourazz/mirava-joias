import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown, Circle, Flame, Gem, Gift, Heart, HelpCircle, Layers, Link2,
  LogOut, Menu, Moon, Package, Search, ShoppingBag, Sparkles, Sun, Tag, User, X,
  type LucideIcon,
} from "lucide-react";
import { MENU_CATEGORIES, CATEGORY_LABEL, type Category } from "../catalogo/tipos";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../context/FavoritesContext";
import SearchOverlay from "./SearchOverlay";

// Header do design v5: primeira linha com o wordmark à esquerda e os ícones
// à direita; segunda linha com o menu centralizado, cada item com ícone e,
// quando tem, um dropdown que abre no hover. No celular o menu vira gaveta.

interface NavLink {
  label: string;
  to: string;
  Icon: LucideIcon;
}

interface NavItem extends NavLink {
  /** Itens do dropdown. Sem itens, o item é só um link. */
  items?: NavLink[];
}

const CATEGORY_ICON: Record<Category, LucideIcon> = {
  aneis: Circle,
  colares: Heart,
  pulseiras: Link2,
  berloques: Link2,
  brincos: Sparkles,
  conjuntos: Layers,
  outros: Gem,
};

const categoryLinks = (base: string): NavLink[] =>
  MENU_CATEGORIES.map((c) => ({
    label: CATEGORY_LABEL[c],
    to: `${base}/${c}`,
    Icon: CATEGORY_ICON[c],
  }));

// Presentes filtra por preço máximo (?ate= em centavos); a página de
// categoria aplica o teto.
const presentes = (cents: number) => `/categoria/colecoes/todos?ate=${cents}`;

const NAV: NavItem[] = [
  { label: "Lançamentos", to: "/categoria/colecoes/todos?ordem=novos", Icon: Sparkles },
  {
    label: "Joias",
    to: "/categoria/colecoes/todos",
    Icon: Gem,
    items: [
      { label: "Mais vendidos", to: "/categoria/colecoes/todos", Icon: Flame },
      ...categoryLinks("/categoria/colecoes"),
    ],
  },
  { label: "Berloques", to: "/categoria/colecoes/berloques", Icon: Link2 },
  { label: "Prata", to: "/categoria/prata/todos", Icon: Moon, items: categoryLinks("/categoria/prata") },
  { label: "Ouro 18k", to: "/categoria/ouro/todos", Icon: Sun, items: categoryLinks("/categoria/ouro") },
  {
    label: "Presentes",
    to: presentes(20000),
    Icon: Gift,
    items: [
      { label: "Até R$ 50", to: presentes(5000), Icon: Tag },
      { label: "Até R$ 80", to: presentes(8000), Icon: Tag },
      { label: "Até R$ 120", to: presentes(12000), Icon: Tag },
    ],
  },
  { label: "Ajuda", to: "/perguntas-frequentes", Icon: HelpCircle },
];

const iconButton =
  "relative grid h-10 w-10 cursor-pointer place-items-center border-none bg-transparent p-0 text-[#141A19] transition-[color,transform] duration-200 hover:-translate-y-px hover:text-teal";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export default function Header() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { openCart, itemCount } = useCart();
  const { ids: favoritos } = useFavorites();
  const { user, logout } = useAuth();

  // A sacola dá um pulinho quando entra peça nova — feedback de que deu certo.
  const [bump, setBump] = useState(false);
  const lastCount = useRef(itemCount);
  useEffect(() => {
    if (itemCount > lastCount.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 300);
      lastCount.current = itemCount;
      return () => clearTimeout(t);
    }
    lastCount.current = itemCount;
  }, [itemCount]);

  const go = (to: string) => {
    setOpenMenu(null);
    setDrawerOpen(false);
    setUserMenuOpen(false);
    navigate(to);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white" onMouseLeave={() => setOpenMenu(null)}>
      <div className="mx-auto grid max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 px-[clamp(16px,3vw,48px)] lg:gap-x-7">
        <button type="button" aria-label="Abrir menu" onClick={() => setDrawerOpen(true)} className={`${iconButton} lg:hidden`}>
          <Menu size={20} strokeWidth={1.5} />
        </button>

        <Link to="/" className="flex h-[72px] flex-col justify-center gap-1.5 justify-self-center text-teal-dark hover:text-teal-dark lg:h-20 lg:justify-self-start">
          <span className="font-logo text-[24px] leading-none tracking-[0.28em] whitespace-nowrap lg:text-[30px]">MIRAVA</span>
          <span className="hidden text-[9px] tracking-[0.42em] whitespace-nowrap text-[#5E7473] sm:block">
            SEMIJOIAS · PRATA &amp; OURO
          </span>
        </Link>

        <div className="col-start-3 flex items-center justify-end gap-1 lg:gap-3">
          <button type="button" aria-label="Buscar" onClick={() => setSearchOpen(true)} className={iconButton}>
            <Search size={20} strokeWidth={1.5} />
          </button>

          <button type="button" aria-label="Favoritos" onClick={() => go("/conta?aba=favoritos")} className={`${iconButton} hidden sm:grid`}>
            <Heart size={20} strokeWidth={1.5} />
            {favoritos.size > 0 && (
              <span className="absolute top-0 -right-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-teal px-1 text-[10px] font-bold text-white">
                {favoritos.size}
              </span>
            )}
          </button>

          {user ? (
            <div className="relative" onMouseLeave={() => setUserMenuOpen(false)}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex cursor-pointer items-center gap-2 rounded-full border-none bg-fog py-[3px] pr-[10px] pl-[3px] text-text"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-teal font-logo text-[13px] text-white">
                  {initials(user.name)}
                </span>
                <span className="hidden text-[13px] font-semibold sm:inline">{user.name.split(" ")[0]}</span>
              </button>
              {userMenuOpen && (
                <div className="absolute top-full right-0 z-40 pt-2">
                  <div className="animate-drop grid w-[230px] rounded-[20px] border border-line bg-white p-2 shadow-[0_20px_50px_rgba(11,74,77,0.16)]">
                    <button type="button" onClick={() => go("/conta")} className="flex cursor-pointer items-center gap-3 rounded-xl border-none bg-transparent px-3 py-2.5 text-left text-[14px] text-text hover:bg-mist">
                      <User size={16} strokeWidth={1.6} className="text-[#5E7473]" />
                      Minha conta
                    </button>
                    <button type="button" onClick={() => go("/conta?aba=pedidos")} className="flex cursor-pointer items-center gap-3 rounded-xl border-none bg-transparent px-3 py-2.5 text-left text-[14px] text-text hover:bg-mist">
                      <Package size={16} strokeWidth={1.6} className="text-[#5E7473]" />
                      Meus pedidos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        go("/");
                      }}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border-none bg-transparent px-3 py-2.5 text-left text-[14px] text-muted hover:bg-mist"
                    >
                      <LogOut size={16} strokeWidth={1.6} />
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button type="button" aria-label="Entrar" onClick={() => go("/conta")} className={iconButton}>
              <User size={20} strokeWidth={1.5} />
            </button>
          )}

          <button
            type="button"
            aria-label="Sacola"
            onClick={openCart}
            className={iconButton}
            style={{ transform: bump ? "scale(1.08)" : undefined }}
          >
            <ShoppingBag size={20} strokeWidth={1.5} />
            {itemCount > 0 && (
              <span className="absolute top-0 -right-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-teal px-1 text-[10px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <nav className="hidden justify-center border-t border-[#EEF3F2] lg:flex">
        <div className="flex flex-wrap justify-center gap-x-[clamp(16px,2.4vw,36px)]">
          {NAV.map((item) => {
            const open = openMenu === item.label;
            return (
              <div key={item.label} className="relative" onMouseEnter={() => setOpenMenu(item.items ? item.label : null)}>
                <button
                  type="button"
                  onClick={() => go(item.to)}
                  aria-expanded={item.items ? open : undefined}
                  className={`flex h-[46px] cursor-pointer items-center gap-2 border-0 border-b-[1.5px] bg-transparent px-0 text-[11px] font-medium tracking-[0.16em] whitespace-nowrap uppercase transition-colors hover:border-teal hover:text-teal ${
                    open ? "border-teal text-teal" : "border-transparent text-[#141A19]"
                  }`}
                >
                  <item.Icon size={13} strokeWidth={1.6} />
                  {item.label}
                  {item.items && (
                    <ChevronDown size={13} strokeWidth={1.6} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                  )}
                </button>

                {open && item.items && (
                  <div className="animate-drop absolute top-full -left-4 z-40 w-[250px] rounded-b-2xl border border-t-0 border-line bg-white py-2 shadow-[0_18px_48px_rgba(7,40,40,0.10)]">
                    {item.items.map((sub) => (
                      <button
                        key={sub.label}
                        type="button"
                        onClick={() => go(sub.to)}
                        className="flex w-full cursor-pointer items-center gap-3 border-none bg-transparent px-5 py-[11px] text-left text-[14px] text-[#141A19] transition-[background,color,padding] duration-200 hover:bg-[#F1F7F6] hover:pl-[25px] hover:text-teal"
                      >
                        <sub.Icon size={16} strokeWidth={1.6} className="text-[#5E7473]" />
                        {sub.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => go(item.to)}
                      className="mx-3 mt-1.5 mb-1 w-[calc(100%-24px)] cursor-pointer rounded-[10px] border-none bg-mist px-3 py-[11px] text-left text-[11px] font-semibold tracking-[0.14em] text-teal uppercase"
                    >
                      Ver tudo →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {drawerOpen && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setDrawerOpen(false)}
            className="animate-fade-in fixed inset-0 z-50 cursor-pointer border-none bg-teal-dark/40 lg:hidden"
          />
          <aside className="animate-fade-in fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col overflow-y-auto bg-white lg:hidden">
            <div className="flex items-center justify-between border-b border-line px-6 py-5">
              <span className="font-logo text-[20px] tracking-[0.28em] text-teal-dark">MIRAVA</span>
              <button type="button" aria-label="Fechar" onClick={() => setDrawerOpen(false)} className={iconButton}>
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <nav className="grid content-start gap-1 px-3 py-4">
              {NAV.map((item) => (
                <div key={item.label} className="grid">
                  <button
                    type="button"
                    onClick={() => go(item.to)}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border-none bg-transparent px-3 py-3 text-left text-[12px] font-medium tracking-[0.14em] text-text uppercase hover:bg-mist"
                  >
                    <item.Icon size={16} strokeWidth={1.6} className="text-teal" />
                    {item.label}
                  </button>
                  {item.items && (
                    <div className="grid pl-9">
                      {item.items.map((sub) => (
                        <button
                          key={sub.label}
                          type="button"
                          onClick={() => go(sub.to)}
                          className="cursor-pointer rounded-lg border-none bg-transparent px-3 py-2 text-left text-[14px] text-text-2 hover:bg-mist"
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </aside>
        </>
      )}

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </header>
  );
}
