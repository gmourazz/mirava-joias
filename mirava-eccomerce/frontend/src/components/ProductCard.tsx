import type { MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, ShoppingBag } from "lucide-react";
import type { Product } from "../catalogo/tipos";
import { METAL_LABEL } from "../catalogo/tipos";
import { imageUrl } from "../catalogo/consultas";
import { formatarBRL, textoParcelas } from "../lib/dinheiro";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";

// Sem estrelas de avaliação aqui, de propósito.
//
// As notas anteriores eram inventadas, e avaliação falsa é publicidade
// enganosa. Quando existirem avaliações reais de clientes, a nota volta —
// vinda do banco, não de um array no código.

export default function ProductCard({ product }: { product: Product }) {
  const cover = imageUrl(product.images[0]);
  const sizes = product.variants.filter((v) => v.available);
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const navigate = useNavigate();
  const favorited = isFavorite(product.id);

  // Sem conta, favoritar não existe (a tabela não aceita user_id nulo) —
  // manda pra tela de entrar em vez de fingir que salvou.
  const toggleFav = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const attempted = await toggleFavorite(product);
    if (!attempted) navigate("/conta");
  };

  // Adiciona direto da vitrine, sem abrir a peça. Quando tem tamanho, usa o
  // primeiro disponível — ajustar depois é rapidinho no drawer do carrinho,
  // e é melhor do que obrigar a cliente a entrar na peça só pra isso.
  const quickAdd = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const size = sizes[0];
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: cover,
      priceCents: product.priceCents + (size?.priceAdjustCents ?? 0),
      size: size?.size ?? null,
    });
  };

  return (
    <div>
      <Link to={`/produto/${product.slug}`} className="block">
        <div className="zoom-on-hover relative aspect-[4/5] overflow-hidden rounded-[14px] bg-[#FBF6F8]">
          {cover ? (
            <img
              src={cover}
              alt={product.name}
              loading="lazy"
              className="block h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] text-mauve">
              sem foto
            </div>
          )}

          <span className="absolute top-3 left-3 rounded-full bg-plum px-3.5 py-1.5 text-[9.5px] tracking-[0.18em] text-blush uppercase">
            Sob encomenda
          </span>

          <span className="absolute bottom-3 left-3 rounded-full border border-mauve bg-white/94 px-3 py-1.5 text-[9.5px] tracking-[0.14em] text-ink-soft uppercase">
            {METAL_LABEL[product.metal]}
          </span>

          <button
            type="button"
            onClick={toggleFav}
            aria-label={favorited ? "Remover dos favoritos" : "Favoritar"}
            aria-pressed={favorited}
            className="absolute top-3 right-3 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-white/85 text-wine transition-colors hover:bg-white"
          >
            <Heart
              className="pointer-events-none h-4 w-4"
              strokeWidth={1.6}
              fill={favorited ? "currentColor" : "none"}
            />
          </button>

          {!product.available && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/75">
              <span className="rounded-full bg-plum px-4 py-2 text-[10px] tracking-[0.16em] text-blush uppercase">
                Indisponível
              </span>
            </div>
          )}
        </div>
      </Link>

      {product.available && (
        <div className="flex flex-col gap-2 pt-3">
          {sizes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sizes.slice(0, 4).map((v) => (
                <span
                  key={v.id}
                  className="min-w-9 rounded-full border border-rose px-2.5 py-1.5 text-center text-[11px]"
                >
                  {v.size}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Link
              to={`/produto/${product.slug}`}
              className="flex-1 rounded-full border border-wine/70 p-2.5 text-center font-serif text-[13.5px] font-semibold tracking-[0.2em] text-wine uppercase hover:bg-wine hover:text-white"
            >
              Ver peça
            </Link>
            <button
              type="button"
              onClick={quickAdd}
              aria-label="Adicionar à sacola"
              className="flex h-[38px] w-[38px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-wine/70 bg-none text-wine transition-colors hover:bg-wine hover:text-white"
            >
              <ShoppingBag className="pointer-events-none h-4 w-4" strokeWidth={1.6} />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 pt-3.5">
        <h3 className="m-0 font-serif text-[16.5px] font-normal">
          <Link to={`/produto/${product.slug}`} className="hover:text-wine">
            {product.name}
          </Link>
        </h3>
        <span className="text-[16px] text-ink">{formatarBRL(product.priceCents)}</span>
        <span className="text-xs text-ink-soft">{textoParcelas(product.priceCents)}</span>
      </div>
    </div>
  );
}
