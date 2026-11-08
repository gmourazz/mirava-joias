// Coleção (menu "Coleções"): um grupo de peças escolhido pela dona, com capa,
// frase e descrição. A lista vem de GET /colecoes/{slug} — só peças no ar.

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, Layers } from "lucide-react";
import { imageUrl } from "../catalogo/consultas";
import type { Product } from "../catalogo/tipos";
import ProductCard from "../components/ProductCard";
import { CatalogError, CatalogLoading } from "../components/EstadosCatalogo";
import { ApiError } from "../lib/api";
import { colecao, type Colecao } from "../lib/extras";

export default function ColecaoPage() {
  const { slug = "" } = useParams();
  const [data, setData] = useState<{ collection: Colecao; products: Product[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let atual = true;
    setData(null);
    setError(null);
    window.scrollTo({ top: 0 });
    colecao(slug)
      .then((d) => atual && setData(d))
      .catch((e) => atual && setError(e instanceof ApiError && e.status === 404 ? "Esta coleção não existe ou saiu do ar." : "Não consegui carregar a coleção."));
    return () => {
      atual = false;
    };
  }, [slug, tentativa]);

  const capa = imageUrl(data?.collection.cover ?? undefined);

  return (
    <div className="mx-auto grid max-w-[1360px] gap-6 px-[clamp(16px,3vw,40px)] pt-7">
      <nav className="flex flex-wrap items-center gap-2 text-[14px] text-text-2">
        <Link to="/" className="text-text-2 hover:text-teal">Início</Link>
        <ChevronRight size={14} strokeWidth={1.6} className="text-teal" />
        <Link to="/colecoes" className="text-text-2 hover:text-teal">Coleções</Link>
        {data && (
          <>
            <ChevronRight size={14} strokeWidth={1.6} className="text-teal" />
            <span className="font-medium text-teal">{data.collection.name}</span>
          </>
        )}
      </nav>

      {data && (
        <header className="grid items-center gap-[clamp(20px,3vw,40px)] rounded-[28px] bg-teal-dark p-[clamp(16px,2vw,20px)] text-white md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="grid content-center gap-2.5 p-[clamp(8px,2vw,24px)]">
            <span className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.2em] text-teal-pale uppercase">
              <Layers size={15} strokeWidth={1.6} />
              Coleção · {data.products.length} {data.products.length === 1 ? "peça" : "peças"}
            </span>
            <h1 className="m-0 font-serif text-[clamp(34px,3.8vw,50px)] leading-[1.05] font-normal text-white">{data.collection.name}</h1>
            {data.collection.tagline && <p className="m-0 font-serif text-[19px] text-teal-pale italic">{data.collection.tagline}</p>}
            {data.collection.description && <p className="m-0 max-w-[58ch] text-[14.5px] leading-[1.65] text-[#D6EEEB]">{data.collection.description}</p>}
          </div>
          {capa && <img src={capa} alt="" className="h-[220px] w-full rounded-[20px] object-cover object-[50%_28%]" />}
        </header>
      )}

      <section className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-[18px] pb-4">
        {!data && !error && <CatalogLoading />}
        {error && <CatalogError message={error} onRetry={() => setTentativa((n) => n + 1)} />}
        {data?.products.map((p) => <ProductCard key={p.id} product={p} />)}
      </section>
    </div>
  );
}
