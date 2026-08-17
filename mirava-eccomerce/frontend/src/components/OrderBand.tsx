import { ORDER_FACTS } from "../data/content";
import { ICONS } from "./icons";

export default function OrderBand() {
  return (
    <section className="grid grid-cols-1 items-center gap-10 bg-plum px-6 py-11 text-blush sm:px-16 md:grid-cols-[1.2fr_1fr] lg:px-24">
      <div className="flex flex-col gap-3">
        <span className="text-[10px] tracking-[0.24em] text-rose uppercase">Sobre a Mirava</span>
        <h2 className="m-0 font-serif text-[clamp(24px,2.6vw,34px)] leading-tight font-normal">
          Qualidade em cada <em className="text-rose italic">detalhe</em>
        </h2>
        <p className="m-0 max-w-[520px] text-[14.5px] leading-relaxed text-blush/82">
          Peças com acabamento cuidadoso e garantia, pensadas para acompanhar você no dia a dia.
        </p>
      </div>
      <div className="flex flex-col gap-3.5">
        {ORDER_FACTS.map((f, i) => {
          const Icon = ICONS[f.icon];
          return (
            <div key={i} className="flex items-center gap-3 border-b border-blush/22 pb-3">
              <Icon className="flex h-[18px] w-[18px] shrink-0 text-rose" strokeWidth={1.6} />
              <span className="text-[13.5px] text-blush/92">{f.text}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
