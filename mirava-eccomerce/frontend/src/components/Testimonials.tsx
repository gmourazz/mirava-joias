// Depoimentos — avaliações REAIS, nunca inventadas.
//
// A versão anterior mostrava depoimentos fictícios com nomes e fotos.
// Depoimento falso é publicidade enganosa (CDC, art. 37, § 1º). Esta versão
// lê de /avaliacoes — avaliação de verdade, copiada da Lilly na
// sincronização (nome, data, texto; ver ARQUITETURA.md e db.ShowcaseReview).
// Sem foto de cliente de propósito: a sincronização não traz foto de quem
// avaliou, só o texto.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { listShowcaseReviews, type ShowcaseReview } from "../lib/avaliacoes";

const PER_PAGE = 5;
const AUTOPLAY_MS = 5000;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export default function Testimonials() {
  const [reviews, setReviews] = useState<ShowcaseReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    listShowcaseReviews()
      .then(setReviews)
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, []);

  const pages = chunk(reviews, PER_PAGE);
  const pageCount = pages.length;

  // Autoplay pausa no hover: se a cliente está lendo, o carrossel não deve
  // trocar de card debaixo dela.
  useEffect(() => {
    if (pageCount <= 1 || paused) return;
    const id = setInterval(() => setPage((p) => (p + 1) % pageCount), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [pageCount, paused]);

  // Seção secundária: sem dado real, some — nunca mostra esqueleto nem
  // mensagem de erro por cima da home.
  if (loading || reviews.length === 0) return null;

  const goTo = (i: number) => setPage((i + pageCount) % pageCount);

  return (
    <section
      id="feedbacks"
      className="overflow-hidden px-6 py-20 sm:px-16 lg:px-24"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mb-[34px] flex items-end justify-between gap-5">
        <div>
          <span className="font-script text-[26px] tracking-[0.06em] text-wine">Feedbacks</span>
          <h2 className="m-0 mt-1 font-serif text-[32px] font-normal">Feedbacks dos nossos clientes</h2>
        </div>
        {pageCount > 1 && (
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => goTo(page - 1)}
              aria-label="Avaliações anteriores"
              className="flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-full border border-rose bg-none text-ink hover:border-wine hover:bg-cream"
            >
              <ChevronLeft className="pointer-events-none flex h-[17px] w-[17px]" strokeWidth={1.6} />
            </button>
            <button
              type="button"
              onClick={() => goTo(page + 1)}
              aria-label="Próximas avaliações"
              className="flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-full border border-rose bg-none text-ink hover:border-wine hover:bg-cream"
            >
              <ChevronRight className="pointer-events-none flex h-[17px] w-[17px]" strokeWidth={1.6} />
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ transform: `translateX(-${page * 100}%)` }}
        >
          {pages.map((group, i) => (
            <div key={i} className="grid w-full shrink-0 grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
              {group.map((r, j) => (
                <ReviewCard key={`${i}-${j}`} review={r} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {pageCount > 1 && (
        <div className="mt-9 flex items-center justify-center gap-2">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Ir para o grupo ${i + 1} de avaliações`}
              aria-current={i === page}
              className="h-2 cursor-pointer rounded-full border-none p-0 transition-[width]"
              style={{ width: i === page ? 22 : 8, background: i === page ? "#8E3B6B" : "#E3B1C8" }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewCard({ review }: { review: ShowcaseReview }) {
  return (
    <div className="flex h-full flex-col gap-3.5 rounded-[16px] border border-blush bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blush font-serif text-[13px] text-wine">
          {initials(review.author)}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="font-serif text-[13.5px] leading-tight text-ink">{review.author}</span>
          {review.rating != null && (
            <span className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${i < Math.round(review.rating!) ? "fill-wine text-wine" : "text-mauve/30"}`}
                  strokeWidth={1.6}
                />
              ))}
            </span>
          )}
        </div>
      </div>
      <p className="m-0 flex flex-1 items-center text-[13px] leading-relaxed text-ink-soft">“{review.text}”</p>
      <Link
        to={`/produto/${review.product_slug}`}
        className="text-[10.5px] tracking-[0.1em] text-mauve uppercase hover:text-wine"
      >
        {review.product_name}
      </Link>
    </div>
  );
}
