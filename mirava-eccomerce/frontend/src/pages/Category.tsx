import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import {
  CatalogoCarregando, CatalogoErro, CatalogoVazio,
} from "../components/EstadosCatalogo";
import { useProdutos } from "../catalogo/hooks";
import {
  CATEGORIAS_MENU, ROTULO_CATEGORIA,
  type Categoria, type Metal,
} from "../catalogo/tipos";
import { MENUS, type MenuKey } from "../data/navegacao";
import { img } from "../lib/images";
import { textoPrazo } from "../lib/dinheiro";

const MENU_KEYS: MenuKey[] = ["prata", "ouro", "colecoes"];

/** "colecoes" mostra tudo — não é um metal, é uma vitrine. */
function metalDoMenu(menu: MenuKey): Metal | undefined {
  return menu === "colecoes" ? undefined : menu;
}

export default function Category() {
  const { menuKey = "prata", filter = "todos" } = useParams();
  const navigate = useNavigate();

  const menu: MenuKey = MENU_KEYS.includes(menuKey as MenuKey)
    ? (menuKey as MenuKey)
    : "prata";

  const categoria: Categoria | undefined =
    CATEGORIAS_MENU.includes(filter as Categoria)
      ? (filter as Categoria)
      : undefined;

  const { dado: produtos, carregando, erro, tentarDeNovo } = useProdutos({
    metal: metalDoMenu(menu),
    categoria,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [menuKey, filter]);

  const info = MENUS[menu];
  const filtros: Array<{ key: string; label: string }> = [
    { key: "todos", label: "Todas" },
    ...CATEGORIAS_MENU.map((c) => ({ key: c, label: ROTULO_CATEGORIA[c] })),
  ];

  return (
    <div>
      <div className="relative overflow-hidden">
        <img src={img(`banner-${menu}`)} alt="" className="block h-[280px] w-full object-cover" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-plum/38">
          <span className="text-[10px] tracking-[0.22em] text-rose uppercase">
            Início / {info.label}
          </span>
          <h1 className="m-0 font-serif text-[clamp(28px,3.4vw,44px)] font-normal text-white">
            {info.title}
          </h1>
          <span className="rounded-full border border-blush/70 px-4 py-1.5 text-[10px] tracking-[0.2em] text-white uppercase">
            Produção sob encomenda · {textoPrazo()}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 px-6 pt-[34px] sm:px-16 lg:px-24">
        {filtros.map((f) => {
          const ativo = (categoria ?? "todos") === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => navigate(`/categoria/${menu}/${f.key}`)}
              className="cursor-pointer rounded-full border border-rose px-[18px] py-[9px] font-serif text-sm font-semibold tracking-[0.2em] uppercase"
              style={{
                background: ativo ? "#8E3B6B" : "transparent",
                color: ativo ? "#ffffff" : "#8E3B6B",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="px-6 pt-7 pb-5 text-[13px] text-ink-soft sm:px-16 lg:px-24">
        {carregando
          ? "carregando peças…"
          : erro
            ? " "
            : `${produtos.length} ${produtos.length === 1 ? "peça" : "peças"} · todas feitas sob encomenda`}
      </div>

      <section className="grid grid-cols-2 gap-[22px] px-6 pb-20 sm:px-16 md:grid-cols-3 lg:grid-cols-4 lg:px-24">
        {carregando && <CatalogoCarregando />}
        {!carregando && erro && <CatalogoErro mensagem={erro} aoTentarDeNovo={tentarDeNovo} />}
        {!carregando && !erro && produtos.length === 0 && (
          <CatalogoVazio
            mensagem={
              categoria
                ? `Nenhuma peça em ${ROTULO_CATEGORIA[categoria].toLowerCase()} ainda`
                : undefined
            }
          />
        )}
        {!carregando && !erro &&
          produtos.map((p) => <ProductCard key={p.id} produto={p} />)}
      </section>
    </div>
  );
}
