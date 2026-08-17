// Os quatro passos da compra.
//
// Sem cartão e sem caixa: os passos vivem soltos sobre o fundo, ligados por um
// fio que passa na altura dos círculos de ícone. É esse fio que transforma
// quatro blocos numa sequência — no celular ele some, porque a grade quebra em
// duas colunas e a linha ligaria coisas fora de ordem.

import { STEPS } from "../data/content";
import { ICONS } from "./icons";
import Reveal from "./Reveal";

export default function HowItWorks() {
  return (
    <section className="border-t border-blush-2 bg-paper px-6 py-[96px] sm:px-16 lg:px-24">
      <div className="mb-[58px] flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="max-w-[620px]">
          <span className="font-sans text-[10px] font-semibold tracking-[0.3em] text-wine uppercase">
            Como comprar
          </span>
          <h2 className="m-0 mt-3.5 font-serif text-[clamp(30px,3.2vw,44px)] leading-[1.1] font-normal">
            Da escolha até a sua porta
          </h2>
          <span className="mt-5 block h-px w-14 bg-rose" />
          <p className="m-0 mt-5 max-w-[460px] text-[14.5px] leading-relaxed text-ink-soft">
            Compra segura no site e acompanhamento do pedido do início ao fim.
          </p>
        </div>
        <span className="rounded-full border border-rose/70 px-5 py-2.5 text-[11px] font-medium tracking-[0.16em] whitespace-nowrap text-wine uppercase">
          Entrega em 10 a 20 dias úteis
        </span>
      </div>

      <div className="relative">
        {/* Fio de ligação, na altura do centro dos círculos. */}
        <div className="absolute top-[27px] right-[10%] left-[10%] hidden h-px bg-[linear-gradient(90deg,transparent,#F0BFD3_18%,#F0BFD3_82%,transparent)] lg:block" />

        <div className="relative grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => {
            const Icon = ICONS[s.icon];
            return (
              // h-full + flex-col + `mt-auto` na meta: as descrições têm
              // alturas diferentes, e sem isso cada rodapé para numa linha.
              <Reveal key={s.n} delay={i * 110} className="group flex h-full flex-col">
                <div className="flex items-center gap-3.5">
                  <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full bg-paper text-wine ring-1 ring-blush-2 transition-all duration-500 ease-out group-hover:bg-wine group-hover:text-white group-hover:ring-wine">
                    <Icon className="h-[21px] w-[21px]" strokeWidth={1.6} />
                  </span>
                  {/* Número em contorno: presente, mas sem competir com o
                      título — antes o preenchido de 46px roubava a leitura. */}
                  <span
                    className="font-serif text-[40px] leading-none text-transparent transition-colors duration-500"
                    style={{ WebkitTextStroke: "1px #F0BFD3" }}
                  >
                    {s.n}
                  </span>
                </div>

                <h3 className="m-0 mt-6 font-serif text-[19px] leading-tight font-normal text-ink">
                  {s.title}
                </h3>
                <p className="m-0 mt-2.5 max-w-[290px] text-[13.5px] leading-relaxed text-ink-soft">
                  {s.desc}
                </p>
                <span className="mt-auto flex items-center gap-2.5 pt-5 text-[10.5px] tracking-[0.16em] text-mauve uppercase">
                  <span className="h-px w-5 bg-rose" />
                  {s.meta}
                </span>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
