import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Search, X, Heart, User, ShoppingBag } from "lucide-react";
import Monogram from "./Monogram";
import { MENUS } from "../data/navegacao";
import { MENU_CATEGORIES, CATEGORY_LABEL } from "../catalogo/tipos";
import { useCart } from "../context/CartContext";
import type { MenuKey } from "../types";

// "Prata 925" tem um número no meio — na fonte serifada isso quebra o
// alinhamento visual com "Banhado a Ouro" e "Coleções", que são só letras.
// No menu do topo mostramos a versão curta; o "925" continua no breadcrumb
// e no resto do site, onde faz sentido como especificação técnica.
const NAV_LABEL: Record<MenuKey, string> = {
  prata: "Prata",
  ouro: "Banhado a Ouro",
  colecoes: "Coleções",
};

export default function Header() {
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { openCart, itemCount } = useCart();

  const goCategory = (menuKey: MenuKey, filter: string) => {
    setOpenMenu(null);
    navigate(`/categoria/${menuKey}/${filter}`);
  };

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/busca?q=${encodeURIComponent(query.trim())}`);
    setSearchOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-plum">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-5 px-4 py-4 sm:px-8 lg:px-14">
        <nav className="flex items-center gap-7">
          {(Object.keys(MENUS) as MenuKey[]).map((key) => (
            <div
              key={key}
              className="relative"
              onMouseEnter={() => setOpenMenu(key)}
              onMouseLeave={() => setOpenMenu(null)}
            >
              <button
                type="button"
                onClick={() => goCategory(key, "todos")}
                className="group relative flex items-center gap-1.5 whitespace-nowrap border-none bg-none py-2.5 font-serif text-[19px] font-normal text-white cursor-pointer hover:text-blush-2"
              >
                {NAV_LABEL[key]}
                <ChevronDown className="pointer-events-none flex h-[13px] w-[13px] text-blush-2/80" />
                <span className="absolute bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-blush-2 transition-transform duration-[400ms] group-hover:scale-x-100" />
              </button>

              {openMenu === key && (
                // O espaço acima do card fica dentro deste invólucro (pt-3, sem
                // fundo) em vez de ser margem do card — assim o mouse nunca sai
                // de um elemento filho do menu ao descer do botão até o card, e
                // o dropdown não fecha sozinho no meio do caminho.
                <div className="absolute left-0 top-full w-64 pt-3">
                  <div className="reveal in-view rounded-2xl bg-gradient-to-b from-plum to-wine-dark p-6 shadow-[0_24px_48px_-18px_rgba(92,42,70,0.55)]">
                    <span className="font-sans text-[10px] tracking-[0.22em] text-blush-2/70 uppercase">Categorias</span>
                    <div className="mt-3.5 flex flex-col gap-3.5">
                      {MENU_CATEGORIES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => goCategory(key, c)}
                          className="cursor-pointer border-none bg-none p-0 text-left font-serif text-[18px] text-white hover:text-blush-2"
                        >
                          {CATEGORY_LABEL[c]}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => goCategory(key, "todos")}
                      className="mt-5 cursor-pointer rounded-full border border-blush-2/60 bg-none px-4 py-2 font-sans text-[11px] tracking-[0.16em] text-blush-2 uppercase hover:border-blush-2 hover:bg-white/10 hover:text-white"
                    >
                      Ver tudo
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => navigate("/mais-vendidas")}
            className="whitespace-nowrap border-none bg-none py-2.5 font-serif text-[19px] font-normal text-white cursor-pointer hover:text-blush-2"
          >
            Mais Vendidas
          </button>
        </nav>

        <button type="button" onClick={() => navigate("/")} className="flex items-center gap-3.5 border-none bg-none p-0 cursor-pointer">
          <Monogram className="h-[34px] w-[46px] shrink-0" color="#FDCAE1" />
          <span className="flex flex-col items-start gap-0.5">
            <span className="whitespace-nowrap font-script text-[27px] leading-none font-medium tracking-[0.22em] text-white uppercase">Mirava</span>
            <span className="whitespace-nowrap text-[8px] tracking-[0.32em] text-blush-2 uppercase">joias sob encomenda</span>
          </span>
        </button>

        <div className="flex items-center justify-end gap-5">
          {searchOpen && (
            <form
              onSubmit={submitSearch}
              className="reveal in-view flex w-52 items-center gap-2 rounded-full border border-blush-2/50 bg-plum/60 px-4 py-2 sm:w-64"
            >
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar peças…"
                className="w-full border-none bg-none font-sans text-[13px] text-white placeholder:text-white/50 focus:outline-none"
              />
            </form>
          )}

          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="flex border-none bg-none p-0 text-white cursor-pointer"
            aria-label="Buscar"
          >
            {searchOpen
              ? <X className="h-[18px] w-[18px]" strokeWidth={1.6} />
              : <Search className="h-[18px] w-[18px]" strokeWidth={1.6} />}
          </button>

          <Heart className="h-[18px] w-[18px] cursor-pointer text-white" strokeWidth={1.6} />
          <button type="button" onClick={() => navigate("/conta")} className="flex border-none bg-none p-0 cursor-pointer">
            <User className="h-[18px] w-[18px] text-white" strokeWidth={1.6} />
          </button>
          <button type="button" onClick={openCart} className="relative flex border-none bg-none p-0 text-white cursor-pointer">
            <ShoppingBag className="pointer-events-none flex h-[18px] w-[18px]" strokeWidth={1.6} />
            {itemCount > 0 && (
              <span className="absolute -top-[7px] -right-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-blush-2 text-[9.5px] text-plum">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
