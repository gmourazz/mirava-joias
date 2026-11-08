// Lista de coleções (menu "Coleções"): um cartão alto por coleção, com a capa
// em tela cheia, degradê embaixo e o nome por cima.

import { Link } from "react-router-dom";
import { ArrowUpRight, ChevronRight, Layers } from "lucide-react";
import { imageUrl } from "../catalogo/consultas";
import { useColecoes } from "../lib/extras";

export default function Colecoes() {
  const lista = useColecoes();
  return (
    <div className="mx-auto grid max-w-[1360px] gap-8 px-[clamp(16px,3vw,40px)] pt-7 pb-6">
      <nav className="flex items-center gap-2 text-[14px] text-text">
        <Link to="/" className="text-text-2 hover:text-teal">Início</Link>
        <ChevronRight size={14} strokeWidth={1.6} className="text-teal" />
        <span className="font-medium text-teal">Coleções</span>
      </nav>

      <header className="grid max-w-[800px] gap-3 border-b border-line pb-8">
        <div className="flex items-center gap-5">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-mist text-teal">
            <Layers size={26} strokeWidth={1.5} />
          </span>
          <h1 className="m-0 font-serif text-[clamp(40px,5vw,64px)] leading-none font-normal text-teal-dark">Coleções</h1>
        </div>
        <p className="m-0 text-[16px] text-text-2">Coleções exclusivas da Mirava, montadas pra você.</p>
      </header>

      {lista.length === 0 ? (
        <p className="m-0 py-10 text-[15px] text-muted">As coleções aparecem aqui assim que a primeira for publicada.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),340px))] gap-6">
          {lista.map((c) => {
            const capa = imageUrl(c.cover ?? undefined);
            return (
              <Link
                key={c.id}
                to={`/colecoes/${c.slug}`}
                className="group relative block aspect-square overflow-hidden rounded-[24px] bg-mist-3 text-white hover:text-white"
              >
                {capa && (
                  <img
                    src={capa}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                )}
                <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,74,77,0)_42%,rgba(11,74,77,0.42)_68%,rgba(11,74,77,0.92)_100%)]" />
                <span className="absolute inset-x-6 bottom-6 grid gap-2">
                  <span className="flex items-center gap-2 text-[12px] font-medium tracking-[0.2em] text-teal-pale uppercase">
                    <Layers size={15} strokeWidth={1.6} />
                    {c.count} {c.count === 1 ? "peça" : "peças"}
                  </span>
                  <span className="flex items-end justify-between gap-3">
                    <span className="text-[clamp(20px,1.7vw,24px)] leading-[1.15] font-medium tracking-[0.08em] uppercase">{c.name}</span>
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
