// Busca do design v5: painel que desce do topo sobre um véu teal, com
// resultados ao vivo enquanto a cliente digita. Enter leva à página /busca
// com a lista completa.

import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useProducts } from "../catalogo/hooks";
import { imageUrl } from "../catalogo/consultas";
import { formatarBRL } from "../lib/dinheiro";

const MAIS_BUSCADOS = ["Anel", "Colar", "Brinco", "Berloque", "Ouro"];

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

  // Sem termo, mostra as mais vendidas como sugestão.
  const { data: products, loading, error } = useProducts(
    term ? { search: term, limit: 8 } : { bestSellers: true, limit: 4 },
  );

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

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="animate-fade-in absolute inset-0 bg-teal-dark/35" onClick={onClose} />
      <div className="animate-pop relative max-h-[90vh] overflow-y-auto rounded-b-[36px] bg-white px-[clamp(16px,3vw,40px)] pt-7 pb-10">
        <div className="mx-auto grid max-w-[1000px] gap-6">
          <form onSubmit={submit} className="flex items-center gap-3 rounded-full bg-mist-2 py-1.5 pr-1.5 pl-[22px]">
            <Search size={20} className="shrink-0 text-teal" strokeWidth={1.8} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar anéis, colares, berloques..."
              className="min-w-0 flex-1 border-none bg-transparent text-[17px] text-text outline-none placeholder:text-[#8A9A9B]"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar busca"
              className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border-none bg-white text-text"
            >
              <X size={18} strokeWidth={1.8} />
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <span>Mais buscados:</span>
            {MAIS_BUSCADOS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setQuery(t)}
                className="cursor-pointer rounded-full border-none bg-chip px-3.5 py-1.5 text-[13px] font-medium text-text transition-colors hover:bg-mist-2"
              >
                {t}
              </button>
            ))}
          </div>

          {error ? (
            <p className="m-0 text-[14px] text-muted">Não foi possível buscar agora. Tente de novo em instantes.</p>
          ) : !loading && products.length === 0 ? (
            <p className="m-0 text-[14px] text-muted">
              Nenhuma peça encontrada. Tente “anel”, “prata” ou “berloque”.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {products.map((p) => {
                const cover = imageUrl(p.images[0]);
                return (
                  <Link key={p.id} to={`/produto/${p.slug}`} onClick={onClose} className="group grid gap-2 text-text hover:text-text">
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
        </div>
      </div>
    </div>
  );
}
