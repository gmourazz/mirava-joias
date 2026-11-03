// "Encontre a sua joia" (v5): categorias em círculos numa linha que rola na
// horizontal.
//
// A foto de cada círculo vem do CATÁLOGO REAL, não de arte estática: buscamos
// algumas peças de cada categoria e usamos a primeira que tenha imagem. A
// vitrine mostra o que a loja realmente vende, e a arte não envelhece sozinha
// quando o catálogo muda. Se a busca falhar, cai na arte de
// src/assets/images/cat-*.webp quando existe; senão, círculo liso.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORY_LABEL, MENU_CATEGORIES } from "../catalogo/tipos";
import { listProducts, imageUrl } from "../catalogo/consultas";
import { img } from "../lib/images";
import SectionHeading from "./SectionHeading";

const ARTE: Record<string, string> = {
  aneis: img("cat-aneis"),
  colares: img("cat-colares"),
  pulseiras: img("cat-pulseiras"),
  berloques: img("cat-berloques"),
};

export default function CategoryGrid() {
  const [fotos, setFotos] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let ativo = true;
    void Promise.all(
      MENU_CATEGORIES.map(async (c) => {
        try {
          const pecas = await listProducts({ category: c, limit: 8 });
          return [c, imageUrl(pecas.find((p) => imageUrl(p.images[0]))?.images[0])] as const;
        } catch {
          return [c, null] as const;
        }
      }),
    ).then((pares) => ativo && setFotos(Object.fromEntries(pares)));
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <section className="mx-auto max-w-[1360px] px-[clamp(16px,3vw,40px)] pt-[72px]">
      <SectionHeading eyebrow="Explore" title="Encontre a sua joia" align="center" />
      <div className="grid auto-cols-[minmax(112px,1fr)] grid-flow-col gap-[18px] overflow-x-auto pb-2 [scrollbar-width:none]">
        {MENU_CATEGORIES.map((c) => {
          const foto = fotos[c] ?? ARTE[c];
          return (
            <Link key={c} to={`/categoria/colecoes/${c}`} className="group flex flex-col items-center gap-3 text-text hover:text-teal">
              <span className="block aspect-square w-full max-w-[148px] rounded-full border-[1.5px] border-line-strong p-[5px] transition-[transform,border-color,box-shadow] duration-300 group-hover:-translate-y-1.5 group-hover:border-teal group-hover:shadow-[0_14px_30px_rgba(15,110,115,0.16)]">
                <span className="block h-full w-full overflow-hidden rounded-full bg-mist-3">
                  {foto && <img src={foto} alt="" loading="lazy" className="h-full w-full object-cover" />}
                </span>
              </span>
              <span className="text-[11.5px] font-semibold tracking-[0.16em] uppercase">{CATEGORY_LABEL[c]}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
