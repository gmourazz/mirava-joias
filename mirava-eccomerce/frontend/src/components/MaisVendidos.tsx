// Mais vendidos.
//
// A ordem vem do banco (ver a coluna units_sold no schema): a venda da própria
// Mirava manda, e a posição na vitrine da fornecedora só desempata enquanto a
// loja é nova. Ou seja, a lista é real desde o primeiro dia e vai ficando cada
// vez mais nossa sem precisar mexer em código.
//
// O pódio (as três primeiras) ganha destaque; o resto vem numa fileira menor.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Flame } from "lucide-react";
import { listProducts, imageUrl } from "../catalogo/consultas";
import { formatarBRL, textoParcelas } from "../lib/dinheiro";
import type { Product } from "../catalogo/tipos";
import Reveal from "./Reveal";

/** 3 no pódio + 4 na fileira de baixo. */
const QUANTIDADE = 7;

export default function MaisVendidos() {
  const [pecas, setPecas] = useState<Product[]>([]);

  useEffect(() => {
    let vivo = true;
    listProducts({ bestSellers: true, limit: 24 })
      .then((todas) => {
        const comFoto = todas.filter((p) => imageUrl(p.images[0]));
        if (vivo) setPecas(comFoto.slice(0, QUANTIDADE));
      })
      .catch(() => {
        // Seção secundária: falhar calado é melhor que quebrar a home.
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Sem dado de venda a seção não aparece: uma vitrine de "mais vendidos"
  // preenchida com peça qualquer seria mentira.
  if (pecas.length < 3) return null;

  const podio = pecas.slice(0, 3);
  const resto = pecas.slice(3);

  return (
    <section className="relative overflow-hidden border-t border-blush-2 bg-[linear-gradient(180deg,#FFFDFE_0%,#FFF1F7_100%)] px-6 py-[92px] sm:px-16 lg:px-24">
      <span className="pointer-events-none absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(212,106,159,0.14),transparent_70%)] blur-2xl" />

      <div className="relative mb-12 flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div>
          <span className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.3em] text-wine uppercase">
            <Flame className="h-3.5 w-3.5" strokeWidth={1.8} />
            Queridinhas
          </span>
          <h2 className="m-0 mt-3 font-serif text-[clamp(28px,3.2vw,42px)] leading-[1.1] font-normal">
            As mais vendidas
          </h2>
          <span className="mt-5 block h-px w-14 bg-rose" />
          <p className="m-0 mt-5 max-w-[430px] text-[14px] leading-relaxed text-ink-soft">
            As peças que mais saem, as queridinhas das nossas clientes.
          </p>
        </div>
        <Link
          to="/mais-vendidas"
          className="group flex items-center gap-2 text-[12px] tracking-[0.14em] text-wine uppercase hover:text-wine-dark"
        >
          Ver todas
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
            strokeWidth={1.8}
          />
        </Link>
      </div>

      {/* Pódio */}
      <div className="relative grid grid-cols-1 gap-5 sm:grid-cols-3">
        {podio.map((p, i) => (
          <Reveal key={p.id} delay={i * 110}>
            <Link to={`/produto/${p.slug}`} className="group block">
              <span className="relative block aspect-[4/5] overflow-hidden rounded-[20px] bg-cream">
                <img
                  src={imageUrl(p.images[0])!}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
                />
                {/* Medalha de posição. O número é a única coisa que diferencia
                    esta vitrine de uma vitrine qualquer — merece destaque. */}
                <span className="absolute top-4 left-4 flex h-9 w-9 items-center justify-center rounded-full bg-wine font-serif text-[15px] text-white shadow-[0_10px_22px_-12px_rgba(142,59,107,0.9)]">
                  {i + 1}
                </span>
              </span>
              <span className="mt-4 block">
                <span className="line-clamp-1 font-serif text-[17px] text-ink transition-colors group-hover:text-wine">
                  {p.name}
                </span>
                <span className="mt-1 flex flex-wrap items-baseline gap-x-2.5">
                  <span className="font-serif text-[18px] text-ink">
                    {formatarBRL(p.priceCents)}
                  </span>
                  <span className="text-[12px] text-ink-soft">
                    {textoParcelas(p.priceCents)}
                  </span>
                </span>
              </span>
            </Link>
          </Reveal>
        ))}
      </div>

      {/* Restantes, em cartões horizontais menores */}
      {resto.length > 0 && (
        <div className="relative mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {resto.map((p, i) => (
            <Reveal key={p.id} delay={i * 90}>
              <Link
                to={`/produto/${p.slug}`}
                className="group flex items-center gap-3.5 rounded-[16px] border border-blush-2 bg-white/70 p-3 transition-all duration-500 hover:-translate-y-0.5 hover:border-rose hover:bg-white"
              >
                <span className="block h-[70px] w-[70px] shrink-0 overflow-hidden rounded-[12px] bg-cream">
                  <img
                    src={imageUrl(p.images[0])!}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-[800ms] ease-out group-hover:scale-[1.08]"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] tracking-[0.16em] text-mauve tabular-nums">
                    {String(i + 4).padStart(2, "0")}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block font-serif text-[14.5px] leading-tight text-ink">
                    {p.name}
                  </span>
                  <span className="mt-1 block text-[13.5px] text-wine">
                    {formatarBRL(p.priceCents)}
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}
