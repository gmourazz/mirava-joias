import { X, Clock, Plus, Lock } from "lucide-react";
import { useCart } from "../context/CartContext";
import { img } from "../lib/images";

export default function CartDrawer() {
  const { cartOpen, closeCart } = useCart();

  if (!cartOpen) return null;

  return (
    <div>
      <div className="animate-fade-in fixed inset-0 z-[60] bg-plum/28 backdrop-blur-[3px]" onClick={closeCart} />
      <div className="animate-slide-in fixed top-0 right-0 bottom-0 z-[61] flex w-[420px] max-w-[94vw] flex-col bg-paper shadow-[-30px_0_80px_-50px_rgba(92,42,70,0.5)]">
        <div className="flex items-start justify-between px-[30px] pt-7 pb-0">
          <div className="flex flex-col gap-1.5">
            <span className="font-serif text-[12.5px] font-semibold tracking-[0.28em] text-mauve uppercase">Mirava</span>
            <h3 className="m-0 font-serif text-[27px] leading-none font-normal">Sua encomenda</h3>
          </div>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Fechar"
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-blush-2 bg-none text-ink cursor-pointer hover:border-wine hover:bg-cream"
          >
            <X className="pointer-events-none flex h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>

        <div className="mx-[30px] mt-[22px] flex items-center gap-2.5 rounded-full bg-cream px-4 py-3">
          <Clock className="flex h-[15px] w-[15px] shrink-0 text-wine" strokeWidth={1.6} />
          <span className="text-[11.5px] text-ink-soft">Feita sob medida · produção em 7 a 15 dias úteis</span>
        </div>

        <div className="flex-1 overflow-y-auto px-[30px] py-[26px]">
          <div className="flex gap-4">
            <img src={img("cart-item")} alt="" className="h-[110px] w-[88px] shrink-0 rounded-[44px_44px_8px_8px] object-cover" />
            <div className="flex flex-1 flex-col gap-2">
              <span className="font-serif text-[19px] leading-tight">Anel Enlace fino</span>
              <span className="text-[11.5px] leading-relaxed text-ink-soft">
                Prata 925 · tam. 16
                <br />
                Gravação: <em className="text-ink italic">“sempre”</em>
              </span>
              <div className="mt-1 flex items-center justify-between">
                <div className="flex items-center gap-3 rounded-full border border-blush-2 px-3 py-1.5">
                  <span className="cursor-pointer text-sm text-mauve">−</span>
                  <span className="min-w-2.5 text-center text-[12.5px]">1</span>
                  <span className="cursor-pointer text-sm text-wine">+</span>
                </div>
                <span className="font-serif text-[19px]">R$ 289,00</span>
              </div>
            </div>
          </div>

          <div className="my-[26px] h-px bg-blush-2" />

          <span className="font-serif text-[12.5px] font-semibold tracking-[0.24em] text-mauve uppercase">Combina com</span>
          <div className="mt-3.5 flex items-center gap-3.5">
            <img src={img("cart-suggest")} alt="" className="h-[62px] w-[62px] shrink-0 rounded-[31px_31px_6px_6px] object-cover" />
            <div className="flex flex-1 flex-col gap-1">
              <span className="font-serif text-[17px]">Corrente Enlace 40cm</span>
              <span className="text-xs text-ink-soft">R$ 219,00 · prata 925</span>
            </div>
            <button
              type="button"
              aria-label="Adicionar"
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-rose bg-none text-wine cursor-pointer hover:border-wine hover:bg-cream"
            >
              <Plus className="pointer-events-none flex h-[15px] w-[15px]" strokeWidth={1.6} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3.5 border-t border-blush-2 px-[30px] pt-6 pb-7">
          <div className="flex items-baseline justify-between">
            <span className="text-xs tracking-[0.16em] text-ink-soft uppercase">Subtotal</span>
            <span className="font-serif text-[26px]">R$ 289,00</span>
          </div>
          <div className="flex justify-between text-[11.5px] text-ink-soft">
            <span>6x de R$ 48,17 sem juros</span>
            <span className="text-wine">R$ 274,55 no PIX</span>
          </div>
          <button
            type="button"
            className="flex items-center justify-center gap-2.5 rounded-full border-none bg-wine p-4 font-serif text-sm font-semibold tracking-[0.2em] text-white uppercase cursor-pointer hover:bg-wine-dark"
          >
            <Lock className="pointer-events-none flex h-[15px] w-[15px]" strokeWidth={1.6} />
            Finalizar compra
          </button>
          <span className="text-center text-[11px] text-mauve">Pagamento seguro no site · confirmamos os detalhes por e-mail</span>
        </div>
      </div>
    </div>
  );
}
