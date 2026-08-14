import { useState } from "react";
import { Link } from "react-router-dom";
import type { Produto } from "../catalogo/tipos";
import { ROTULO_METAL } from "../catalogo/tipos";
import { urlImagem } from "../catalogo/consultas";
import { formatarBRL, textoParcelas, textoPix } from "../lib/dinheiro";

// Sem estrelas de avaliação aqui, de propósito.
//
// As notas anteriores eram inventadas, e avaliação falsa é publicidade
// enganosa. Quando existirem avaliações reais de clientes, a nota volta —
// vinda do banco, não de um array no código.

export default function ProductCard({ produto }: { produto: Produto }) {
  const [sobre, setSobre] = useState(false);
  const capa = urlImagem(produto.imagens[0]);
  const tamanhos = produto.variantes.filter((v) => v.disponivel);

  return (
    <div onMouseEnter={() => setSobre(true)} onMouseLeave={() => setSobre(false)}>
      <Link to={`/produto/${produto.slug}`} className="block">
        <div className="zoom-on-hover relative aspect-[4/5] overflow-hidden rounded-[14px] bg-[#FBF6F8]">
          {capa ? (
            <img
              src={capa}
              alt={produto.nome}
              loading="lazy"
              className="block h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] text-mauve">
              sem foto
            </div>
          )}

          <span className="absolute top-3 left-3 rounded-full bg-plum px-3.5 py-1.5 text-[9.5px] tracking-[0.18em] text-blush uppercase">
            Sob encomenda
          </span>

          <span className="absolute bottom-3 left-3 rounded-full border border-mauve bg-white/94 px-3 py-1.5 text-[9.5px] tracking-[0.14em] text-ink-soft uppercase">
            {ROTULO_METAL[produto.metal]}
          </span>

          {!produto.disponivel && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/75">
              <span className="rounded-full bg-plum px-4 py-2 text-[10px] tracking-[0.16em] text-blush uppercase">
                Indisponível
              </span>
            </div>
          )}

          {sobre && produto.disponivel && (
            <div className="absolute right-0 bottom-0 left-0 flex flex-col gap-2.5 bg-white/96 p-3.5">
              {tamanhos.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {tamanhos.slice(0, 4).map((v) => (
                    <span
                      key={v.id}
                      className="min-w-9 rounded-full border border-rose px-2.5 py-1.5 text-center text-[11px]"
                    >
                      {v.tamanho}
                    </span>
                  ))}
                </div>
              )}
              <span className="rounded-full bg-wine p-2.5 text-center font-serif text-[13.5px] font-semibold tracking-[0.2em] text-white uppercase">
                Ver peça
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-col gap-1.5 pt-3.5">
        <h3 className="m-0 font-serif text-[16.5px] font-normal">
          <Link to={`/produto/${produto.slug}`} className="hover:text-wine">
            {produto.nome}
          </Link>
        </h3>
        <span className="text-[16px] text-ink">{formatarBRL(produto.precoCentavos)}</span>
        <span className="text-xs text-ink-soft">{textoParcelas(produto.precoCentavos)}</span>
        <span className="text-xs text-wine">{textoPix(produto.precoCentavos)}</span>
      </div>
    </div>
  );
}
