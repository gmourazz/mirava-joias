// As duas linhas da loja — prata e banhado a ouro.
//
// Versão enxuta: fundo claro, tipografia contida e uma foto real por linha.
// A seção existe para dizer que há dois acabamentos e levar a pessoa adiante —
// não para ocupar meia tela. Quanto mais quieta, mais cara ela parece.
//
// A separação da grade de categorias é feita só com espaço e um fio fino:
// título de seção aqui deixaria o bloco pesado demais para o que ele diz.
//
// As fotos vêm do catálogo real, filtradas por metal; se a API falhar, cai na
// arte estática de src/assets/images/.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LINES } from "../data/content";
import { listProducts, imageUrl } from "../catalogo/consultas";
import { img } from "../lib/images";
import Reveal from "./Reveal";

export default function LinesSection() {
  const [fotos, setFotos] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let vivo = true;
    Promise.all(
      LINES.map(async (ln) => {
        try {
          const pecas = await listProducts({ metal: ln.menuKey, limit: 12 });
          const comFoto = pecas.find((p) => imageUrl(p.images[0]));
          return [ln.menuKey, imageUrl(comFoto?.images[0])] as const;
        } catch {
          return [ln.menuKey, null] as const;
        }
      }),
    ).then((pares) => {
      if (vivo) setFotos(Object.fromEntries(pares));
    });
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <section className="px-6 sm:px-16 lg:px-24">
      <div className="border-t border-blush-2 pt-14 pb-20">
        <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2">
          {LINES.map((ln, i) => (
            <Reveal key={ln.seed} delay={i * 100}>
              <Link to={`/categoria/${ln.menuKey}/todos`} className="group flex items-center gap-5">
                <span className="block h-[104px] w-[104px] shrink-0 overflow-hidden rounded-[14px] bg-cream sm:h-[116px] sm:w-[116px]">
                  <img
                    src={fotos[ln.menuKey] ?? img(ln.seed)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-[700ms] ease-out group-hover:scale-[1.07]"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[9.5px] font-medium tracking-[0.26em] text-mauve uppercase">
                    {ln.kicker}
                  </span>
                  <span className="mt-1.5 block font-serif text-[21px] leading-tight text-ink">
                    {ln.title}
                  </span>
                  <span className="mt-2.5 inline-flex flex-col gap-1">
                    <span className="text-[11px] tracking-[0.18em] text-wine uppercase">
                      {ln.cta}
                    </span>
                    <span className="h-px w-full origin-left scale-x-[0.45] bg-wine transition-transform duration-500 ease-out group-hover:scale-x-100" />
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
