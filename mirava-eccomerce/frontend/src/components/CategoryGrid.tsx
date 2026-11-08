// "Encontre a sua joia" (v5): categorias em círculos numa linha que rola na
// horizontal.
//
// As categorias principais têm foto escolhida e fixa (FOTO_FIXA): peça nova no
// catálogo não troca o círculo. Anéis e Colares usam fotos da dona, em
// src/assets/images/cat-*.webp. Categoria sem foto fixa usa a peça mais nova
// que tenha imagem; se a busca falhar, círculo liso.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCategorias } from "../catalogo/categorias";
import { listProducts, imageUrl } from "../catalogo/consultas";
import { img } from "../lib/images";
import SectionHeading from "./SectionHeading";

const FOTO_FIXA: Record<string, string | null> = {
  aneis: img("cat-aneis"),
  berloques: imageUrl("/images/BER29/1.jpeg"),
  brincos: imageUrl("/images/BR81/1.jpg"),
  colares: img("cat-colares"),
  conjuntos: imageUrl("/images/CJ94/1.jpg"),
  pulseiras: imageUrl("/images/BRA78/1.jpg"),
};

export default function CategoryGrid() {
  const [fotos, setFotos] = useState<Record<string, string | null>>({});
  const cats = useCategorias().filter((c) => c.slug !== "outros");
  const slugs = cats.map((c) => c.slug).join(",");

  useEffect(() => {
    let ativo = true;
    void Promise.all(
      slugs.split(",").filter(Boolean).map(async (c) => {
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
  }, [slugs]);

  return (
    <section className="mx-auto max-w-[1360px] px-[clamp(16px,3vw,40px)] pt-[72px]">
      <SectionHeading eyebrow="Explore" title="Encontre a sua joia" align="center" />
      <div className="grid auto-cols-[minmax(112px,1fr)] grid-flow-col gap-[18px] overflow-x-auto pb-2 [scrollbar-width:none]">
        {cats.map(({ slug: c, label }) => {
          const foto = FOTO_FIXA[c] ?? fotos[c];
          return (
            <Link key={c} to={`/categoria/colecoes/${c}`} className="group flex flex-col items-center gap-3 text-text hover:text-teal">
              <span className="block aspect-square w-full max-w-[148px] rounded-full border-[1.5px] border-line-strong p-[5px] transition-[transform,border-color,box-shadow] duration-300 group-hover:-translate-y-1.5 group-hover:border-teal group-hover:shadow-[0_14px_30px_rgba(15,110,115,0.16)]">
                <span className="block h-full w-full overflow-hidden rounded-full bg-mist-3">
                  {foto && <img src={foto} alt="" loading="lazy" className="h-full w-full object-cover" />}
                </span>
              </span>
              <span className="text-[11.5px] font-semibold tracking-[0.16em] uppercase">{label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
