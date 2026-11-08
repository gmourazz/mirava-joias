// Busca: o campo abre no próprio cabeçalho, na linha do logo, e os
// resultados ao vivo caem logo abaixo do menu enquanto a cliente digita.
// Enter leva à página /busca com a lista completa.

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useProducts } from "../catalogo/hooks";
import { imageUrl } from "../catalogo/consultas";
import { formatarBRL } from "../lib/dinheiro";

/** Espera a cliente parar de digitar antes de perguntar à API — uma
 *  requisição por tecla seria desperdício. */
function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const term = useDebounced(query.trim(), 250);
  const navigate = useNavigate();

  // Peças só aparecem depois de digitar; antes, só o campo de busca.
  const { data: products, loading, error } = useProducts(term ? { search: term, limit: 24 } : { limit: 0 });
  const temTermo = term.length > 0;

  // Os resultados cobrem toda a área abaixo do cabeçalho (fundo branco, sem a
  // home aparecendo por trás). O cabeçalho fica `sticky`, mas a faixa de
  // avisos rola junto com a página: mede onde o cabeçalho termina e trava a
  // rolagem da página enquanto os resultados estão abertos.
  const formRef = useRef<HTMLFormElement>(null);
  const [topo, setTopo] = useState(0);
  useLayoutEffect(() => {
    const medir = () => {
      const header = formRef.current?.closest("header");
      if (header) setTopo(Math.round(header.getBoundingClientRect().bottom));
    };
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, { passive: true });
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir);
    };
  }, [temTermo]);
  useEffect(() => {
    if (!temTermo) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, [temTermo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/busca?q=${encodeURIComponent(query.trim())}`);
    onClose();
  };

  // Fica DENTRO do cabeçalho (decisão do layout): o campo ocupa a linha do logo
  // e os resultados caem logo abaixo do menu. O cabeçalho é `sticky`, então
  // `top-full` é a borda de baixo dele; o véu escurece só a página.
  return (
    <>
      <form
        ref={formRef}
        onSubmit={submit}
        className="animate-fade-in z-10 col-start-2 row-start-1 flex items-center gap-2 self-center bg-white lg:ml-44 lg:max-w-[640px] lg:bg-transparent"
      >
        <span className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-mist-2 py-1 pr-1 pl-4">
          <Search size={18} className="shrink-0 text-teal" strokeWidth={1.8} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar anéis, colares, berloques..."
            aria-label="Buscar"
            className="min-w-0 flex-1 border-none bg-transparent py-2 text-[15px] text-text outline-none placeholder:text-[#8A9A9B]"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar busca"
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border-none bg-white text-text"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </span>
      </form>

      {temTermo && (
        <div
          className="animate-fade-in fixed inset-x-0 bottom-0 z-20 overflow-y-auto overscroll-contain border-t border-line bg-white px-[clamp(16px,3vw,48px)] pt-6 pb-10"
          style={{ top: topo }}
        >
          <div className="mx-auto grid max-w-[1200px] gap-5">
            <p className="m-0 text-[14px] text-muted">
              {loading ? "Buscando…" : error ? "" : `${products.length} ${products.length === 1 ? "resultado" : "resultados"} para `}
              {!loading && !error && <strong className="text-text">“{term}”</strong>}
            </p>

            {error ? (
              <p className="m-0 text-[14px] text-muted">Não foi possível buscar agora. Tente de novo em instantes.</p>
            ) : !loading && products.length === 0 ? (
              <p className="m-0 text-[15px] text-muted">Nenhuma peça encontrada. Tente “anel”, “prata” ou “berloque”.</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {products.map((p) => {
                  const cover = imageUrl(p.images[0]);
                  return (
                    <Link key={p.id} to={`/produto/${p.slug}`} onClick={onClose} className="group grid content-start gap-2 text-text hover:text-text">
                      <span className="aspect-square overflow-hidden rounded-[20px] bg-mist-3">
                        {cover && (
                          <img src={cover} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                        )}
                      </span>
                      <span className="text-[14.5px] font-medium">{p.name}</span>
                      <span className="text-[15px] font-bold text-teal">{formatarBRL(p.priceCents)}</span>
                    </Link>
                  );
                })}
              </div>
            )}

            {!loading && products.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  navigate(`/busca?q=${encodeURIComponent(term)}`);
                  onClose();
                }}
                className="mx-auto cursor-pointer rounded-full border-[1.5px] border-teal bg-white px-7 py-3 text-[14px] font-semibold text-teal hover:bg-teal hover:text-white"
              >
                Ver todos os resultados
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
