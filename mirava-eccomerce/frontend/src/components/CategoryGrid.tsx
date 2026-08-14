import { useNavigate } from "react-router-dom";
import { ROTULO_CATEGORIA, type Categoria } from "../catalogo/tipos";
import { img } from "../lib/images";
import Reveal from "./Reveal";

// Só as categorias que têm arte própria em src/assets/images/cat-*.webp.
// Ao adicionar uma nova aqui, adicione a imagem e registre no POOL de
// lib/images.ts — senão o card aparece quebrado.
const DESTAQUES: Categoria[] = ["aneis", "colares", "pulseiras", "berloques"];

export default function CategoryGrid() {
  const navigate = useNavigate();

  return (
    <section className="px-6 py-20 sm:px-16 lg:px-24">
      <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
        <h2 className="m-0 font-serif text-[32px] font-normal">Escolha por onde começar</h2>
        <span className="text-[13px] text-ink-soft">Cada categoria pode ser feita em prata 925 ou banhada a ouro</span>
      </div>
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {DESTAQUES.map((c, i) => (
          <Reveal key={c} delay={i * 120} className="zoom-on-hover">
            <button
              type="button"
              onClick={() => navigate(`/categoria/colecoes/${c}`)}
              className="flex w-full cursor-pointer flex-col gap-3.5 border-none bg-none p-0 text-left"
            >
              <span className="relative block aspect-[3/4] w-full overflow-hidden rounded-[160px_160px_14px_14px]">
                <img src={img(`cat-${c}`)} alt="" className="block h-full w-full object-cover" />
                <span className="absolute bottom-3 left-3 rounded-full bg-paper px-4 py-2 text-[10px] tracking-[0.18em] text-wine uppercase">Sob encomenda</span>
              </span>
              <span className="font-serif text-[19px] text-ink">{ROTULO_CATEGORIA[c]}</span>
            </button>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
