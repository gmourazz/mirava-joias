import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Plus, Minus, Lock, ShoppingBag, Truck, Check } from "lucide-react";
import { useCart } from "../context/CartContext";
import { img } from "../lib/images";
import { freeShippingAbove } from "../lib/frete";
import { formatarBRL, textoParcelas, textoPix } from "../lib/dinheiro";

export default function CartDrawer() {
  const { cartOpen, closeCart, items, removeItem, updateQuantity, subtotalCents } = useCart();
  const navigate = useNavigate();

  // O limite do frete grátis vem da API, não de constante daqui: é o mesmo
  // número que o servidor usa para cobrar. Duas cópias seriam duas verdades.
  const [limiteFrete, setLimiteFrete] = useState(0);
  useEffect(() => {
    if (cartOpen) void freeShippingAbove().then(setLimiteFrete);
  }, [cartOpen]);

  if (!cartOpen) return null;

  function irParaCheckout() {
    closeCart();
    navigate("/checkout");
  }

  const faltaFrete = limiteFrete - subtotalCents;
  const progressoFrete = limiteFrete > 0 ? Math.min(100, (subtotalCents / limiteFrete) * 100) : 0;

  return (
    <div>
      <div
        className="animate-fade-in fixed inset-0 z-[60] bg-plum/35 backdrop-blur-[3px]"
        onClick={closeCart}
      />

      <div className="animate-slide-in fixed top-0 right-0 bottom-0 z-[61] flex w-[440px] max-w-[94vw] flex-col bg-paper shadow-[-40px_0_90px_-50px_rgba(92,42,70,0.6)]">
        {/* Cabeçalho em vinho: o carrinho é o momento mais importante da visita,
            e um bloco escuro no topo ancora o painel em vez de deixá-lo
            flutuando em branco. Mesma família de cor do header do site. */}
        <div className="bg-gradient-to-br from-plum to-wine-dark px-8 pt-7 pb-6">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-2">
              <span className="font-sans text-[10px] font-medium tracking-[0.3em] text-blush-2/80 uppercase">
                Mirava
              </span>
              <h3 className="m-0 font-serif text-[30px] leading-none font-normal text-white">
                Sua encomenda
              </h3>
            </div>
            <button
              type="button"
              onClick={closeCart}
              aria-label="Fechar"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-blush-2/40 bg-none text-blush-2 transition-colors hover:border-blush-2 hover:bg-white/10 hover:text-white"
            >
              <X className="pointer-events-none h-4 w-4" strokeWidth={1.6} />
            </button>
          </div>

          {items.length > 0 && limiteFrete > 0 && (
            <div className="mt-6 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-[11.5px] text-blush-2">
                {faltaFrete > 0 ? (
                  <>
                    <Truck className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
                    <span>
                      Faltam{" "}
                      <strong className="font-medium text-white">{formatarBRL(faltaFrete)}</strong>{" "}
                      para o frete grátis
                    </span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    <span className="text-white">Frete grátis liberado</span>
                  </>
                )}
              </div>
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-blush-2 transition-[width] duration-500"
                  style={{ width: `${progressoFrete}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-8 pt-6 pb-7">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-cream">
                <ShoppingBag className="h-7 w-7 text-mauve" strokeWidth={1.2} />
              </div>
              <p className="m-0 font-serif text-[20px] text-ink">Sua sacola está vazia</p>
              <p className="m-0 max-w-[250px] text-[13px] leading-relaxed text-ink-soft">
                As peças que você escolher aparecem aqui, prontinhas para a encomenda.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <div
                  key={item.key}
                  className="group relative flex gap-4 rounded-[18px] border border-blush/70 bg-paper p-3.5 transition-shadow hover:shadow-[0_18px_40px_-28px_rgba(92,42,70,0.55)]"
                >
                  <img
                    src={item.image ?? img("cart-item")}
                    alt=""
                    className="h-[92px] w-[92px] shrink-0 rounded-[14px] object-cover"
                  />

                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-serif text-[17px] leading-tight text-ink">
                        {item.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        aria-label="Remover"
                        className="shrink-0 cursor-pointer border-none bg-none p-0.5 text-mauve opacity-0 transition-opacity group-hover:opacity-100 hover:text-wine focus:opacity-100"
                      >
                        <X className="pointer-events-none h-3.5 w-3.5" strokeWidth={1.6} />
                      </button>
                    </div>

                    {item.size && (
                      <span className="mt-1.5 w-fit rounded-full bg-cream px-2.5 py-0.5 text-[10.5px] tracking-[0.04em] text-ink-soft">
                        Tam. {item.size}
                      </span>
                    )}

                    <div className="mt-auto flex items-end justify-between pt-2">
                      <div className="flex items-center gap-1 rounded-full bg-cream p-1">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.key, item.quantity - 1)}
                          aria-label="Diminuir"
                          className="flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full border-none bg-paper text-mauve shadow-[0_1px_3px_rgba(92,42,70,0.12)] transition-colors hover:text-wine"
                        >
                          <Minus className="pointer-events-none h-3 w-3" strokeWidth={1.8} />
                        </button>
                        <span className="min-w-5 text-center text-[12.5px] text-ink">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.key, item.quantity + 1)}
                          aria-label="Aumentar"
                          className="flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full border-none bg-paper text-wine shadow-[0_1px_3px_rgba(92,42,70,0.12)]"
                        >
                          <Plus className="pointer-events-none h-3 w-3" strokeWidth={1.8} />
                        </button>
                      </div>

                      <div className="flex flex-col items-end">
                        {item.quantity > 1 && (
                          <span className="text-[10px] text-mauve">
                            {formatarBRL(item.priceCents)} cada
                          </span>
                        )}
                        <span className="text-[16px] leading-tight text-ink">
                          {formatarBRL(item.priceCents * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mesma pilha de preço da vitrine — valor, parcelas, Pix — nas mesmas
            fontes e tamanhos do ProductCard. A cliente acabou de ver esse bloco
            embaixo da peça; ele não pode mudar de cara dentro do carrinho. */}
        <div className="border-t border-blush px-8 pt-5 pb-7">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] tracking-[0.18em] text-ink-soft uppercase">Subtotal</span>
            <span className="text-[22px] leading-none text-ink">{formatarBRL(subtotalCents)}</span>
          </div>
          {subtotalCents > 0 && (
            <div className="mt-1.5 flex flex-col items-end gap-0.5">
              <span className="text-xs text-ink-soft">{textoParcelas(subtotalCents)}</span>
              <span className="text-xs text-wine">{textoPix(subtotalCents)}</span>
            </div>
          )}

          <button
            type="button"
            onClick={irParaCheckout}
            disabled={items.length === 0}
            className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-full border-none bg-wine p-4 font-serif text-[14px] font-semibold tracking-[0.2em] text-white uppercase transition-colors hover:bg-wine-dark disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Lock className="pointer-events-none h-[15px] w-[15px]" strokeWidth={1.6} />
            Finalizar compra
          </button>

          <p className="m-0 mt-3.5 text-center text-[10.5px] text-mauve">
            Pagamento 100% seguro
          </p>
        </div>
      </div>
    </div>
  );
}
