import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import {
  CatalogLoading, CatalogError, CatalogEmpty,
} from "../components/EstadosCatalogo";
import { useProducts } from "../catalogo/hooks";

/** Resultado de busca — cobre o catálogo inteiro, sem filtro de metal/categoria. */
export default function Busca() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";

  const { data: products, loading, error, retry } = useProducts(
    q.trim() ? { search: q.trim(), limit: 60 } : { limit: 0 },
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [q]);

  return (
    <div className="px-6 pt-10 pb-20 sm:px-16 lg:px-24">
      <h1 className="m-0 font-serif text-[clamp(26px,3vw,36px)] font-normal text-ink">
        {q ? (
          <>
            Resultado para <span className="text-wine">"{q}"</span>
          </>
        ) : (
          "Buscar peças"
        )}
      </h1>

      <p className="mt-2.5 mb-9 text-[13px] text-ink-soft">
        {!q
          ? "Digite o que você procura na lupa, no topo da página."
          : loading
            ? "buscando…"
            : error
              ? " "
              : `${products.length} ${products.length === 1 ? "peça encontrada" : "peças encontradas"}`}
      </p>

      <section className="grid grid-cols-2 gap-[22px] md:grid-cols-3 lg:grid-cols-4">
        {q && loading && <CatalogLoading />}
        {q && !loading && error && <CatalogError message={error} onRetry={retry} />}
        {q && !loading && !error && products.length === 0 && (
          <CatalogEmpty message={`Nenhuma peça encontrada para "${q}"`} />
        )}
        {q && !loading && !error &&
          products.map((p) => <ProductCard key={p.id} product={p} />)}
      </section>
    </div>
  );
}
