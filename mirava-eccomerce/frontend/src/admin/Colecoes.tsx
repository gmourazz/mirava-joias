// Coleções (menu "Coleções" da loja, decisão 37): a dona cria a coleção, escolhe
// e ordena as peças e pode trazer peças novas da Lilly colando o link da página
// delas. Só peças publicadas aparecem na loja.

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { imageUrl } from "../catalogo/consultas";
import { formatarBRL } from "../lib/dinheiro";
import { lojaApi, productApi, uploadImage, type AdminCollection, type AdminProduct } from "./api";
import BuscaProduto from "./BuscaProduto";
import Toggle from "./Toggle";

const card = "grid gap-4 rounded-[20px] border border-line bg-white p-5";
const campo = "w-full min-w-0 rounded-[12px] border-[1.5px] border-line bg-white px-3 py-2.5 text-[14px] outline-none focus:border-teal";
const botao = "cursor-pointer rounded-full border-none bg-teal px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-teal-dark disabled:cursor-default disabled:opacity-50";
const botaoClaro = "cursor-pointer rounded-full border-[1.5px] border-line bg-white px-4 py-2 text-[13px] font-semibold text-teal hover:border-teal disabled:opacity-50";

export default function Colecoes() {
  const [lista, setLista] = useState<AdminCollection[] | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    lojaApi.collections().then(setLista).catch((e: Error) => setErro(e.message));
  }, []);
  useEffect(carregar, [carregar]);

  async function criar() {
    setErro(null);
    try {
      const r = await lojaApi.createCollection(nome.trim());
      setNome("");
      carregar();
      setAberta(r.slug);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <>
      <section className={card}>
        <div>
          <h2 className="m-0 font-serif text-[22px] font-normal text-teal-dark">Coleções da Mirava</h2>
          <p className="m-0 mt-1 max-w-[70ch] text-[13px] leading-relaxed text-muted">
            Grupos de peças escolhidos por você, como as coleções da fornecedora. Aparecem no menu "Coleções" da loja, com capa e uma página própria.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void criar();
          }}
          className="flex flex-wrap gap-2"
        >
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} placeholder="Nome da nova coleção" className={`${campo} max-w-[360px]`} />
          <button type="submit" disabled={nome.trim().length < 2} className={`${botao} flex items-center gap-1.5`}>
            <Plus size={15} /> Criar coleção
          </button>
        </form>
        {erro && <span className="text-[13px] text-[#B4443C]">{erro}</span>}
      </section>

      {!lista ? (
        <p className="m-0 text-muted">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="m-0 rounded-[20px] border border-line bg-white px-5 py-8 text-center text-[14px] text-muted">Nenhuma coleção ainda. Crie a primeira acima.</p>
      ) : (
        lista.map((c) => (
          <Linha key={c.id} c={c} aberta={aberta === c.slug} alternar={() => setAberta(aberta === c.slug ? null : c.slug)} mudou={carregar} />
        ))
      )}
    </>
  );
}

function Linha({ c, aberta, alternar, mudou }: { c: AdminCollection; aberta: boolean; alternar: () => void; mudou: () => void }) {
  const capa = imageUrl(c.cover ?? undefined);
  return (
    <section className="rounded-[20px] border border-line bg-white">
      <button type="button" onClick={alternar} className="flex w-full cursor-pointer items-center gap-4 rounded-[20px] border-none bg-transparent p-4 text-left">
        <span className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-mist-3">{capa && <img src={capa} alt="" className="h-full w-full object-cover" />}</span>
        <span className="grid min-w-0 flex-1">
          <strong className="truncate text-[16px] text-text">{c.name}</strong>
          <span className="text-[12.5px] text-muted">
            {c.count} no ar{c.total > c.count ? ` · ${c.total - c.count} despublicadas` : ""} · /colecoes/{c.slug}
          </span>
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${c.active && c.count > 0 ? "bg-teal text-white" : "bg-fog text-muted"}`}>
          {!c.active ? "Desligada" : c.count === 0 ? "Sem peça no ar" : "No ar"}
        </span>
      </button>
      {aberta && <Editor slug={c.slug} fechar={alternar} mudou={mudou} />}
    </section>
  );
}

function Editor({ slug, fechar, mudou }: { slug: string; fechar: () => void; mudou: () => void }) {
  const [col, setCol] = useState<AdminCollection | null>(null);
  const [pecas, setPecas] = useState<AdminProduct[]>([]);
  const [salvo, setSalvo] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [links, setLinks] = useState("");
  const [importando, setImportando] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  const carregar = useCallback(() => {
    lojaApi.collection(slug).then((d) => {
      setCol(d.collection);
      setPecas(d.products);
      setSalvo(true);
    }).catch((e: Error) => setMsg(e.message));
  }, [slug]);
  useEffect(carregar, [carregar]);

  if (!col) return <p className="m-0 px-5 pb-5 text-muted">{msg ?? "Carregando…"}</p>;

  const set = (c: Partial<AdminCollection>) => {
    setCol({ ...col, ...c });
    setSalvo(false);
  };
  const mudarPecas = (l: AdminProduct[]) => {
    setPecas(l);
    setSalvo(false);
  };
  const mover = (i: number, d: -1 | 1) => {
    const n = [...pecas];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    mudarPecas(n);
  };

  async function salvar() {
    setMsg(null);
    try {
      await lojaApi.updateCollection(col!.id, { name: col!.name, tagline: col!.tagline, description: col!.description, image: col!.image, position: col!.position, active: col!.active });
      await lojaApi.setCollectionProducts(col!.id, pecas.map((p) => p.id));
      setMsg("Coleção salva.");
      mudou();
      carregar();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  // Um link por vez: mostra o progresso e mantém o ritmo gentil com a Lilly.
  async function importar() {
    const urls = links.split(/\s+/).map((u) => u.trim()).filter(Boolean);
    const novas: AdminProduct[] = [];
    const falhas: string[] = [];
    for (const [i, u] of urls.entries()) {
      setImportando(`Importando ${i + 1} de ${urls.length}…`);
      try {
        const r = await lojaApi.importLink(u);
        if (!pecas.some((p) => p.id === r.product_id) && !novas.some((p) => p.id === r.product_id)) {
          novas.push(await productApi.get(r.product_id));
        }
      } catch (e) {
        falhas.push(`${u.replace(/^https?:\/\/(www\.)?uselilly\.com\//, "")}: ${(e as Error).message}`);
      }
    }
    setImportando(null);
    if (novas.length) mudarPecas([...pecas, ...novas]);
    setLinks(falhas.length ? falhas.map((f) => f.split(": ")[0]).join("\n") : "");
    setMsg(`${novas.length} ${novas.length === 1 ? "peça adicionada" : "peças adicionadas"} à coleção (falta salvar)${falhas.length ? `. Não deu: ${falhas.join(" · ")}` : "."}`);
  }

  return (
    <div className="grid gap-4 border-t border-line p-5">
      <div className="grid gap-3 md:grid-cols-[160px_1fr]">
        <button type="button" onClick={() => arquivo.current?.click()} className="relative grid aspect-[4/3] cursor-pointer place-items-center overflow-hidden rounded-xl border-[1.5px] border-dashed border-line-strong bg-fog p-0 text-teal">
          {imageUrl(col.image ?? undefined) ? (
            <img src={imageUrl(col.image ?? undefined) ?? ""} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="grid justify-items-center gap-1 px-2 text-center text-[12px]"><ImagePlus size={20} /> Foto de capa (ou a 1ª peça)</span>
          )}
          <input
            ref={arquivo}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) uploadImage(f, "banners").then((p) => set({ image: p })).catch((err: Error) => setMsg(err.message));
            }}
          />
        </button>
        <div className="grid gap-2">
          <input value={col.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} placeholder="Nome" className={campo} />
          <input value={col.tagline} maxLength={90} onChange={(e) => set({ tagline: e.target.value })} placeholder="Frase curta (ex.: Brilho de quem sabe o que quer)" className={campo} />
          <textarea value={col.description} maxLength={600} rows={3} onChange={(e) => set({ description: e.target.value })} placeholder="Descrição da coleção" className={`${campo} resize-y`} />
          <div className="flex flex-wrap items-center gap-4 text-[13px] text-text-2">
            <span className="flex items-center gap-2">
              <Toggle pequeno ligado={col.active} rotulo="Coleção ativa" onClick={() => set({ active: !col.active })} /> Visível na loja
            </span>
            <label className="flex items-center gap-2">
              Ordem no menu
              <input inputMode="numeric" value={col.position} onChange={(e) => set({ position: Number(e.target.value.replace(/\D/g, "")) || 0 })} className={`${campo} w-16`} />
            </label>
            <a href={`/colecoes/${col.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-teal">
              Ver na loja <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <strong className="text-[14px] text-text">Peças da coleção ({pecas.length})</strong>
        <BuscaProduto onPick={(p) => mudarPecas([...pecas, p])} excluir={pecas.map((p) => p.id)} />
        {pecas.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 rounded-[14px] bg-fog px-3 py-2">
            <span className="w-5 text-center text-[12px] font-bold text-muted">{i + 1}</span>
            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-[10px] bg-mist-3">{p.image && <img src={imageUrl(p.image) ?? ""} alt="" className="h-full w-full object-cover" />}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] text-text">{p.name}</span>
              <span className="text-[12px] text-muted">
                {formatarBRL(p.price_cents)}
                {!p.published && " · despublicada (não aparece na loja)"}
              </span>
            </span>
            <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)} className="cursor-pointer border-none bg-transparent p-1 text-muted disabled:opacity-30"><ArrowUp size={15} /></button>
            <button type="button" aria-label="Descer" disabled={i === pecas.length - 1} onClick={() => mover(i, 1)} className="cursor-pointer border-none bg-transparent p-1 text-muted disabled:opacity-30"><ArrowDown size={15} /></button>
            <button type="button" aria-label="Tirar da coleção" onClick={() => mudarPecas(pecas.filter((x) => x.id !== p.id))} className="cursor-pointer border-none bg-transparent p-1 text-muted hover:text-[#B4443C]"><X size={15} /></button>
          </div>
        ))}
      </div>

      <div className="grid gap-2 rounded-2xl bg-mist p-4">
        <strong className="text-[14px] text-teal-dark">Trazer peças da Lilly por link</strong>
        <span className="text-[12.5px] text-text-2">
          Cole um link por linha (a página da peça em uselilly.com). A peça entra na loja com o markup da categoria e já vai para esta coleção. Peças que já estão na loja só são adicionadas.
        </span>
        <textarea value={links} rows={3} onChange={(e) => setLinks(e.target.value)} placeholder="https://www.uselilly.com/anel-prata-aro-duplo-nayla/" className={`${campo} resize-y font-mono text-[12.5px]`} />
        <div>
          <button type="button" disabled={!links.trim() || importando !== null} onClick={() => void importar()} className={botao}>
            {importando ?? "Importar e adicionar"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={salvo} onClick={() => void salvar()} className={botao}>{salvo ? "Salvo" : "Salvar coleção"}</button>
        <button type="button" onClick={fechar} className={botaoClaro}>Fechar</button>
        <button
          type="button"
          onClick={() => window.confirm(`Excluir a coleção "${col.name}"? As peças continuam na loja.`) && void lojaApi.deleteCollection(col.id).then(() => { mudou(); fechar(); })}
          className="ml-auto flex cursor-pointer items-center gap-1.5 border-none bg-transparent text-[13px] font-semibold text-muted hover:text-[#B4443C]"
        >
          <Trash2 size={14} /> Excluir coleção
        </button>
        {msg && <span className="basis-full text-[13px] text-text-2">{msg}</span>}
      </div>
    </div>
  );
}
