// Dúvidas frequentes na home, no acordeão do v5: cada pergunta num cartão
// arredondado que fica levemente tingido quando aberto, com o "+" girando
// 45°. A abertura anima a altura com o truque do grid (0fr → 1fr).

import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { FAQ } from "../data/content";
import SectionHeading from "./SectionHeading";

export default function Faq() {
  const [aberta, setAberta] = useState<number | null>(0);

  return (
    <section id="duvidas" className="mx-auto grid max-w-[1360px] scroll-mt-32 gap-2 px-[clamp(16px,3vw,40px)] pt-20">
      <SectionHeading eyebrow="Antes de comprar" title="Dúvidas frequentes" align="center" />

      <div className="grid content-start gap-3">
        {FAQ.slice(0, 6).map((item, i) => {
          const ativa = aberta === i;
          return (
            <div key={item.q} className={`rounded-[22px] border border-line transition-colors ${ativa ? "bg-[#F7FAFA]" : "bg-white"}`}>
              <button
                type="button"
                onClick={() => setAberta((o) => (o === i ? null : i))}
                aria-expanded={ativa}
                className="flex w-full cursor-pointer items-center justify-between gap-4 border-none bg-transparent px-[22px] py-5 text-left text-[15.5px] font-semibold text-text"
              >
                {item.q}
                <span
                  aria-hidden
                  className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-mist text-teal transition-transform duration-300 ${ativa ? "rotate-45" : ""}`}
                >
                  <Plus size={15} strokeWidth={2} />
                </span>
              </button>
              <div className="grid transition-[grid-template-rows] duration-500 ease-out" style={{ gridTemplateRows: ativa ? "1fr" : "0fr" }}>
                <div className="overflow-hidden">
                  <p className="m-0 px-[22px] pb-5 text-[14.5px] leading-[1.7] text-text-2">{item.a}</p>
                </div>
              </div>
            </div>
          );
        })}
        <Link to="/perguntas-frequentes" className="mt-1 w-fit text-[12px] font-semibold tracking-[0.14em] text-teal uppercase hover:text-teal-dark">
          Ver todas as perguntas →
        </Link>
      </div>
    </section>
  );
}
