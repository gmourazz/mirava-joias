// Lista de coleções (menu "Coleções"): um cartão alto por coleção, com a capa
// em tela cheia, degradê embaixo e o nome por cima.

import { Link } from "react-router-dom";
import { ArrowUpRight, Layers } from "lucide-react";
import { imageUrl } from "../catalogo/consultas";
import { useColecoes } from "../lib/extras";

export default function Colecoes() {
  const lista = useColecoes();
  return (
    <div className="mx-auto grid max-w-[1360px] gap-8 px-[clamp(16px,3vw,40px)] pt-7 pb-6">
      <nav className="text-[13px] text-[#5E7473]">
        <Link to="/" className="text-[#5E7473] hover:text-teal">Início</Link>
        <span className="mx-2">›</span>
        <span className="text-text">Coleções</span>
      </nav>

      <header className="grid gap-3 border-b border-line pb-8">
        <div className="flex items-center gap-5">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-line text-teal-dark">
            <Layers size={26} strokeWidth={1.5} />
          </span>
          <h1 className="m-0 font-serif text-[clamp(40px,5vw,64px)] leading-none font-normal text-teal-dark">Coleções</h1>
        </div>
        <p className="m-0 text-[16px] text-text-2">Coleções exclusivas da Mirava, montadas pra você.</p>
      </header>

      {lista.length === 0 ? (
        <p className="m-0 py-10 text-[15px] text-muted">As coleções aparecem aqui assim que a primeira for publicada.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),340px))] gap-6">
          {lista.map((c) => {
            const capa = imageUrl(c.cover ?? undefined);
            return (
              <Link
                key={c.id}
                to={`/colecoes/${c.slug}`}
                className="group relative block aspect-[4/5.4] overflow-hidden rounded-[20px] bg-mist-3 text-white hover:text-white"
              >
                {capa && (
                  <img
                    src={capa}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                )}
                <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,74,77,0)_45%,rgba(11,74,77,0.35)_70%,rgba(8,45,47,0.88)_100%)]" />
                <span className="absolute inset-x-6 bottom-6 grid gap-2">
                  <span className="flex items-center gap-2 text-[12px] font-medium tracking-[0.2em] text-white/80 uppercase">
                    <Layers size={15} strokeWidth={1.6} />
                    {c.count} {c.count === 1 ? "peça" : "peças"}
                  </span>
                  <span className="flex items-end justify-between gap-3">
                    <span className="font-serif text-[clamp(24px,2.2vw,30px)] leading-[1.1] tracking-[0.04em] uppercase">{c.name}</span>
                    <ArrowUpRight size={20} strokeWidth={1.6} className="mb-1 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
