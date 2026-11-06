// Lista de coleções (menu "Coleções"): um cartão por coleção, com a capa.

import { Link } from "react-router-dom";
import { imageUrl } from "../catalogo/consultas";
import { useColecoes } from "../lib/extras";

export default function Colecoes() {
  const lista = useColecoes();
  return (
    <div className="mx-auto grid max-w-[1360px] gap-6 px-[clamp(16px,3vw,40px)] pt-7 pb-4">
      <nav className="text-[12px] tracking-[0.1em] text-[#5E7473] uppercase">
        <Link to="/" className="text-[#5E7473] hover:text-teal">Início</Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-teal">Coleções</span>
      </nav>
      <h1 className="m-0 font-serif text-[clamp(34px,4vw,52px)] leading-[1.05] font-normal text-teal-dark">Coleções</h1>
      {lista.length === 0 ? (
        <p className="m-0 py-10 text-[15px] text-muted">As coleções aparecem aqui assim que a primeira for publicada.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-5">
          {lista.map((c) => {
            const capa = imageUrl(c.cover ?? undefined);
            return (
              <Link key={c.id} to={`/colecoes/${c.slug}`} className="group grid overflow-hidden rounded-[28px] border border-line bg-white text-text hover:text-text">
                <span className="relative block aspect-[4/3] bg-mist-3">
                  {capa && <img src={capa} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                </span>
                <span className="grid gap-1 p-5">
                  <span className="font-serif text-[26px] leading-tight text-teal-dark">{c.name}</span>
                  {c.tagline && <span className="text-[14px] text-text-2">{c.tagline}</span>}
                  <span className="text-[12.5px] text-muted">{c.count} {c.count === 1 ? "peça" : "peças"}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
