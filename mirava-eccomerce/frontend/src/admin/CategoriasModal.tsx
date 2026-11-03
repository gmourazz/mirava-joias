// Categorias da loja (design v5): renomear, reordenar e criar. A ordem é a
// do menu da loja. Só dá para excluir categoria sem peça; "Outros" fica.

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { lojaApi, type AdminCategory } from "./api";

function slugDe(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function CategoriasModal({ fechar, mudou }: { fechar: () => void; mudou: () => void }) {
  const [lista, setLista] = useState<AdminCategory[]>([]);
  const [nova, setNova] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    lojaApi.categories().then(setLista).catch((e: Error) => setErro(e.message));
  }, []);
  useEffect(carregar, [carregar]);

  async function rodar(f: () => Promise<unknown>) {
    setErro(null);
    try {
      await f();
      carregar();
      mudou();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  // Reordenar = regravar a posição das duas que trocaram de lugar.
  const mover = (i: number, d: -1 | 1) => {
    const a = lista[i], b = lista[i + d];
    void rodar(async () => {
      await lojaApi.updateCategory(a.slug, a.label, i + d + 1, a.markup_pct);
      await lojaApi.updateCategory(b.slug, b.label, i + 1, b.markup_pct);
    });
  };

  function criar(e: FormEvent) {
    e.preventDefault();
    const label = nova.trim();
    if (!label) return;
    void rodar(() => lojaApi.createCategory(slugDe(label), label)).then(() => setNova(""));
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-teal-dark/35 p-4" onClick={fechar}>
      <div onClick={(e) => e.stopPropagation()} className="animate-fade-in grid max-h-[88vh] w-full max-w-[520px] gap-4 overflow-y-auto rounded-3xl bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="m-0 font-serif text-[26px] font-normal text-teal-dark">Categorias da loja</h2>
            <p className="m-0 mt-1 text-[13px] text-muted">Renomeie, reordene ou crie novas. A ordem é a do menu da loja.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={fechar} className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border-none bg-chip">
            <X size={16} />
          </button>
        </div>
        {erro && <p className="m-0 rounded-2xl bg-[#FDECEC] px-4 py-3 text-[13px] text-[#B4443C]">{erro}</p>}
        <form onSubmit={criar} className="flex gap-2">
          <input value={nova} onChange={(e) => setNova(e.target.value)} maxLength={40} placeholder="Nova categoria (ex.: Argolas)" className="min-w-0 flex-1 rounded-full border-[1.5px] border-line px-4 py-2.5 text-[14px] outline-none focus:border-teal" />
          <button type="submit" className="flex cursor-pointer items-center gap-1 rounded-full border-none bg-teal px-4 text-[13px] font-semibold text-white">
            <Plus size={15} /> Adicionar
          </button>
        </form>
        <div className="grid gap-1.5">
          {lista.map((c, i) => (
            <div key={c.slug} className="flex items-center gap-2 rounded-2xl bg-fog px-3 py-2">
              <span className="w-5 text-center text-[12px] font-bold text-muted">{i + 1}</span>
              <input
                defaultValue={c.label}
                maxLength={40}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== c.label) void rodar(() => lojaApi.updateCategory(c.slug, v, c.position, c.markup_pct));
                }}
                className="min-w-0 flex-1 rounded-lg border-none bg-transparent px-1 py-1 text-[14px] text-text outline-none focus:bg-white"
              />
              <span className="text-[12px] text-muted">{c.count} peças</span>
              <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)} className="cursor-pointer border-none bg-transparent p-1 text-muted disabled:opacity-30">
                <ArrowUp size={14} />
              </button>
              <button type="button" aria-label="Descer" disabled={i === lista.length - 1} onClick={() => mover(i, 1)} className="cursor-pointer border-none bg-transparent p-1 text-muted disabled:opacity-30">
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                aria-label="Excluir"
                disabled={c.count > 0 || c.slug === "outros"}
                onClick={() => void rodar(() => lojaApi.deleteCategory(c.slug))}
                className="cursor-pointer border-none bg-transparent p-1 text-muted hover:text-[#B4443C] disabled:opacity-25"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <p className="m-0 text-[12px] text-muted">Só é possível excluir categorias sem produtos. Mova as peças antes pelo editor do produto.</p>
      </div>
    </div>,
    document.body,
  );
}
