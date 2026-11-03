// Busca de peça publicada para escolher num formulário do painel (vitrine,
// kit, promoção). Mesma busca da tela de Produtos (nome ou SKU).

import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { formatarBRL } from "../lib/dinheiro";
import { productApi, type AdminProduct } from "./api";

export default function BuscaProduto({ onPick, placeholder = "Buscar peça publicada por nome ou código", excluir = [] }: {
  onPick: (p: AdminProduct) => void;
  placeholder?: string;
  excluir?: string[];
}) {
  const [busca, setBusca] = useState("");
  const [resultado, setResultado] = useState<AdminProduct[]>([]);

  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) {
      setResultado([]);
      return;
    }
    let atual = true;
    const t = setTimeout(() => {
      productApi
        .list(new URLSearchParams({ busca: termo, status: "publicados" }))
        .then((p) => atual && setResultado(p.items.slice(0, 8)))
        .catch(() => atual && setResultado([]));
    }, 250);
    return () => {
      atual = false;
      clearTimeout(t);
    };
  }, [busca]);

  return (
    <div className="relative">
      <span className="flex items-center gap-2 rounded-full border-[1.5px] border-line bg-white px-4 py-2.5 focus-within:border-teal">
        <Search size={15} className="text-muted" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] outline-none" />
      </span>
      {resultado.length > 0 && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-20 grid max-h-[320px] overflow-y-auto rounded-[16px] border border-line bg-white p-1.5 shadow-[0_12px_32px_rgba(11,74,77,0.12)]">
          {resultado.map((p) => {
            const ja = excluir.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                disabled={ja}
                onClick={() => {
                  onPick(p);
                  setBusca("");
                }}
                className="flex cursor-pointer items-center gap-3 rounded-[12px] border-none bg-transparent px-2.5 py-2 text-left text-[13.5px] text-text hover:bg-fog disabled:cursor-default disabled:opacity-40"
              >
                <Plus size={14} className="text-teal" />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="text-[12px] text-muted">{ja ? "já está" : formatarBRL(p.price_cents)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
