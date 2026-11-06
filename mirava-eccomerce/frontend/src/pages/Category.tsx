import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Clock } from "lucide-react";
import ProductCard from "../components/ProductCard";
import { CatalogLoading, CatalogError } from "../components/EstadosCatalogo";
import { useProducts } from "../catalogo/hooks";
import { MENU_CATEGORIES, type Category, type Metal } from "../catalogo/tipos";
import { rotuloCategoria, useCategorias } from "../catalogo/categorias";
import type { MenuKey } from "../data/navegacao";
import { formatarBRL, textoPrazo } from "../lib/dinheiro";
import Select from "../components/Select";

// Página de categoria do design v5: breadcrumb, título com a contagem, abas
// de categoria e três filtros em pill (banho, preço, ordem).
//
// A rota continua /categoria/:menuKey/:filter — menuKey é o banho (prata,
// ouro ou "colecoes" para todos) e filter é a categoria. Preço e ordem vão na
// query string (?ate=, ?de=, ?ordem=) e são aplicados aqui, porque a API ainda
// não filtra por preço; a lista já vem limitada a 48 peças.

const MENU_KEYS: MenuKey[] = ["prata", "ouro", "colecoes"];

/** Faixas dos links "Presentes" do menu e da home — mudam o título da página. */
const FAIXAS_PRESENTE = [5000, 8000, 12000, 20000];

const PRECOS = [
  { value: "", label: "Preço: todos" },
  { value: "ate-6000", label: "Até R$ 60" },
  { value: "ate-10000", label: "Até R$ 100" },
  { value: "de-10000", label: "Acima de R$ 100" },
];

const ORDENS = [
  { value: "", label: "Ordenar: mais recentes" },
  { value: "novos", label: "Lançamentos" },
  { value: "menor", label: "Menor preço" },
  { value: "maior", label: "Maior preço" },
];

export default function CategoryPage() {
  const { menuKey = "colecoes", filter = "todos" } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const menu: MenuKey = MENU_KEYS.includes(menuKey as MenuKey) ? (menuKey as MenuKey) : "colecoes";
  const metal: Metal | undefined = menu === "colecoes" ? undefined : menu;
  const cats = useCategorias();
  // Qualquer categoria do banco vale na URL (são editáveis no painel); as de
  // fábrica valem mesmo antes de a lista chegar.
  // Relógios está sempre no menu, mesmo sem peça publicada: a página existe e
  // mostra o aviso, em vez de cair em "todas as joias".
  const category: Category | undefined =
    filter !== "todos" && (filter === "relogios" || cats.some((c) => c.slug === filter) || MENU_CATEGORIES.includes(filter)) ? filter : undefined;

  const ate = Number(params.get("ate")) || 0;
  const de = Number(params.get("de")) || 0;
  const ordem = params.get("ordem") ?? "";

  const { data, loading, error, retry } = useProducts({ metal, category });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [menuKey, filter]);

  let products = data.filter((p) => (!ate || p.priceCents <= ate) && (!de || p.priceCents > de));
  if (ordem === "menor") products = [...products].sort((a, b) => a.priceCents - b.priceCents);
  if (ordem === "maior") products = [...products].sort((a, b) => b.priceCents - a.priceCents);

  // A API já devolve as peças mais recentes primeiro: "novos" só muda o título.
  const titulo = category
    ? rotuloCategoria(category)
    : ordem === "novos" && !metal && !ate
      ? "Lançamentos"
    : !metal && FAIXAS_PRESENTE.includes(ate)
      ? `Presentes até ${formatarBRL(ate)}`
      : metal === "prata"
        ? "Banhados a prata"
        : metal === "ouro"
          ? "Banhados a ouro"
          : "Todas as joias";

  const qs = params.toString() ? `?${params}` : "";
  const ir = (m: MenuKey, f: string) => navigate(`/categoria/${m}/${f}${qs}`);

  const setParam = (updates: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const precoAtual = ate ? `ate-${ate}` : de ? `de-${de}` : "";
  const filtrosAtivos = Boolean(ate || de || ordem || metal || category);

  return (
    <div className="mx-auto grid max-w-[1360px] gap-5 px-[clamp(16px,3vw,40px)] pt-7">
      <nav className="text-[12px] tracking-[0.1em] text-[#5E7473] uppercase">
        <Link to="/" className="text-[#5E7473] hover:text-teal">Início</Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-teal">{titulo}</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 font-serif text-[clamp(34px,4vw,52px)] leading-[1.05] font-normal text-teal-dark">{titulo}</h1>
        {!loading && !error && (
          <span className="text-[13.5px] text-muted">
            {products.length} {products.length === 1 ? "peça" : "peças"}
          </span>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {[{ key: "todos", label: "Todas" }, ...cats.map((c) => ({ key: c.slug, label: c.label }))].map((t) => {
          const ativa = (category ?? "todos") === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => ir(menu, t.key)}
              className={`shrink-0 cursor-pointer rounded-full border-none px-[18px] py-2.5 text-[13.5px] font-semibold transition-colors ${
                ativa ? "bg-teal text-white" : "bg-chip text-text hover:bg-mist-2"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Select
          value={metal ?? ""}
          onChange={(v) => ir((v || "colecoes") as MenuKey, filter)}
          active={Boolean(metal)}
          options={[
            { value: "", label: "Banho: todos" },
            { value: "prata", label: "Banhados a prata" },
            { value: "ouro", label: "Banhados a ouro" },
          ]}
        />
        <Select
          value={precoAtual}
          active={Boolean(precoAtual)}
          onChange={(v) => {
            const [tipo, valor] = v.split("-");
            setParam({ ate: tipo === "ate" ? valor : "", de: tipo === "de" ? valor : "" });
          }}
          options={
            // Faixa vinda de "Presentes" (R$50, 80…) não está na lista fixa.
            PRECOS.some((p) => p.value === precoAtual)
              ? PRECOS
              : [...PRECOS, { value: precoAtual, label: `Até ${formatarBRL(ate)}` }]
          }
        />
        <Select value={ordem} active={Boolean(ordem)} onChange={(v) => setParam({ ordem: v })} options={ORDENS} />
        <span className="flex items-center gap-2 text-[13px] font-semibold text-teal-mid sm:ml-auto">
          <Clock size={15} strokeWidth={1.8} />
          Feitas sob encomenda · chegam em {textoPrazo()}
        </span>
      </div>

      <section className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-[18px] pt-2">
        {loading && <CatalogLoading />}
        {!loading && error && <CatalogError message={error} onRetry={retry} />}
        {!loading && !error && products.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-4 py-16 text-center">
            <p className="m-0 font-serif text-[24px] text-teal-dark">
              {category === "relogios" && !metal && !ate && !de ? "Nossos relógios chegam em breve" : "Nenhuma peça com esses filtros"}
            </p>
            {category === "relogios" && !metal && !ate && !de && (
              <p className="m-0 max-w-md text-[14.5px] leading-relaxed text-text-2">
                Estamos escolhendo os modelos para a loja. Enquanto isso, veja as joias.
              </p>
            )}
            {category === "relogios" && !metal && !ate && !de && (
              <button
                type="button"
                onClick={() => navigate("/categoria/colecoes/todos")}
                className="cursor-pointer rounded-full border-none bg-teal px-6 py-3.5 text-[14px] font-semibold text-white hover:bg-teal-dark"
              >
                Ver as joias
              </button>
            )}
            {filtrosAtivos && category !== "relogios" && (
              <button
                type="button"
                onClick={() => navigate("/categoria/colecoes/todos")}
                className="cursor-pointer rounded-full border-none bg-teal px-6 py-3.5 text-[14px] font-semibold text-white hover:bg-teal-dark"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
        {!loading && !error && products.map((p) => <ProductCard key={p.id} product={p} />)}
      </section>
    </div>
  );
}
