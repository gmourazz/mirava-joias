// Vitrine completa de mais vendidos.
//
// Mesmo filtro da seção da home (bestSellers: true) — a ordem vem do banco:
// venda própria da Mirava manda, posição na vitrine da fornecedora só
// desempata enquanto a loja é nova. Sem filtro de categoria/metal aqui de
// propósito: é uma curadoria única, não outra forma de navegar o catálogo.

import { useEffect } from "react";
import ProductCard from "../components/ProductCard";
import {
  CatalogLoading, CatalogError, CatalogEmpty,
} from "../components/EstadosCatalogo";
import { useProducts } from "../catalogo/hooks";
import { img } from "../lib/images";
import { textoPrazo } from "../lib/dinheiro";

export default function MaisVendidasPage() {
  const { data: products, loading, error, retry } = useProducts({ bestSellers: true, limit: 48 });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div>
      <div className="relative overflow-hidden">
        <img src={img("banner-colecoes")} alt="" className="block h-[280px] w-full object-cover" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-plum/38">
          <span className="text-[10px] tracking-[0.22em] text-rose uppercase">
            Início / Mais Vendidas
          </span>
          <h1 className="m-0 font-serif text-[clamp(28px,3.4vw,44px)] font-normal text-white">
            As mais vendidas
          </h1>
          <span className="rounded-full border border-blush/70 px-4 py-1.5 text-[10px] tracking-[0.2em] text-white uppercase">
            Produção sob encomenda · {textoPrazo()}
          </span>
        </div>
      </div>

      <div className="px-6 pt-7 pb-5 text-[13px] text-ink-soft sm:px-16 lg:px-24">
        {loading
          ? "carregando peças…"
          : error
            ? " "
            : `${products.length} ${products.length === 1 ? "peça" : "peças"} · as queridinhas das nossas clientes`}
      </div>

      <section className="grid grid-cols-2 gap-[22px] px-6 pb-20 sm:px-16 md:grid-cols-3 lg:grid-cols-4 lg:px-24">
        {loading && <CatalogLoading />}
        {!loading && error && <CatalogError message={error} onRetry={retry} />}
        {!loading && !error && products.length === 0 && (
          <CatalogEmpty message="Ainda não temos dado de venda suficiente pra montar essa vitrine" />
        )}
        {!loading && !error &&
          products.map((p) => <ProductCard key={p.id} product={p} />)}
      </section>
    </div>
  );
}
