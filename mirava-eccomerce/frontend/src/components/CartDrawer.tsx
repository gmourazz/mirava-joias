import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Plus, Minus, Lock, Gift } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useProducts } from "../catalogo/hooks";
import { imageUrl } from "../catalogo/consultas";
import { img } from "../lib/images";
import { freeShippingAbove } from "../lib/frete";
import { formatarBRL, temDescontoPix, textoParcelas, textoPix } from "../lib/dinheiro";

// Sacola do design v5: painel flutuante com cantos arredondados, barra de
// frete grátis no topo e sugestões baratas para completar o valor.
//
// Frete e cupom não aparecem aqui: o frete depende do CEP e é calculado no
// checkout, pela API.

export default function CartDrawer() {
  const { cartOpen, closeCart, items, addItem, removeItem, updateQuantity, subtotalCents, itemCount } = useCart();
  const navigate = useNavigate();

  // O limite do frete grátis vem da API, não de constante daqui: é o mesmo
  // número que o servidor usa para cobrar. Duas cópias seriam duas verdades.
  const [limiteFrete, setLimiteFrete] = useState(0);
  useEffect(() => {
    if (cartOpen) void freeShippingAbove().then(setLimiteFrete);
  }, [cartOpen]);

  const faltaFrete = limiteFrete - subtotalCents;
  const mostrarSugestoes = cartOpen && items.length > 0 && limiteFrete > 0 && faltaFrete > 0;
  const { data: maisVendidos } = useProducts(mostrarSugestoes ? { bestSellers: true, limit: 16 } : { limit: 0 });

  if (!cartOpen) return null;

  // Sugestão que ajuda a chegar no frete grátis sem empurrar peça cara:
  // até o que falta (+R$25 de folga) ou R$60, o que for maior. Peça com
  // tamanho fica de fora — precisa escolher o tamanho na página dela.
  const tetoSugestao = Math.max(6000, faltaFrete + 2500);
  const naSacola = new Set(items.map((i) => i.productId));
  const sugestoes = mostrarSugestoes
    ? maisVendidos
        .filter((p) => p.available && p.variants.length === 0 && !naSacola.has(p.id) && p.priceCents <= tetoSugestao)
        .sort((a, b) => a.priceCents - b.priceCents)
        .slice(0, 4)
    : [];

  function irParaCheckout() {
    closeCart();
    navigate("/checkout");
  }

  const progressoFrete = limiteFrete > 0 ? Math.min(100, (subtotalCents / limiteFrete) * 100) : 0;

  return (
    <div>
      <div className="animate-fade-in fixed inset-0 z-[70] bg-teal-dark/35" onClick={closeCart} />

      <aside className="animate-drawer fixed top-3 right-3 bottom-3 z-[71] flex w-[min(440px,calc(100%-24px))] flex-col overflow-hidden rounded-[30px] bg-white">
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h3 className="m-0 font-serif text-[28px] leading-none font-normal text-teal-dark">
            Sua sacola <span className="font-sans text-[15px] text-muted">({itemCount})</span>
          </h3>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Fechar"
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-none bg-chip text-text"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        {items.length > 0 && limiteFrete > 0 && (
          <div className="mx-6 rounded-[20px] bg-mist-2 p-4">
            <p className="m-0 text-[13.5px] text-text-2">
              {faltaFrete > 0 ? (
                <>
                  Faltam <strong className="text-teal">{formatarBRL(faltaFrete)}</strong> para ganhar frete grátis
                </>
              ) : (
                <strong className="text-teal">✦ Você ganhou frete grátis!</strong>
              )}
            </p>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-teal transition-[width] duration-600" style={{ width: `${progressoFrete}%` }} />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 pt-4 pb-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-mist-3">
                <Gift size={26} strokeWidth={1.5} className="text-teal" />
              </div>
              <p className="m-0 font-serif text-[24px] text-teal-dark">Sua sacola está vazia</p>
              <button
                type="button"
                onClick={() => {
                  closeCart();
                  navigate("/categoria/colecoes/todos");
                }}
                className="cursor-pointer rounded-full border-none bg-teal px-6 py-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-teal-dark"
              >
                Ver as queridinhas
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {items.map((item) => (
                <div key={item.key} className="animate-fade-in flex gap-3.5">
                  <img
                    src={item.image ?? img("cart-item")}
                    alt=""
                    className="h-[84px] w-[84px] shrink-0 rounded-[18px] bg-mist-3 object-cover"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[14.5px] font-medium text-text">{item.name}</span>
                      <span className="shrink-0 text-[14.5px] font-bold text-teal">
                        {formatarBRL(item.priceCents * item.quantity)}
                      </span>
                    </div>
                    {item.size && <span className="text-[12.5px] text-muted">Tam. {item.size}</span>}
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center gap-1 rounded-full bg-chip p-1">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.key, item.quantity - 1)}
                          aria-label="Diminuir"
                          className="grid h-7 w-7 cursor-pointer place-items-center rounded-full border-none bg-white text-text"
                        >
                          <Minus size={13} strokeWidth={2} />
                        </button>
                        <span className="min-w-6 text-center text-[13px] font-semibold text-text">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.key, item.quantity + 1)}
                          aria-label="Aumentar"
                          className="grid h-7 w-7 cursor-pointer place-items-center rounded-full border-none bg-white text-text"
                        >
                          <Plus size={13} strokeWidth={2} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        className="cursor-pointer border-none bg-transparent p-0 text-[12.5px] font-medium text-teal-mid hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {sugestoes.length > 0 && (
                <div className="mt-2 grid gap-2.5">
                  <span className="text-[13px] font-semibold text-text-2">Complete e ganhe frete grátis:</span>
                  <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
                    {sugestoes.map((p) => {
                      const cover = imageUrl(p.images[0]);
                      return (
                        <div key={p.id} className="grid w-32 shrink-0 gap-1.5">
                          <span className="aspect-square overflow-hidden rounded-2xl bg-mist-3">
                            {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
                          </span>
                          <span className="truncate text-[12.5px] text-text">{p.name}</span>
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-bold text-teal">{formatarBRL(p.priceCents)}</span>
                            <button
                              type="button"
                              aria-label={`Adicionar ${p.name}`}
                              onClick={() =>
                                addItem({
                                  productId: p.id,
                                  slug: p.slug,
                                  name: p.name,
                                  image: cover,
                                  priceCents: p.priceCents,
                                  size: null,
                                })
                              }
                              className="grid h-[26px] w-[26px] cursor-pointer place-items-center rounded-full border-none bg-teal text-white"
                            >
                              <Plus size={14} strokeWidth={2.2} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-line px-6 pt-4 pb-6">
            <div className="flex items-baseline justify-between text-[14px] text-text-2">
              <span>Subtotal</span>
              <span className="text-[20px] font-bold text-text">{formatarBRL(subtotalCents)}</span>
            </div>
            <div className="mt-1 flex flex-col items-end gap-0.5 text-[12.5px]">
              <span className="text-muted">{textoParcelas(subtotalCents)}</span>
              {temDescontoPix && <span className="font-semibold text-teal">{textoPix(subtotalCents)}</span>}
            </div>
            <p className="m-0 mt-2 text-[12px] text-muted">Frete calculado pelo CEP na finalização.</p>

            <button
              type="button"
              onClick={irParaCheckout}
              className="mt-4 w-full cursor-pointer rounded-full border-none bg-teal p-[17px] text-[15px] font-semibold text-white transition-colors hover:bg-teal-dark"
            >
              Finalizar compra
            </button>
            <p className="m-0 mt-3 flex items-center justify-center gap-1.5 text-[12px] text-muted">
              <Lock size={12} strokeWidth={1.8} />
              Compra 100% segura
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
