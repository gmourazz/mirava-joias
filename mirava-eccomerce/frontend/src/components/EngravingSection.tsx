import { useState } from "react";
import { ENGRAVE_STYLES } from "../data/content";
import { img } from "../lib/images";

export default function EngravingSection() {
  const [styleIdx, setStyleIdx] = useState(0);
  const [text, setText] = useState("Ana");
  const style = ENGRAVE_STYLES[styleIdx];

  return (
    <section className="border-t border-blush-2 bg-cream px-6 py-[92px] sm:px-16 lg:px-24">
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-20">
        <div className="flex flex-col gap-[18px]">
          <span className="font-sans text-[10.5px] font-semibold tracking-[0.26em] text-wine uppercase">Sem custo extra</span>
          <h2 className="m-0 font-serif text-[clamp(30px,3.2vw,42px)] leading-[1.12] font-normal">Grave o que você não quer esquecer</h2>
          <p className="m-0 max-w-[440px] text-[14.5px] leading-relaxed text-ink-soft">Uma inicial, uma data, uma palavra. Escolha o estilo do traço e escreva abaixo para ver como fica na peça.</p>
          <div className="mt-1 flex flex-wrap gap-2.5">
            {ENGRAVE_STYLES.map((es, i) => (
              <button
                key={es.label}
                type="button"
                onClick={() => setStyleIdx(i)}
                className="cursor-pointer rounded-full border border-rose px-5 py-2.5 font-sans text-[11px] font-medium tracking-[0.14em] uppercase transition-colors duration-300"
                style={{
                  background: styleIdx === i ? "#8E3B6B" : "transparent",
                  color: styleIdx === i ? "#ffffff" : "#8E3B6B",
                }}
              >
                {es.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={14}
            placeholder="escreva aqui"
            className="mt-2 max-w-[320px] rounded-full border border-rose bg-paper px-[22px] py-3.5 font-sans text-[13.5px] text-ink"
          />
        </div>
        <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-[18px] bg-paper">
          <img src={img("jw1")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
          <div className="relative flex h-[210px] w-[210px] flex-col items-center justify-center gap-2 rounded-full bg-white/82 shadow-[0_20px_50px_-30px_rgba(92,42,70,0.5)] backdrop-blur-[2px]">
            <span className="font-sans text-[9px] tracking-[0.24em] text-mauve uppercase">prévia da gravação</span>
            <span
              style={{
                fontFamily: style.fontFamily,
                fontSize: style.fontSize,
                letterSpacing: style.letterSpacing,
                textTransform: style.uppercase ? "uppercase" : "none",
                color: "#8E3B6B",
                fontWeight: style.uppercase ? 500 : 400,
              }}
            >
              {text || "sua palavra"}
            </span>
            <span className="h-px w-[26px] bg-rose" />
            <span className="font-sans text-[9.5px] tracking-[0.16em] text-mauve uppercase">
              {["traço serifado", "traço manuscrito", "traço bastão"][styleIdx]}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
