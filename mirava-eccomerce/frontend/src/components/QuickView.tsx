// "Espiar peça" (v5): janela rápida com foto, preço, tamanho, quantidade e
// "Adicionar à sacola", sem sair da página. Recebe a peça que o card já tem
// em mãos — nenhuma requisição a mais.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Gem, Heart, Minus, Plus, RefreshCw, Ruler, ShieldCheck, ShoppingBag, X } from "lucide-react";
import type { Product } from "../catalogo/tipos";
import { METAL_LABEL } from "../catalogo/tipos";
import { imageUrl } from "../catalogo/consultas";
import { formatarBRL, precoPix, temDescontoPix, textoParcelas, precoDaPeca } from "../lib/dinheiro";
import PrecoRiscado from "./PrecoRiscado";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";

export default function QuickView({ product, fechar }: { product: Product; fechar: () => void }) {
  const { addItem } = useCart();
  const { isFavorite, toggle } = useFavorites();
  const variants = product.variants.filter((v) => v.available);
  const [size, setSize] = useState<string | null>(variants.length === 1 ? variants[0].size : null);
  const [qty, setQty] = useState(1);
  const [foto, setFoto] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fechar]);

  const fotos = product.images.map((p) => imageUrl(p)).filter((u): u is string => Boolean(u));
  const ajuste = variants.find((v) => v.size === size)?.priceAdjustCents ?? 0;
  const { cheio, final: price } = precoDaPeca(product, ajuste);
  const precisaEscolher = variants.length > 1 && !size;
  const favorito = isFavorite(product.id);

  return createPortal(
    <div className="fixed inset-0 z-[75] grid place-items-center overflow-y-auto p-4">
      <div className="animate-fade-in absolute inset-0 bg-teal-dark/40" onClick={fechar} />
      <div className="animate-pop relative grid max-h-[92vh] w-[min(980px,100%)] grid-cols-1 gap-7 overflow-y-auto rounded-[32px] bg-white p-4 md:grid-cols-2">
        <div className="grid content-start gap-3">
          <div className="relative aspect-square overflow-hidden rounded-3xl bg-mist-3">
            {fotos[foto] && <img src={fotos[foto]} alt={product.name} className="h-full w-full object-cover" />}
            {product.isNew && <span className="absolute top-3 left-3 rounded-full bg-white px-3 py-[5px] text-[12px] font-semibold text-teal">Novo</span>}
          </div>
          {fotos.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {fotos.slice(0, 5).map((u, i) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setFoto(i)}
                  className={`aspect-square cursor-pointer overflow-hidden rounded-xl border-none bg-mist-3 p-0 ${i === foto ? "shadow-[0_0_0_2px_#0F6E73]" : ""}`}
                >
                  <img src={u} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid content-start gap-4 p-2 md:pr-4">
          <div className="flex items-start justify-between gap-3">
            <span className="rounded-full bg-mist px-3 py-1 text-[12px] font-semibold text-teal">{METAL_LABEL[product.metal]}</span>
            <button type="button" aria-label="Fechar" onClick={fechar} className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-none bg-chip text-text">
              <X size={18} />
            </button>
          </div>
          <h3 className="m-0 font-serif text-[34px] leading-[1.08] font-normal text-teal-dark">{product.name}</h3>
          <div className="grid gap-1">
            <PrecoRiscado cheio={cheio} pct={product.promoPct} className="text-[14px]" />
            <span className="text-[24px] font-bold text-teal">{formatarBRL(price)}</span>
            <span className="text-[13.5px] text-muted">
              {textoParcelas(price)}
              {temDescontoPix && ` · ${formatarBRL(precoPix(price))} no Pix`}
            </span>
          </div>

          {variants.length > 0 && (
            <div className="grid gap-2">
              <span className="text-[13px] font-semibold text-text-2">{product.variantLabel ?? "Tamanho"}</span>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSize(v.size)}
                    className={`grid h-[46px] min-w-[46px] cursor-pointer place-items-center rounded-full border-[1.5px] px-3 text-[14px] font-semibold ${
                      size === v.size ? "border-teal bg-teal text-white" : "border-[#DDE4E4] bg-white text-text hover:border-teal"
                    }`}
                  >
                    {v.size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.available ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1 rounded-full bg-chip p-1">
                <button type="button" aria-label="Diminuir" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-[42px] w-[42px] cursor-pointer place-items-center rounded-full border-none bg-white">
                  <Minus size={15} strokeWidth={2} />
                </button>
                <span className="min-w-8 text-center text-[15px] font-semibold">{qty}</span>
                <button type="button" aria-label="Aumentar" onClick={() => setQty((q) => q + 1)} className="grid h-[42px] w-[42px] cursor-pointer place-items-center rounded-full border-none bg-white">
                  <Plus size={15} strokeWidth={2} />
                </button>
              </div>
              <button
                type="button"
                disabled={precisaEscolher}
                onClick={() => {
                  addItem({ productId: product.id, slug: product.slug, name: product.name, image: fotos[0] ?? null, priceCents: price, size }, qty);
                  fechar();
                }}
                className="flex min-w-[180px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border-none bg-teal px-6 py-[15px] text-[15px] font-semibold text-white hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {precisaEscolher ? <Ruler size={17} strokeWidth={1.8} aria-hidden /> : <ShoppingBag size={17} strokeWidth={1.8} aria-hidden />}
                {precisaEscolher ? `Escolha ${(product.variantLabel ?? "o tamanho").toLowerCase()}` : "Adicionar à sacola"}
              </button>
              <button
                type="button"
                aria-label={favorito ? "Tirar dos favoritos" : "Salvar nos favoritos"}
                onClick={() => toggle(product.id)}
                className="grid h-[50px] w-[50px] cursor-pointer place-items-center rounded-full border-[1.5px] border-line-strong bg-white text-teal-soft"
              >
                <Heart size={20} strokeWidth={1.8} fill={favorito ? "#5FB8B0" : "none"} />
              </button>
            </div>
          ) : (
            <p className="m-0 rounded-2xl bg-mist px-4 py-3 text-[14px] text-text-2">Indisponível no momento.</p>
          )}

          <div className="flex flex-wrap gap-2">
            {[
              { Icon: Gem, t: "Feita sob encomenda" },
              { Icon: ShieldCheck, t: "Pagamento seguro" },
              { Icon: RefreshCw, t: "Troca em 7 dias" },
            ].map(({ Icon, t }) => (
              <span key={t} className="flex items-center gap-1.5 rounded-full bg-mist-2 px-3 py-1.5 text-[12.5px] font-medium text-text-2">
                <Icon size={13} strokeWidth={1.8} className="text-teal" />
                {t}
              </span>
            ))}
          </div>

          <Link to={`/produto/${product.slug}`} onClick={fechar} className="w-fit text-[13px] font-semibold tracking-[0.1em] text-teal uppercase hover:text-teal-dark">
            Ver todos os detalhes →
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
