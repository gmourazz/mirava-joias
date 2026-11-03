// "Quem usa, ama" (design v5): as avaliações reais mais recentes da loja.
// Sem avaliação aprovada, a seção não aparece (decisão 28).

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { recentReviews, type RecentReview } from "../lib/extras";
import { Estrelas } from "./AvaliacoesProduto";
import SectionHeading from "./SectionHeading";

export default function QuemUsaAma() {
  const [list, setList] = useState<RecentReview[]>([]);
  useEffect(() => {
    recentReviews().then(setList).catch(() => {});
  }, []);
  if (list.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1360px] px-[clamp(16px,3vw,40px)] pt-20">
      <SectionHeading eyebrow="Avaliações" title={<>Quem usa, <em>ama</em></>} align="center" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-[18px]">
        {list.map((r, i) => (
          <figure key={i} className="m-0 grid content-start gap-3 rounded-3xl border border-line bg-white p-6">
            <Estrelas nota={r.rating} tamanho={14} />
            <blockquote className="m-0 text-[14.5px] leading-[1.7] text-text-2">“{r.text}”</blockquote>
            <figcaption className="text-[13px] text-muted">
              <strong className="text-text">{r.author}</strong> · comprou{" "}
              <Link to={`/produto/${r.product_slug}`} className="font-semibold text-teal">
                {r.product_name}
              </Link>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
