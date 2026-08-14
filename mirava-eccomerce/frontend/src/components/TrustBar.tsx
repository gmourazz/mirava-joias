import { TRUST } from "../data/content";
import { ICONS } from "./icons";
import Reveal from "./Reveal";

export default function TrustBar() {
  return (
    <section className="border-b border-blush-2 px-6 py-11 sm:px-16 lg:px-24">
      <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-4">
        {TRUST.map((t, i) => {
          const Icon = ICONS[t.icon];
          return (
            <Reveal key={t.title} delay={i * 80} className="flex items-center gap-3">
              <Icon className="flex h-[22px] w-[22px] shrink-0 text-wine" strokeWidth={1.6} />
              <div className="flex flex-col">
                <span className="text-[12.5px] tracking-[0.08em] text-ink uppercase">{t.title}</span>
                <span className="text-xs text-ink-soft">{t.desc}</span>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
