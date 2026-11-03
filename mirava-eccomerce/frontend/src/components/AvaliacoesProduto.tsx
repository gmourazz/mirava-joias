// Avaliações reais da peça (decisão 28: nada de depoimento inventado). Só
// aparecem as que a dona aprovou no painel; sem nenhuma, a seção some.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { productReviews, type PublicReview } from "../lib/extras";
import Reveal from "./Reveal";

export function Estrelas({ nota, tamanho = 15 }: { nota: number; tamanho?: number }) {
  return (
    <span className="inline-flex gap-0.5 text-teal" aria-label={`${nota.toFixed(1)} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={tamanho} strokeWidth={1.6} fill={i <= Math.round(nota) ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

export default function AvaliacoesProduto({ slug }: { slug: string }) {
  const [data, setData] = useState<{ reviews: PublicReview[]; average: number; count: number; recommend_pct: number } | null>(null);

  useEffect(() => {
    let atual = true;
    productReviews(slug)
      .then((d) => atual && setData(d))
      .catch(() => atual && setData(null));
    return () => {
      atual = false;
    };
  }, [slug]);

  if (!data || data.count === 0) return null;

  return (
    <Reveal>
      <section className="pt-20">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <h2 className="m-0 font-serif text-[clamp(30px,3.2vw,42px)] font-normal text-teal-dark">
            Quem <em className="text-teal">comprou</em>
          </h2>
          <span className="flex flex-wrap items-center gap-2 text-[14px] text-text-2">
            <Estrelas nota={data.average} />
            <strong className="text-text">{data.average.toFixed(1).replace(".", ",")} de 5</strong> · {data.count} {data.count === 1 ? "avaliação" : "avaliações"}
            {data.recommend_pct > 0 && <> · {data.recommend_pct}% recomendam</>}
            <Link to="/conta?aba=avaliar" className="ml-1 rounded-full border-[1.5px] border-line px-3.5 py-1.5 text-[13px] font-semibold text-teal hover:border-teal">
              Escrever avaliação
            </Link>
          </span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-[18px]">
          {data.reviews.map((r, i) => (
            <figure key={i} className="m-0 rounded-3xl border border-line bg-white p-6">
              <span className="flex items-center justify-between gap-2">
                <Estrelas nota={r.rating} tamanho={14} />
                {/* Toda avaliação vem de quem recebeu a peça — conferido no servidor. */}
                <span className="text-[11.5px] font-semibold text-teal">✓ Compra verificada</span>
              </span>
              {r.text && <blockquote className="m-0 mt-3 text-[14.5px] leading-[1.7] text-text-2">{r.text}</blockquote>}
              <figcaption className="mt-4 text-[13px] font-semibold text-text">
                {r.author}
                <span className="ml-2 font-normal text-muted">{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </Reveal>
  );
}
