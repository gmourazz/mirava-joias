// "Presentear é com a gente" (v5): painel centralizado com o ícone de
// presente flutuando e atalhos por faixa de preço (?ate= em centavos). Se a
// dona escolheu peças para o espaço "presentes" da vitrine, elas aparecem
// abaixo dos atalhos.

import { Link } from "react-router-dom";
import { Gift } from "lucide-react";
import SectionHeading from "./SectionHeading";
import ProductCard from "./ProductCard";
import { useShowcase } from "../lib/extras";
import { formatarBRL } from "../lib/dinheiro";
import { LOJA } from "../config/loja";

const FAIXAS = [5000, 8000, 12000, 20000];

export default function PresentesSection() {
  const presentes = useShowcase().data.presentes;
  return (
    <section className="mx-auto max-w-[1360px] px-[clamp(16px,3vw,40px)] pt-20">
      <div className="flex flex-col items-center gap-2 rounded-[36px] bg-mist-2 px-6 py-[clamp(40px,5vw,64px)] text-center">
        <span className="mb-4 grid h-[60px] w-[60px] animate-[float_3.5s_ease-in-out_infinite] place-items-center rounded-full bg-white text-teal">
          <Gift size={26} strokeWidth={1.6} />
        </span>
        <SectionHeading
          align="center"
          eyebrow="Presentear é com a gente"
          title={<>Uma joia é sempre um <em>presente</em></>}
          description={`Escolha pelo valor e a gente cuida do resto: a peça é encomendada e chega até ela com rastreio. Embrulho com cartão por ${formatarBRL(LOJA.embrulhoCentavos)}.`}
        />
        <div className="flex flex-wrap justify-center gap-2.5">
          {FAIXAS.map((c) => (
            <Link
              key={c}
              to={`/categoria/colecoes/todos?ate=${c}`}
              className="rounded-full bg-white px-5 py-3 text-[14px] font-semibold text-teal transition-colors hover:bg-teal hover:text-white"
            >
              Até R$ {c / 100}
            </Link>
          ))}
        </div>
        {presentes.length > 0 && (
          <div className="mt-8 grid w-full grid-cols-[repeat(auto-fill,minmax(min(100%,210px),1fr))] gap-[18px] text-left">
            {presentes.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
