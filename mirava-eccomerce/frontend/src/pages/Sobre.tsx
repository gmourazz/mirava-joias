import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Gem, Sparkles } from "lucide-react";
import PageHero from "../components/PageHero";
import Reveal from "../components/Reveal";
import { imageUrl } from "../catalogo/consultas";
import { useShowcaseProducts } from "../catalogo/hooks";
import { img } from "../lib/images";
import { ORDER_FACTS } from "../data/content";
import { ICONS } from "../components/icons";

const MOSAIC_SEEDS = ["jw2", "jw4", "jw6", "jw8"];

export default function Sobre() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const showcase = useShowcaseProducts(6);
  const fotoLado = (imageUrl(showcase[0]?.images[0]) ?? undefined) || img("jw3");
  const mosaico = MOSAIC_SEEDS.map(
    (seed, i) => (showcase[i + 1] && imageUrl(showcase[i + 1].images[0])) || img(seed),
  );

  return (
    <div>
      <PageHero icon={Sparkles} kicker="Nossa história" title="Uma joia deveria significar algo">
        Antes de ser bonita, feita para você. Prata 925 e banho de ouro,
        sob encomenda.
      </PageHero>

      {/* Citação de abertura */}
      <section className="px-6 pt-[92px] pb-8 sm:px-16 lg:px-24">
        <Reveal className="mx-auto max-w-[760px] text-center">
          <p className="m-0 font-serif text-[clamp(22px,2.6vw,32px)] leading-[1.35] font-normal text-wine-dark italic">
            "Uma joia deveria significar alguma coisa antes de ser bonita.
            Por isso a sua nasce especialmente pra sua história."
          </p>
          <span className="mt-6 inline-flex items-center gap-2.5">
            <span className="h-px w-9 bg-rose" />
            <Sparkles className="h-3.5 w-3.5 text-rose" strokeWidth={1.6} />
            <span className="h-px w-9 bg-rose" />
          </span>
        </Reveal>
      </section>

      {/* Bloco assimétrico: texto + foto real */}
      <section className="px-6 py-16 sm:px-16 lg:px-24">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 md:grid-cols-[1.1fr_0.9fr] md:gap-16">
          <Reveal className="flex flex-col gap-5">
            <span className="font-sans text-[10.5px] font-semibold tracking-[0.28em] text-wine uppercase">
              Como fazemos
            </span>
            <p className="m-0 text-[15.5px] leading-relaxed text-ink-soft">
              Trabalhamos com prata 925 maciça e banho de ouro 18k sobre
              prata, com garantia de 12 meses no acabamento. São peças
              pensadas pra acompanhar o dia a dia sem perder o brilho e,
              quando você quer, pra levar junto uma inicial, uma data ou uma
              frase gravada à mão.
            </p>
            <p className="m-0 text-[15.5px] leading-relaxed text-ink-soft">
              Do pedido até a sua porta, acompanhamos cada etapa de perto:
              você recebe o código de rastreio assim que a peça sai e
              consegue ver o status a qualquer momento, direto na sua conta.
            </p>
            <Link
              to="/como-comprar"
              className="mt-1 w-fit border-b border-wine pb-0.5 font-serif text-[13.5px] tracking-[0.06em] text-wine transition-colors hover:border-wine-dark hover:text-wine-dark"
            >
              Ver como funciona o pedido →
            </Link>
          </Reveal>
          <Reveal delay={140} className="relative">
            <span className="pointer-events-none absolute -top-6 -right-6 h-full w-full rounded-[22px] border border-rose/50" />
            <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-cream shadow-[0_30px_60px_-30px_rgba(142,59,107,0.4)]">
              <img src={fotoLado} alt="" className="h-full w-full object-cover" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Valores — numerados, sem grade uniforme */}
      <section className="border-t border-blush-2 bg-cream/40 px-6 py-[88px] sm:px-16 lg:px-24">
        <Reveal className="mx-auto mb-14 max-w-[560px] text-center">
          <span className="font-script text-[22px] text-wine">O que sustenta cada peça</span>
        </Reveal>
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-3">
          {ORDER_FACTS.map((f, i) => {
            const Icon = ICONS[f.icon];
            return (
              <Reveal key={f.text} delay={i * 110} className="flex flex-col items-center text-center">
                <span
                  className="font-serif text-[46px] leading-none text-transparent"
                  style={{ WebkitTextStroke: "1px #E9A9C6" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="mt-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-wine ring-1 ring-rose/40">
                  <Icon className="h-[19px] w-[19px]" strokeWidth={1.6} />
                </span>
                <span className="mt-3.5 max-w-[200px] text-[13.5px] leading-snug text-ink">{f.text}</span>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Mosaico de fotos */}
      <section className="px-6 py-[88px] sm:px-16 lg:px-24">
        <Reveal className="mx-auto grid max-w-6xl grid-cols-4 gap-3 sm:gap-4">
          {mosaico.map((src, i) => (
            <span
              key={i}
              className={`block overflow-hidden rounded-[16px] bg-cream ${i % 2 === 0 ? "translate-y-4" : ""}`}
              style={{ aspectRatio: i % 2 === 0 ? "3/4" : "3/5" }}
            >
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </span>
          ))}
        </Reveal>

        <Reveal delay={120} className="mx-auto mt-16 flex max-w-5xl justify-center">
          <Link
            to="/categoria/colecoes/todos"
            className="group flex items-center gap-2.5 rounded-full bg-wine px-9 py-4 font-serif text-[14px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-wine-dark"
          >
            <Gem className="h-4 w-4" strokeWidth={1.7} />
            Conhecer as coleções
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
