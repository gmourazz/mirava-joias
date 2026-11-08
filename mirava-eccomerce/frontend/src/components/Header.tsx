import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Cherry, ChevronDown, Circle, Flame, Gem, Gift, Heart, HelpCircle, Layers, Link2, LogOut, Menu, MoreHorizontal, Moon, Package, Search, ShoppingBag, Sparkles, Sun, User, X, type LucideIcon, Watch } from "lucide-react";
import type { Category } from "../catalogo/tipos";
import { useCategorias, type CategoriaLoja } from "../catalogo/categorias";
import { useColecoes, type Colecao } from "../lib/extras";
import { useLogin } from "../context/LoginContext";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../context/FavoritesContext";
import SearchOverlay from "./SearchOverlay";
import logoTurquesa from "../assets/logos/2 - Logo sem SEMIJOIAS/mirava-logo-turquesa.svg";

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
  /** Item que só abre o dropdown (sem página própria): o clique não navega. */
  menuOnly?: boolean;
}

const CATEGORY_ICON: Record<Category, LucideIcon | undefined> = {
  aneis: Circle,
  colares: Heart,
  pulseiras: Link2,
  berloques: Cherry,
  brincos: Sparkles,
  conjuntos: Layers,
  outros: Gem,
};

// As categorias vêm do painel (ordem e rótulo editáveis); ícone de fábrica
// para as conhecidas, joia para as novas.
const categoryLinks = (cats: CategoriaLoja[], base: string): NavLink[] =>
  cats.map((c) => ({
    label: c.label,
    to: `${base}/${c.slug}`,
    Icon: CATEGORY_ICON[c.slug] ?? Gem,
  }));

// Presentes filtra por preço máximo (?ate= em centavos); a página de
// categoria aplica o teto.
const presentes = (cents: number) => `/categoria/colecoes/todos?ate=${cents}`;

// Relógios têm item próprio no menu (como na fornecedora), sempre visível, e
// não entram na lista de "Joias". Sem relógio publicado, a página avisa que
// eles chegam em breve.
const buildNav = (cats: CategoriaLoja[], colecoes: Colecao[]): NavItem[] => [
  { label: "Lançamentos", to: "/categoria/colecoes/todos?ordem=novos", Icon: Sparkles },
  {
    label: "Joias",
    to: "/categoria/colecoes/todos",
    Icon: Gem,
    items: [
      { label: "Mais vendidos", to: "/categoria/colecoes/todos?ordem=vendidos", Icon: Flame },
      ...categoryLinks(cats.filter((c) => c.slug !== "relogios"), "/categoria/colecoes"),
    ],
  },
  // Como no exemplo da ASIO: "Coleções" leva sempre à página com as capas,
  // sem submenu — as coleções em si são escolhidas pela capa.
  ...(colecoes.length > 0 ? [{ label: "Coleções", to: "/colecoes", Icon: Layers }] : []),
  { label: "Berloques", to: "/categoria/colecoes/berloques", Icon: Cherry },
  { label: "Banhados a prata", to: "/categoria/prata/todos", Icon: Moon, items: categoryLinks(cats, "/categoria/prata") },
  { label: "Banhados a ouro", to: "/categoria/ouro/todos", Icon: Sun, items: categoryLinks(cats, "/categoria/ouro") },
  { label: "Relógios", to: "/categoria/colecoes/relogios", Icon: Watch },
  {
    label: "Mais",
    to: "",
    Icon: MoreHorizontal,
    menuOnly: true,
    items: [
      // Presentes: a escolha por faixa de preço (até R$ 50, 80, 120…) fica no
      // filtro "Preço" da página.
      { label: "Presentes", to: presentes(20000), Icon: Gift },
      { label: "Sobre nós", to: "/sobre-nos", Icon: Heart },
      { label: "Ajuda", to: "/perguntas-frequentes", Icon: HelpCircle },
    ],
  },
];

const iconButton =
  "relative grid h-10 w-10 cursor-pointer place-items-center border-none bg-transparent p-0 text-[#141A19] transition-[color,transform] duration-200 hover:-translate-y-px hover:text-teal";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export default function Header() {
  const NAV = buildNav(useCategorias(), useColecoes());
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { openCart, itemCount } = useCart();
  const { ids: favoritos } = useFavorites();
  const { user, logout } = useAuth();
  const { abrirLogin } = useLogin();

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
    if (!user && to.startsWith("/conta")) abrirLogin(to);
    else navigate(to);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white" onMouseLeave={() => setOpenMenu(null)}>
      <div className="mx-auto grid max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 px-[clamp(16px,3vw,48px)] lg:gap-x-7">
        <button type="button" aria-label="Abrir menu" onClick={() => setDrawerOpen(true)} className={`${iconButton} lg:hidden`}>
          <Menu size={20} strokeWidth={1.5} />
        </button>

        <Link to="/" aria-label="Mirava Semijoias, início" className="col-start-2 row-start-1 flex h-[72px] items-center justify-self-center lg:h-20 lg:justify-self-start">
          <img src={logoTurquesa} alt="Mirava Semijoias" className="h-11 w-auto lg:h-[52px]" />
        </Link>

        <div className="col-start-3 row-start-1 flex items-center justify-end gap-1 lg:gap-3">
          <button
            type="button"
            aria-label="Buscar"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((v) => !v)}
            className={`${iconButton} ${searchOpen ? "text-teal" : ""}`}
          >
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

        {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
      </div>

      <nav className="hidden justify-center border-t border-[#EEF3F2] lg:flex">
        <div className="flex flex-wrap justify-center gap-x-[clamp(16px,2.4vw,36px)]">
          {NAV.map((item) => {
            const open = openMenu === item.label;
            return (
              <div key={item.label} className="relative" onMouseEnter={() => setOpenMenu(item.items ? item.label : null)}>
                <button
                  type="button"
                  onClick={() => (item.menuOnly ? setOpenMenu(open ? null : item.label) : go(item.to))}
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
                    {!item.menuOnly && (
                      <button
                        type="button"
                        onClick={() => go(item.to)}
                        className="mx-3 mt-1.5 mb-1 w-[calc(100%-24px)] cursor-pointer rounded-[10px] border-none bg-mist px-3 py-[11px] text-left text-[11px] font-semibold tracking-[0.14em] text-teal uppercase"
                      >
                        Ver tudo →
                      </button>
                    )}
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
              <img src={logoTurquesa} alt="Mirava Semijoias" className="h-10 w-auto" />
              <button type="button" aria-label="Fechar" onClick={() => setDrawerOpen(false)} className={iconButton}>
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <nav className="grid content-start gap-1 px-3 py-4">
              {NAV.map((item) => (
                <div key={item.label} className="grid">
                  <button
                    type="button"
                    onClick={() => !item.menuOnly && go(item.to)}
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

    </header>
  );
}
