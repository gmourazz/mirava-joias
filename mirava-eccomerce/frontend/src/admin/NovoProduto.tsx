// Novo produto (design v5): peça cadastrada à mão, fora da Lilly. O preço é
// calculado no servidor a partir do atacado e do markup (decisão 21); aqui é
// só a prévia. Sem "publicar agora", fica salva como rascunho.

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, X } from "lucide-react";
import { imageUrl } from "../catalogo/consultas";
import { formatarBRL } from "../lib/dinheiro";
import { lojaApi, uploadImage, type AdminCategory } from "./api";
import Select from "../components/Select";

export default function NovoProduto({ cats, fechar, criado }: { cats: AdminCategory[]; fechar: () => void; criado: (id: string) => void }) {
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState(cats[0]?.slug ?? "outros");
  const [metal, setMetal] = useState<"prata" | "ouro">("prata");
  const [custo, setCusto] = useState("");
  const [markup, setMarkup] = useState("");
  const [descricao, setDescricao] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [publicar, setPublicar] = useState(false);
  const [padrao, setPadrao] = useState(200);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    lojaApi.settings().then((s) => setPadrao(s.default_markup_pct)).catch(() => {});
  }, []);

  const cat = cats.find((c) => c.slug === categoria);
  const mk = markup ? Number(markup) : (cat?.markup_pct ?? padrao);
  const custoC = Math.round(Number(custo.replace(",", ".")) * 100) || 0;
  const preco = Math.round(custoC * (1 + mk / 100));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const r = await lojaApi.createProduct({
        name: nome.trim(), description: descricao.trim(), category: categoria, metal,
        cost_cents: custoC, markup_pct: markup ? Number(markup) : null, images: fotos, published: publicar,
      });
      criado(r.id);
    } catch (err) {
      setErro((err as Error).message);
      setSalvando(false);
    }
  }

  const campo = "rounded-[14px] border-[1.5px] border-line bg-white px-3.5 py-3 text-[14px] outline-none focus:border-teal";
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-teal-dark/35 p-4" onClick={fechar}>
      <form onSubmit={enviar} onClick={(e) => e.stopPropagation()} className="animate-fade-in grid max-h-[90vh] w-full max-w-[560px] gap-4 overflow-y-auto rounded-3xl bg-white p-6">
        <div className="flex items-start justify-between">
          <h2 className="m-0 font-serif text-[26px] font-normal text-teal-dark">Novo produto</h2>
          <button type="button" aria-label="Fechar" onClick={fechar} className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border-none bg-chip">
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-2">
          <span className="text-[13px] font-semibold text-text-2">Foto</span>
          <div className="flex flex-wrap gap-2">
            {fotos.map((f) => (
              <span key={f} className="relative h-20 w-20 overflow-hidden rounded-xl bg-mist-3">
                <img src={imageUrl(f) ?? ""} alt="" className="h-full w-full object-cover" />
                <button type="button" aria-label="Tirar" onClick={() => setFotos((l) => l.filter((x) => x !== f))} className="absolute top-1 right-1 grid h-5 w-5 cursor-pointer place-items-center rounded-full border-none bg-white text-[#B4443C]">
                  <X size={12} />
                </button>
              </span>
            ))}
            <button type="button" onClick={() => arquivo.current?.click()} className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border-[1.5px] border-dashed border-line-strong bg-fog text-teal">
              <ImagePlus size={20} />
            </button>
            <input
              ref={arquivo}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) uploadImage(f, "produtos").then((p) => setFotos((l) => [...l, p])).catch((err: Error) => setErro(err.message));
              }}
            />
          </div>
          <span className="text-[12px] text-muted">Produtos da Lilly já vêm com as fotos sincronizadas: use "Importar da Lilly" para eles.</span>
        </div>

        <input required minLength={3} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className={campo} />
        <div className="grid grid-cols-2 gap-3">
          <Select variant="field" ariaLabel="Categoria" value={categoria} onChange={setCategoria} options={cats.map((c) => ({ value: c.slug, label: c.label }))} />
          <Select
            variant="field"
            ariaLabel="Banho"
            value={metal}
            onChange={(v) => setMetal(v as "prata" | "ouro")}
            options={[{ value: "prata", label: "Banho: banhado a prata" }, { value: "ouro", label: "Banho: banhado a ouro" }]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-[12.5px] font-semibold text-text-2">
            Preço de atacado (R$)
            <input required inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value.replace(/[^\d,.]/g, ""))} placeholder="23,00" className={campo} />
          </label>
          <label className="grid gap-1 text-[12.5px] font-semibold text-text-2">
            Lucro aplicado (%)
            <input inputMode="numeric" value={markup} onChange={(e) => setMarkup(e.target.value.replace(/\D/g, ""))} placeholder={`${Math.round(cat?.markup_pct ?? padrao)} (herdado)`} className={campo} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1 rounded-xl bg-mist p-3">
            <span className="text-[11.5px] text-muted">Preço na loja (prévia)</span>
            <strong className="text-teal">{formatarBRL(preco)}</strong>
          </div>
          <div className="grid gap-1 rounded-xl bg-fog p-3">
            <span className="text-[11.5px] text-muted">Lucro/peça</span>
            <strong className="text-success">{formatarBRL(preco - custoC)}</strong>
          </div>
        </div>
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Descrição (na voz da Mirava)" className={`${campo} resize-y`} />
        <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-text">
          <input type="checkbox" checked={publicar} onChange={(e) => setPublicar(e.target.checked)} className="h-4 w-4 accent-teal" />
          <span>
            Publicar na loja agora <span className="text-[12.5px] text-muted">(senão, fica salvo como rascunho)</span>
          </span>
        </label>
        {erro && <p className="m-0 rounded-2xl bg-[#FDECEC] px-4 py-3 text-[13px] text-[#B4443C]">{erro}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={fechar} className="flex-1 cursor-pointer rounded-full border-[1.5px] border-line-strong bg-white py-3 text-[14px] font-semibold text-teal">
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className="flex-[2] cursor-pointer rounded-full border-none bg-teal py-3 text-[14px] font-semibold text-white disabled:opacity-50">
            {salvando ? "Criando…" : "Criar produto"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
