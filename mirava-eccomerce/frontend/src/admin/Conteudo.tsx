// Banners e avisos (design v5): os slides do topo da home, a galeria
// "Inspire-se no Instagram" e a faixa de avisos. Fotos enviadas pelo painel
// (decisão 35); os links dos botões só apontam para dentro da loja.

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from "lucide-react";
import { imageUrl } from "../catalogo/consultas";
import { lojaApi, uploadImage, type BannerData, type GalleryItem } from "./api";
import { Avisos } from "./Vitrine";
import Toggle from "./Toggle";

const card = "grid gap-4 rounded-[20px] border border-line bg-white p-5";
const campo = "rounded-[12px] border-[1.5px] border-line bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-teal";
const botaoSalvar = "cursor-pointer rounded-full border-none bg-teal px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-teal-dark disabled:cursor-default disabled:bg-mist disabled:text-muted";

export default function Conteudo() {
  const [erro, setErro] = useState<string | null>(null);
  return (
    <>
      {erro && <p className="m-0 rounded-[20px] bg-[#FDECEC] p-4 text-[13.5px] text-[#B4443C]">{erro}</p>}
      <Banners onErro={setErro} />
      <Galeria onErro={setErro} />
      <Avisos onErro={setErro} />
    </>
  );
}

function Foto({ path, pasta, onChange, onErro }: { path: string | null; pasta: "banners" | "galeria"; onChange: (p: string) => void; onErro: (e: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const src = imageUrl(path ?? undefined);
  return (
    <button type="button" onClick={() => ref.current?.click()} className="relative grid aspect-[4/3] w-36 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border-[1.5px] border-dashed border-line-strong bg-fog p-0 text-teal">
      {src ? <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <span className="grid justify-items-center gap-1 text-[12px]"><ImagePlus size={20} /> Enviar foto</span>}
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) uploadImage(f, pasta).then(onChange).catch((err: Error) => onErro(err.message));
        }}
      />
    </button>
  );
}

function Banners({ onErro }: { onErro: (e: string | null) => void }) {
  const [lista, setLista] = useState<BannerData[] | null>(null);
  const [salvo, setSalvo] = useState(true);
  const carregar = useCallback(() => {
    lojaApi.banners().then(setLista).catch((e: Error) => onErro(e.message));
  }, [onErro]);
  useEffect(carregar, [carregar]);
  if (!lista) return null;

  const mudar = (l: BannerData[]) => {
    setLista(l);
    setSalvo(false);
  };
  const set = (i: number, b: Partial<BannerData>) => mudar(lista.map((x, j) => (j === i ? { ...x, ...b } : x)));
  const mover = (i: number, d: -1 | 1) => {
    const n = [...lista];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    mudar(n);
  };

  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 font-serif text-[22px] font-normal text-teal-dark">Banners da home</h2>
          <p className="m-0 mt-1 text-[13px] text-muted">Os slides do topo da loja. Mude a ordem com as setas. Sem banner cadastrado, ficam os slides de fábrica.</p>
        </div>
        <button
          type="button"
          disabled={salvo}
          className={botaoSalvar}
          onClick={() => {
            onErro(null);
            void lojaApi.setBanners(lista).then(() => { setSalvo(true); carregar(); }).catch((e: Error) => onErro(e.message));
          }}
        >
          {salvo ? "Salvo" : "Salvar banners"}
        </button>
      </div>
      {lista.map((b, i) => (
        <div key={b.id ?? `novo-${i}`} className="flex flex-wrap gap-3 rounded-2xl bg-fog p-3">
          <Foto path={b.image} pasta="banners" onChange={(p) => set(i, { image: p })} onErro={onErro} />
          <div className="grid min-w-[240px] flex-1 gap-2">
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <input value={b.eyebrow} maxLength={40} onChange={(e) => set(i, { eyebrow: e.target.value })} placeholder="Selo (LANÇAMENTO)" className={campo} />
              <input value={b.title} maxLength={90} onChange={(e) => set(i, { title: e.target.value })} placeholder="Título" className={campo} />
            </div>
            <input value={b.subtitle} maxLength={200} onChange={(e) => set(i, { subtitle: e.target.value })} placeholder="Texto de apoio" className={campo} />
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <input value={b.cta_label} maxLength={30} onChange={(e) => set(i, { cta_label: e.target.value })} placeholder="Botão" className={campo} />
              <input value={b.cta_url} onChange={(e) => set(i, { cta_url: e.target.value })} placeholder="/categoria/colecoes/todos" className={campo} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Toggle pequeno ligado={b.active} rotulo="Banner ativo" onClick={() => set(i, { active: !b.active })} />
            <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)} className="cursor-pointer border-none bg-transparent p-1 text-muted disabled:opacity-30"><ArrowUp size={15} /></button>
            <button type="button" aria-label="Descer" disabled={i === lista.length - 1} onClick={() => mover(i, 1)} className="cursor-pointer border-none bg-transparent p-1 text-muted disabled:opacity-30"><ArrowDown size={15} /></button>
            <button type="button" aria-label="Apagar" onClick={() => mudar(lista.filter((_, j) => j !== i))} className="cursor-pointer border-none bg-transparent p-1 text-muted hover:text-[#B4443C]"><Trash2 size={15} /></button>
          </div>
        </div>
      ))}
      {lista.length < 8 && (
        <button
          type="button"
          onClick={() => mudar([...lista, { eyebrow: "", title: "", subtitle: "", cta_label: "Ver peças", cta_url: "/categoria/colecoes/todos", image: null, active: true }])}
          className="flex w-fit cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-line bg-white px-4 py-2 text-[13px] font-semibold text-teal hover:border-teal"
        >
          <Plus size={14} /> Novo banner
        </button>
      )}
    </section>
  );
}

function Galeria({ onErro }: { onErro: (e: string | null) => void }) {
  const [lista, setLista] = useState<GalleryItem[] | null>(null);
  const [salvo, setSalvo] = useState(true);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    lojaApi.gallery().then(setLista).catch((e: Error) => onErro(e.message));
  }, [onErro]);
  if (!lista) return null;
  const mudar = (l: GalleryItem[]) => {
    setLista(l);
    setSalvo(false);
  };

  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 font-serif text-[22px] font-normal text-teal-dark">Inspire-se no Instagram</h2>
          <p className="m-0 mt-1 text-[13px] text-muted">Até 12 fotos reais da loja (decisão 28: nada de banco de imagem). Sem foto, a seção some da home.</p>
        </div>
        <button type="button" disabled={salvo} className={botaoSalvar} onClick={() => void lojaApi.setGallery(lista).then(() => setSalvo(true)).catch((e: Error) => onErro(e.message))}>
          {salvo ? "Salvo" : "Salvar galeria"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {lista.map((g, i) => (
          <div key={g.image} className="grid gap-1.5">
            <span className="relative aspect-square overflow-hidden rounded-xl bg-mist-3">
              <img src={imageUrl(g.image) ?? ""} alt="" className="h-full w-full object-cover" />
              <button type="button" aria-label="Tirar" onClick={() => mudar(lista.filter((_, j) => j !== i))} className="absolute top-1 right-1 grid h-6 w-6 cursor-pointer place-items-center rounded-full border-none bg-white text-[#B4443C]">
                <Trash2 size={12} />
              </button>
            </span>
            <input
              value={g.link ?? ""}
              onChange={(e) => mudar(lista.map((x, j) => (j === i ? { ...x, link: e.target.value || null } : x)))}
              placeholder="Link do post (opcional)"
              className="rounded-lg border-[1.5px] border-line px-2 py-1 text-[11.5px] outline-none focus:border-teal"
            />
          </div>
        ))}
        {lista.length < 12 && (
          <button type="button" onClick={() => ref.current?.click()} className="grid aspect-square cursor-pointer place-items-center rounded-xl border-[1.5px] border-dashed border-line-strong bg-fog text-teal">
            <ImagePlus size={22} />
          </button>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) uploadImage(f, "galeria").then((p) => mudar([...lista, { image: p, link: null, caption: null }])).catch((err: Error) => onErro(err.message));
          }}
        />
      </div>
    </section>
  );
}
