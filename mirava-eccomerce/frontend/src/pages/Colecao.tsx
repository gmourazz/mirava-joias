// Coleção (menu "Coleções"): um grupo de peças escolhido pela dona, com capa,
// frase e descrição. A lista vem de GET /colecoes/{slug} — só peças no ar.

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
      <nav className="text-[12px] tracking-[0.1em] text-[#5E7473] uppercase">
        <Link to="/" className="text-[#5E7473] hover:text-teal">Início</Link>
        <span className="mx-2">/</span>
        <Link to="/colecoes" className="text-[#5E7473] hover:text-teal">Coleções</Link>
        {data && (
          <>
            <span className="mx-2">/</span>
            <span className="font-semibold text-teal">{data.collection.name}</span>
          </>
        )}
      </nav>

      {data && (
        <header className="grid overflow-hidden rounded-[32px] bg-mist md:grid-cols-[1.1fr_1fr]">
          <div className="grid content-center gap-3 p-[clamp(24px,4vw,56px)]">
            <span className="text-[12px] font-semibold tracking-[0.22em] text-teal-mid uppercase">Coleção</span>
            <h1 className="m-0 font-serif text-[clamp(38px,4.6vw,64px)] leading-[1.02] font-normal text-teal-dark">{data.collection.name}</h1>
            {data.collection.tagline && <p className="m-0 text-[17px] text-teal">{data.collection.tagline}</p>}
            {data.collection.description && <p className="m-0 max-w-[48ch] text-[15px] leading-[1.7] text-text-2">{data.collection.description}</p>}
            <span className="text-[13.5px] text-muted">
              {data.products.length} {data.products.length === 1 ? "peça" : "peças"}
            </span>
          </div>
          <div className="relative min-h-[240px] bg-mist-3">
            {capa && <img src={capa} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          </div>
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
