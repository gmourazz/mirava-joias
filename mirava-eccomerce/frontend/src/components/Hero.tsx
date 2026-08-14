import { ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import { HERO_SLIDES } from "../data/content";
import { img } from "../lib/images";
import { useAutoCarousel } from "../hooks/useAutoCarousel";

export default function Hero() {
  const { index, prev, next } = useAutoCarousel(HERO_SLIDES.length, 6500);

  return (
    <section className="relative overflow-hidden bg-paper">
      <div className="flex transition-transform duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]" style={{ transform: `translateX(-${index * 100}%)` }}>
        {HERO_SLIDES.map((h) => (
          <div key={h.seed} className="relative h-[640px] min-w-full">
            <img src={img(h.seed)} alt="" className="absolute inset-0 block h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(92,42,70,0.78)_0%,rgba(92,42,70,0.5)_45%,rgba(92,42,70,0.08)_100%)]" />
            <div className="absolute inset-0 flex max-w-[720px] flex-col justify-center gap-5 px-6 sm:px-16 lg:px-24">
              <span className="reveal in-view inline-flex w-fit items-center gap-2 rounded-full border border-blush-2/60 px-4 py-2 text-[10px] tracking-[0.2em] whitespace-nowrap text-blush-2 uppercase">
                <PenLine className="flex h-3 w-3" strokeWidth={1.6} />
                {h.kicker}
              </span>
              <span className="reveal in-view font-script text-[clamp(26px,3vw,38px)] leading-none tracking-[0.02em] text-white" style={{ transitionDelay: "80ms" }}>
                {h.script}
              </span>
              <h1 className="reveal in-view m-0 max-w-[560px] font-serif text-[clamp(32px,4vw,60px)] leading-[1.1] font-normal text-white [text-wrap:pretty]" style={{ transitionDelay: "160ms" }}>
                {h.title}
              </h1>
              <p className="reveal in-view m-0 max-w-[430px] text-[15.5px] leading-relaxed text-white" style={{ transitionDelay: "240ms" }}>
                {h.text}
              </p>
              <div className="reveal in-view mt-1.5 flex flex-wrap gap-3" style={{ transitionDelay: "320ms" }}>
                <button type="button" className="rounded-full border-none bg-wine px-[30px] py-[15px] font-serif text-sm font-semibold tracking-[0.2em] text-white uppercase cursor-pointer hover:bg-wine-dark">
                  {h.cta}
                </button>
                <button type="button" className="rounded-full border border-white/55 bg-white/12 px-[30px] py-[15px] font-serif text-sm font-semibold tracking-[0.2em] text-white uppercase cursor-pointer hover:bg-white/22">
                  {h.cta2}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={prev}
        aria-label="Anterior"
        className="absolute top-1/2 left-4 flex h-[46px] w-[46px] -translate-y-1/2 items-center justify-center rounded-full border border-white/50 bg-white/16 text-white backdrop-blur-sm cursor-pointer hover:border-wine hover:bg-cream"
      >
        <ChevronLeft className="pointer-events-none flex h-[17px] w-[17px]" strokeWidth={1.6} />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Próximo"
        className="absolute top-1/2 right-4 flex h-[46px] w-[46px] -translate-y-1/2 items-center justify-center rounded-full border border-white/50 bg-white/16 text-white backdrop-blur-sm cursor-pointer hover:border-wine hover:bg-cream"
      >
        <ChevronRight className="pointer-events-none flex h-[17px] w-[17px]" strokeWidth={1.6} />
      </button>
    </section>
  );
}
