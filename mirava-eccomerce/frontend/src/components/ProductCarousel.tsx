import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "./ProductCard";
import { CatalogoCarregando } from "./EstadosCatalogo";
import { useProdutos } from "../catalogo/hooks";

export default function ProductCarousel() {
  const [index, setIndex] = useState(0);
  const { dado: produtos, carregando, erro } = useProdutos({ destaque: true, limite: 12 });

  // A vitrine não pode quebrar a home. Se falhar ou não houver destaque
  // marcado, a seção simplesmente não aparece.
  if (erro || (!carregando && produtos.length === 0)) return null;

  const maxIndex = Math.max(0, produtos.length - 4);

  return (
    <section className="overflow-hidden px-6 py-20 sm:px-16 lg:px-24">
      <div className="mb-[34px] flex items-end justify-between gap-5">
        <div>
          <span className="font-script text-[26px] tracking-[0.06em] text-wine">Seleção</span>
          <h2 className="m-0 mt-1 font-serif text-[32px] font-normal">Escolhidas a dedo</h2>
        </div>
        {produtos.length > 4 && (
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              aria-label="Anterior"
              className="flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-full border border-rose bg-none text-ink hover:border-wine hover:bg-cream"
            >
              <ChevronLeft className="pointer-events-none flex h-[17px] w-[17px]" strokeWidth={1.6} />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(maxIndex, i + 1))}
              aria-label="Próximo"
              className="flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-full border border-rose bg-none text-ink hover:border-wine hover:bg-cream"
            >
              <ChevronRight className="pointer-events-none flex h-[17px] w-[17px]" strokeWidth={1.6} />
            </button>
          </div>
        )}
      </div>

      {carregando ? (
        <div className="grid grid-cols-2 gap-[22px] md:grid-cols-4">
          <CatalogoCarregando quantidade={4} />
        </div>
      ) : (
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{ transform: `translateX(-${index * 25}%)` }}
          >
            {produtos.map((p) => (
              <div key={p.id} className="w-1/2 shrink-0 pr-5 md:w-1/4">
                <ProductCard produto={p} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
