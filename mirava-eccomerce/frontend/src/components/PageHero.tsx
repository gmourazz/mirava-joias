// Cabeçalho compartilhado pelas páginas institucionais (Sobre, Como comprar,
// Prazos, Fale conosco, Guia de tamanhos, Cuidados).
//
// A fileira de fotos no rodapé usa peças reais do catálogo (useShowcaseProducts)
// em vez de arte estática — é o que evita que seis páginas de texto pareçam
// seis variações do mesmo template genérico.

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { imageUrl } from "../catalogo/consultas";
import { useShowcaseProducts } from "../catalogo/hooks";
import { img } from "../lib/images";
import Reveal from "./Reveal";

interface PageHeroProps {
  icon: LucideIcon;
  kicker: string;
  title: string;
  children?: ReactNode;
}

const FALLBACK_SEEDS = ["jw1", "jw3", "jw5", "jw7"];

export default function PageHero({ icon: Icon, kicker, title, children }: PageHeroProps) {
  const showcase = useShowcaseProducts(4);
  const fotos = FALLBACK_SEEDS.map(
    (seed, i) => (showcase[i] && imageUrl(showcase[i].images[0])) || img(seed),
  );

  return (
    <section className="relative overflow-hidden border-b border-blush-2 bg-[linear-gradient(160deg,#FFF9FC_0%,#FFEDF5_55%,#FBD9E7_100%)] px-6 pt-[84px] pb-16 sm:px-16 lg:px-24">
      <span className="pointer-events-none absolute -top-32 -right-28 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(212,106,159,0.16),transparent_70%)] blur-2xl" />
      <span className="pointer-events-none absolute -bottom-32 -left-24 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(142,59,107,0.13),transparent_70%)] blur-2xl" />

      <Reveal className="relative mx-auto flex max-w-[680px] flex-col items-center gap-4 text-center">
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white/70 text-wine shadow-[0_14px_30px_-16px_rgba(142,59,107,0.4)] ring-1 ring-rose/50">
          <Icon className="h-[21px] w-[21px]" strokeWidth={1.5} />
        </span>
        <span className="font-script text-[24px] tracking-[0.06em] text-wine">{kicker}</span>
        <h1 className="m-0 font-serif text-[clamp(34px,4.2vw,54px)] leading-[1.05] font-normal text-ink [text-wrap:balance]">
          {title}
        </h1>
        <span className="flex items-center gap-2.5">
          <span className="h-px w-9 bg-rose" />
          <span className="h-[5px] w-[5px] rotate-45 bg-rose" />
          <span className="h-px w-9 bg-rose" />
        </span>
        {children && (
          <p className="m-0 max-w-[460px] text-[15px] leading-relaxed text-ink-soft">{children}</p>
        )}
      </Reveal>

      <Reveal delay={140} className="relative mx-auto mt-12 flex max-w-[420px] items-end justify-center -space-x-5">
        {fotos.map((src, i) => (
          <span
            key={i}
            className="block shrink-0 overflow-hidden rounded-full border-[3px] border-white bg-cream shadow-[0_16px_34px_-18px_rgba(142,59,107,0.5)] transition-transform duration-500 ease-out hover:z-10 hover:-translate-y-1.5"
            style={{
              width: i % 2 === 0 ? 84 : 68,
              height: i % 2 === 0 ? 84 : 68,
              zIndex: fotos.length - i,
            }}
          >
            <img src={src} alt="" className="h-full w-full object-cover" />
          </span>
        ))}
      </Reveal>
    </section>
  );
}
