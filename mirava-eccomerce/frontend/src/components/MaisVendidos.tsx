// "As queridinhas" (v5): abas em pill e um trilho de cards que rola na
// horizontal com encaixe, mais setas que andam 80% da largura.
//
// "Mais vendidos" vem ordenado do banco (units_sold: a venda da própria
// Mirava manda, a posição na vitrine da fornecedora só desempata). "Até R$ 79"
// filtra essa mesma lista, porque a API ainda não tem filtro de preço.
//
// Quando a dona monta a vitrine no painel (Vitrine → queridinhas /
// lançamentos), essas abas mostram a escolha dela, na ordem dela.

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Sparkles, Star, Sun, Tag, type LucideIcon } from "lucide-react";
import { useProducts } from "../catalogo/hooks";
import type { ProductFilter } from "../catalogo/consultas";
import { imageUrl } from "../catalogo/consultas";
import ProductCard from "./ProductCard";
import { useShowcase, type ShowcaseSlot } from "../lib/extras";
import SectionHeading from "./SectionHeading";

interface Aba {
  key: string;
  label: string;
  title: string;
  filter: ProductFilter;
  maxCents?: number;
  slot?: ShowcaseSlot;
  Icon: LucideIcon;
}

const ABAS: Aba[] = [
  { key: "top", label: "Mais vendidos", title: "Mais vendidos", filter: { bestSellers: true, limit: 16 }, slot: "queridinhas", Icon: Flame },
  // Sem bestSellers a API devolve as peças mais recentes primeiro.
  { key: "novos", label: "Lançamentos", title: "Lançamentos", filter: { limit: 16 }, slot: "lancamentos", Icon: Sparkles },
  { key: "destaques", label: "Destaques", title: "Destaques da Mirava", filter: { featured: true, limit: 16 }, Icon: Star },
  { key: "ate79", label: "Até R$ 79", title: "Até R$ 79", filter: { bestSellers: true, limit: 48 }, maxCents: 7990, Icon: Tag },
  { key: "ouro", label: "Banhados a ouro", title: "Banhados a ouro", filter: { metal: "ouro", bestSellers: true, limit: 16 }, Icon: Sun },
];

export default function MaisVendidos() {
  const [aba, setAba] = useState(ABAS[0]);
  const trilho = useRef<HTMLDivElement>(null);
  const { data, loading: loadingAuto } = useProducts(aba.filter);
  const vitrine = useShowcase();
  const escolhidas = aba.slot ? vitrine.data[aba.slot] : [];
  const usaVitrine = escolhidas.length > 0;
  const loading = vitrine.loading || loadingAuto;

  const pecas = (usaVitrine ? escolhidas : data)
    .filter((p) => imageUrl(p.images[0]))
    .filter((p) => !aba.maxCents || p.priceCents <= aba.maxCents)
    .slice(0, 12);

  const rolar = (dir: 1 | -1) => {
    const el = trilho.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const escolher = (a: Aba) => {
    setAba(a);
    trilho.current?.scrollTo({ left: 0 });
  };

  // Na aba principal, sem peça nenhuma (API fora ou catálogo vazio), a seção
  // some em vez de mostrar uma vitrine vazia.
  if (!loading && pecas.length === 0 && aba.key === "top") return null;

  return (
    <section className="mx-auto max-w-[1360px] px-[clamp(16px,3vw,40px)] pt-20">
      <SectionHeading
        eyebrow="As queridinhas"
        title={aba.title}
        aside={
          <div className="flex flex-wrap items-center gap-2">
            {ABAS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => escolher(a)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border-none px-[18px] py-2.5 text-[13.5px] font-semibold transition-colors ${
                  a.key === aba.key ? "bg-teal text-white" : "bg-chip text-text hover:bg-mist-2"
                }`}
              >
                <a.Icon size={15} strokeWidth={1.8} aria-hidden />
                {a.label}
              </button>
            ))}
            <span className="ml-1 hidden gap-2 sm:flex">
              <button type="button" aria-label="Anteriores" onClick={() => rolar(-1)} className="grid h-[42px] w-[42px] cursor-pointer place-items-center rounded-full border border-[#DDE4E4] bg-white text-teal">
                <ChevronLeft size={18} strokeWidth={1.8} />
              </button>
              <button type="button" aria-label="Próximas" onClick={() => rolar(1)} className="grid h-[42px] w-[42px] cursor-pointer place-items-center rounded-full border-none bg-teal text-white">
                <ChevronRight size={18} strokeWidth={1.8} />
              </button>
            </span>
          </div>
        }
      />

      {!loading && pecas.length === 0 ? (
        <p className="m-0 py-10 text-center text-[14px] text-muted">Nenhuma peça nesta seleção ainda.</p>
      ) : (
        <div
          ref={trilho}
          className="grid auto-cols-[max(230px,calc((100%-60px)/4))] grid-flow-col gap-5 overflow-x-auto pb-3 [scroll-snap-type:x_mandatory] [scrollbar-width:none]"
        >
          {pecas.map((p) => (
            <div key={p.id} className="[scroll-snap-align:start]">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
