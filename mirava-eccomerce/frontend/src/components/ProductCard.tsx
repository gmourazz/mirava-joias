import { useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Eye, Heart, ShoppingBag } from "lucide-react";
import type { Product } from "../catalogo/tipos";
import { METAL_LABEL } from "../catalogo/tipos";
import { imageUrl } from "../catalogo/consultas";
import { formatarBRL, precoPix, temDescontoPix, textoParcelas } from "../lib/dinheiro";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import QuickView from "./QuickView";

// Card de produto do design v5: cartão branco com borda leve, foto quadrada
// com cantos arredondados (zoom lento no hover), preço em teal com o valor no
// Pix e as parcelas embaixo, e o botão "Adicionar à sacola" em pill.
//
// Coração de favoritos no canto, selo "Novo" (decidido no servidor) e o botão
// "Espiar peça" no hover, que abre a janela rápida. Estrelas ficam de fora: as
// notas antigas eram inventadas (decisão 28).

export default function ProductCard({ product }: { product: Product }) {
  const cover = imageUrl(product.images[0]);
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [justAdded, setJustAdded] = useState(false);
  const [espiando, setEspiando] = useState(false);
  const { isFavorite, toggle } = useFavorites();
  const favorito = isFavorite(product.id);
  const href = `/produto/${product.slug}`;
  // Peça com tamanho precisa da escolha da cliente: o botão leva à página.
  const needsChoice = product.variants.length > 0;

  const onAdd = (e: MouseEvent) => {
    e.preventDefault();
    if (needsChoice) {
      navigate(href);
      return;
    }
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: cover,
      priceCents: product.priceCents,
      size: null,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);
  };

  const rotuloBotao = justAdded ? "Na sacola" : needsChoice ? `Escolher ${(product.variantLabel ?? "tamanho").toLowerCase()}` : "Adicionar à sacola";

  return (
    <div className="group @container flex h-full flex-col gap-3 rounded-3xl border border-line-soft bg-white p-2.5 pb-4 transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(11,74,77,0.10)]">
      <Link to={href} className="relative block aspect-square overflow-hidden rounded-[18px] bg-mist-3">
        {cover ? (
          <img
            src={cover}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1100ms] ease-out group-hover:scale-[1.08]"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-[12px] text-muted">sem foto</span>
        )}
        {!product.available ? (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-white px-3 py-[5px] text-[12px] font-semibold text-muted">
            Indisponível
          </span>
        ) : product.promoPct > 0 ? (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-teal px-3 py-[5px] text-[12px] font-semibold text-white">−{product.promoPct}%</span>
        ) : (
          product.isNew && (
            <span className="absolute top-2.5 left-2.5 rounded-full bg-white px-3 py-[5px] text-[12px] font-semibold text-teal">Novo</span>
          )
        )}
        <button
          type="button"
          aria-label={favorito ? "Tirar dos favoritos" : "Salvar nos favoritos"}
          onClick={(e) => {
            e.preventDefault();
            toggle(product.id);
          }}
          className={`absolute top-2.5 right-2.5 grid h-9 w-9 cursor-pointer place-items-center rounded-full border-none bg-white text-teal-soft transition-transform duration-300 ease-[cubic-bezier(.3,1.6,.5,1)] ${favorito ? "scale-110" : ""}`}
        >
          <Heart size={17} strokeWidth={1.8} fill={favorito ? "#5FB8B0" : "none"} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setEspiando(true);
          }}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 translate-y-2.5 cursor-pointer items-center gap-1.5 rounded-full border-none bg-white/95 px-4 py-2 text-[12.5px] font-semibold whitespace-nowrap text-teal opacity-0 transition-[opacity,transform] duration-300 group-hover:translate-y-0 group-hover:opacity-100 focus:translate-y-0 focus:opacity-100"
        >
          <Eye size={14} strokeWidth={1.8} />
          Espiar peça
        </button>
      </Link>

      <Link to={href} className="grid gap-[5px] px-1.5 text-text hover:text-text">
        <span className="text-[15px] leading-[1.35] font-medium">{product.name}</span>
        <span className="flex flex-wrap items-baseline gap-x-2">
          {product.promoPct > 0 && <s className="text-[13px] text-muted">{formatarBRL(product.listPriceCents)}</s>}
          <span className="text-[17px] font-bold text-teal [font-variant-numeric:tabular-nums]">{formatarBRL(product.priceCents)}</span>
          {temDescontoPix && <span className="text-[12.5px] text-muted">{formatarBRL(precoPix(product.priceCents))} no Pix</span>}
        </span>
        <span className="text-[12.5px] text-muted">{textoParcelas(product.priceCents)}</span>
        <span className="text-[12px] text-teal-mid">{METAL_LABEL[product.metal]}</span>
      </Link>

      {product.available && (
        <button
          type="button"
          onClick={onAdd}
          aria-label={rotuloBotao}
          title={rotuloBotao}
          className="mx-1.5 mt-auto flex cursor-pointer items-center justify-center gap-2 rounded-full border-none bg-mist-2 p-3 text-[14px] font-semibold text-teal transition-colors hover:bg-teal hover:text-white"
        >
          {justAdded ? <Check size={17} strokeWidth={2} /> : <ShoppingBag size={17} strokeWidth={1.8} />}
          {/* Card estreito (coluna apertada, celular): só o ícone. */}
          <span className="hidden whitespace-nowrap @[196px]:inline">{rotuloBotao}</span>
        </button>
      )}
      {espiando && <QuickView product={product} fechar={() => setEspiando(false)} />}
    </div>
  );
}
