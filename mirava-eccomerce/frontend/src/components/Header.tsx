import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Search, Heart, User, ShoppingBag } from "lucide-react";
import Monogram from "./Monogram";
import { MENUS } from "../data/navegacao";
import { CATEGORIAS_MENU, ROTULO_CATEGORIA } from "../catalogo/tipos";
import { img } from "../lib/images";
import { useCart } from "../context/CartContext";
import type { MenuKey } from "../types";

export default function Header() {
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const navigate = useNavigate();
  const { openCart } = useCart();

  const goCategory = (menuKey: MenuKey, filter: string) => {
    setOpenMenu(null);
    navigate(`/categoria/${menuKey}/${filter}`);
  };

  const drop = openMenu ? MENUS[openMenu] : null;

  return (
    <header className="sticky top-0 z-40 bg-plum">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-5 px-4 py-4 sm:px-8 lg:px-14">
        <nav className="flex items-center gap-7">
          {(Object.keys(MENUS) as MenuKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onMouseEnter={() => setOpenMenu(key)}
              onClick={() => goCategory(key, "todos")}
              className="group relative flex items-center gap-1.5 whitespace-nowrap border-none bg-none py-2.5 font-serif text-[15px] font-semibold tracking-[0.2em] text-white uppercase cursor-pointer hover:text-blush-2"
            >
              {MENUS[key].label}
              <ChevronDown className="pointer-events-none flex h-[13px] w-[13px] text-blush-2/80" />
              <span className="absolute bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-blush-2 transition-transform duration-[400ms] group-hover:scale-x-100" />
            </button>
          ))}
        </nav>

        <button type="button" onClick={() => navigate("/")} className="flex items-center gap-3.5 border-none bg-none p-0 cursor-pointer">
          <Monogram className="h-[34px] w-[46px] shrink-0" color="#FDCAE1" />
          <span className="flex flex-col items-start gap-0.5">
            <span className="whitespace-nowrap font-serif text-[27px] leading-none font-medium tracking-[0.22em] text-white uppercase">Mirava</span>
            <span className="whitespace-nowrap text-[8px] tracking-[0.32em] text-blush-2 uppercase">joias sob encomenda</span>
          </span>
        </button>

        <div className="flex items-center justify-end gap-5">
          <Search className="h-[18px] w-[18px] cursor-pointer text-white" strokeWidth={1.6} />
          <Heart className="h-[18px] w-[18px] cursor-pointer text-white" strokeWidth={1.6} />
          <User className="h-[18px] w-[18px] cursor-pointer text-white" strokeWidth={1.6} />
          <button type="button" onClick={openCart} className="relative flex border-none bg-none p-0 text-white cursor-pointer">
            <ShoppingBag className="pointer-events-none flex h-[18px] w-[18px]" strokeWidth={1.6} />
            <span className="absolute -top-[7px] -right-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-blush-2 text-[9.5px] text-plum">1</span>
          </button>
        </div>
      </div>

      {drop && (
        <div
          onMouseLeave={() => setOpenMenu(null)}
          className="reveal in-view absolute right-0 left-0 top-full bg-paper shadow-[0_20px_44px_-28px_rgba(92,42,70,0.3)]"
        >
          <div className="grid grid-cols-[1fr_1fr_1.15fr] gap-11 px-4 pt-8 pb-9 sm:px-8 lg:px-14">
            <div className="flex flex-col gap-3">
              <span className="text-[10px] tracking-[0.18em] text-mauve uppercase">Categorias</span>
              {CATEGORIAS_MENU.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => goCategory(openMenu!, c)}
                  className="cursor-pointer border-none bg-none p-0 text-left font-serif text-[17px] text-ink hover:text-wine"
                >
                  {ROTULO_CATEGORIA[c]}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-[10px] tracking-[0.18em] text-mauve uppercase">Sobre a linha</span>
              <p className="m-0 text-sm leading-relaxed text-ink-soft">{drop.text}</p>
            </div>
            <div className="flex gap-[18px]">
              <img src={img(`menu-${openMenu}`)} alt="" className="h-[164px] w-32 rounded-tl-[64px] rounded-tr-[64px] rounded-br-[10px] rounded-bl-[10px] object-cover" />
              <div className="flex flex-col justify-center gap-2.5">
                <span className="font-script text-2xl leading-none tracking-[0.06em] text-wine">{drop.script}</span>
                <p className="m-0 max-w-[230px] text-[13px] leading-relaxed text-ink-soft">{drop.text}</p>
                <button
                  type="button"
                  onClick={() => goCategory(openMenu!, "todos")}
                  className="self-start border-0 border-b border-mauve bg-none px-0 py-1 text-[11px] tracking-[0.16em] text-ink uppercase cursor-pointer"
                >
                  Ver tudo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
