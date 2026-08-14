import { STEPS } from "../data/content";
import { ICONS } from "./icons";
import Reveal from "./Reveal";

export default function HowItWorks() {
  return (
    <section className="border-t border-blush-2 bg-paper px-6 py-[92px] sm:px-16 lg:px-24">
      <div className="mb-[54px] flex flex-wrap items-end justify-between gap-[30px]">
        <div className="max-w-[620px]">
          <span className="font-sans text-[10.5px] font-semibold tracking-[0.26em] text-wine uppercase">Do esboço à sua mão</span>
          <h2 className="m-0 mt-3.5 font-serif text-[clamp(30px,3.2vw,44px)] leading-[1.12] font-normal">Como funciona a encomenda</h2>
          <p className="m-0 mt-4 max-w-[480px] text-[14.5px] leading-relaxed text-ink-soft">Quatro passos, sem pressa: a gente combina cada detalhe antes de encostar na peça.</p>
        </div>
        <span className="rounded-full border border-rose px-5 py-2.5 text-[11px] font-medium tracking-[0.16em] whitespace-nowrap text-ink uppercase">Prazo médio · 7 a 15 dias úteis</span>
      </div>
      <div className="relative">
        <div className="absolute top-[46px] right-0 left-0 h-px bg-[linear-gradient(90deg,#FDCAE1,#E3B1C8,#FDCAE1)]" />
        <div className="relative grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => {
            const Icon = ICONS[s.icon];
            return (
              <Reveal key={s.n} delay={i * 100} className="flex flex-col gap-5">
                <div className="flex items-center gap-3.5">
                  <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full border border-blush-2 bg-cream text-wine">
                    <Icon className="flex h-[22px] w-[22px]" strokeWidth={1.6} />
                  </span>
                  <span className="font-serif text-[46px] leading-none text-blush-2">{s.n}</span>
                </div>
                <div className="flex flex-col gap-2.5 pr-3.5">
                  <h3 className="m-0 text-sm font-semibold tracking-[0.06em] text-ink">{s.title}</h3>
                  <p className="m-0 text-[13.5px] leading-relaxed text-ink-soft">{s.desc}</p>
                  <span className="mt-1 text-[11px] tracking-[0.14em] text-mauve uppercase">{s.meta}</span>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
