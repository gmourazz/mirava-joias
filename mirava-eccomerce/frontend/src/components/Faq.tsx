// Dúvidas frequentes.
//
// Faixa colorida de largura total, com um ícone por pergunta. A abertura é
// animada com o truque do grid: a linha vai de `0fr` para `1fr`, o que anima
// altura sem precisar saber quantos pixels o texto ocupa — diferente de
// max-height chutado, que corta resposta longa ou deixa a animação lenta
// quando o texto é curto.

import { useState } from "react";
import {
  CreditCard,
  Mail,
  Plus,
  Ruler,
  Sparkles,
  Truck,
  PackageCheck,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { FAQ } from "../data/content";
import { LOJA } from "../config/loja";
import Reveal from "./Reveal";

// Um ícone por pergunta, na mesma ordem de data/content.ts. Ao acrescentar
// uma pergunta lá, acrescente o ícone aqui — o fallback é a estrelinha.
const ICONES: LucideIcon[] = [Truck, Truck, CreditCard, Ruler, Undo2, PackageCheck, Sparkles];

export default function Faq() {
  const [aberta, setAberta] = useState<number | null>(0);

  return (
    <section className="bg-[linear-gradient(180deg,#FFF3F8_0%,#FFE9F2_55%,#FFF3F8_100%)] px-6 py-[92px] sm:px-16 lg:px-24">
      <div className="mb-12 flex flex-col items-center text-center">
        <span className="font-script text-[28px] tracking-[0.06em] text-wine">Antes de comprar</span>
        <h2 className="m-0 mt-1 font-serif text-[clamp(30px,3.4vw,44px)] leading-[1.1] font-normal text-wine-dark">
          Dúvidas frequentes
        </h2>
        <span className="mt-5 flex items-center gap-2">
          <span className="h-px w-10 bg-rose" />
          <Sparkles className="h-3.5 w-3.5 text-rose" strokeWidth={1.6} />
          <span className="h-px w-10 bg-rose" />
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {FAQ.map((item, i) => {
          const ativa = aberta === i;
          const Icone = ICONES[i] ?? Sparkles;
          return (
            <Reveal key={item.q} delay={i * 55}>
              <div
                className="overflow-hidden rounded-[18px] border transition-all duration-500 ease-out"
                style={{
                  borderColor: ativa ? "#D46A9F" : "#FBD9E7",
                  background: ativa ? "#FFFFFF" : "rgba(255,255,255,0.55)",
                  boxShadow: ativa
                    ? "0 18px 40px -28px rgba(142,59,107,0.55)"
                    : "none",
                }}
              >
                <button
                  type="button"
                  onClick={() => setAberta((o) => (o === i ? null : i))}
                  aria-expanded={ativa}
                  className="group flex w-full cursor-pointer items-center gap-4 border-none bg-none px-5 py-5 text-left sm:gap-5 sm:px-7"
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-500 ease-out"
                    style={{
                      background: ativa ? "#8E3B6B" : "#FFE5F0",
                      color: ativa ? "#FFFFFF" : "#8E3B6B",
                      transform: ativa ? "scale(1.06)" : "scale(1)",
                    }}
                  >
                    <Icone className="h-[19px] w-[19px]" strokeWidth={1.6} />
                  </span>

                  <span
                    className="flex-1 font-serif text-[clamp(15.5px,1.5vw,18px)] leading-snug transition-colors duration-300"
                    style={{ color: ativa ? "#8E3B6B" : "#3B2430" }}
                  >
                    {item.q}
                  </span>

                  <span
                    className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full border transition-all duration-500 ease-out"
                    style={{
                      borderColor: ativa ? "#8E3B6B" : "#E9A9C6",
                      background: ativa ? "#8E3B6B" : "transparent",
                      color: ativa ? "#FFFFFF" : "#8E3B6B",
                      transform: ativa ? "rotate(135deg)" : "rotate(0deg)",
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.9} />
                  </span>
                </button>

                <div
                  className="grid transition-[grid-template-rows] duration-500 ease-out"
                  style={{ gridTemplateRows: ativa ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <div
                      className="px-5 pb-5 transition-all duration-500 ease-out sm:px-7 sm:pl-[86px]"
                      style={{
                        opacity: ativa ? 1 : 0,
                        transform: ativa ? "translateY(0)" : "translateY(-6px)",
                      }}
                    >
                      <p className="m-0 text-[14px] leading-relaxed text-ink-soft">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>

      {/* O botão abre o e-mail da pessoa já endereçado para a loja. O endereço
          fica escrito embaixo para quem prefere copiar e escrever depois. */}
      <div className="mt-11 flex flex-col items-center gap-3 text-center">
        <p className="m-0 text-[13.5px] text-ink-soft">Não achou o que procurava?</p>
        <a
          href={`mailto:${LOJA.email}?subject=${encodeURIComponent("Dúvida sobre as peças")}`}
          className="flex items-center gap-2.5 rounded-full bg-wine px-7 py-3.5 font-serif text-[15px] text-white transition-colors hover:bg-wine-dark"
        >
          <Mail className="h-4 w-4" strokeWidth={1.7} />
          Entre em contato com nossa equipe
        </a>
        <span className="text-[12px] text-mauve">{LOJA.email}</span>
      </div>
    </section>
  );
}
