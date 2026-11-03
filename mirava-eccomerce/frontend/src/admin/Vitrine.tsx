// Vitrine da home: a dona escolhe e ordena as peças de cada espaço; espaço
// vazio volta para a regra automática (mais vendidos, mais recentes). Só peças
// publicadas aparecem na loja. Os avisos do topo ficam em "Banners e avisos".

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Search, Trash2, X } from "lucide-react";
import { imageUrl } from "../catalogo/consultas";
import { showcase, type ShowcaseSlot } from "../lib/extras";
import { growthApi, productApi, type AdminAnnouncement, type AdminProduct } from "./api";
import Toggle from "./Toggle";

interface Peca {
  id: string;
  name: string;
  image: string | null;
}

const ESPACOS: { slot: ShowcaseSlot; titulo: string; texto: string; limite: number }[] = [
  { slot: "queridinhas", titulo: "As queridinhas", texto: "Aba “Mais vendidos” da home. Vazio = ordem de vendas.", limite: 8 },
  { slot: "lancamentos", titulo: "Lançamentos", texto: "Aba “Lançamentos” da home. Vazio = peças mais recentes.", limite: 6 },
  { slot: "presentes", titulo: "Presentes", texto: "Peças sugeridas na seção “Presentear é com a gente”. Vazio = só os atalhos de preço.", limite: 6 },
];

export default function Vitrine() {
  const [espacos, setEspacos] = useState<Record<ShowcaseSlot, Peca[]> | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    showcase(true).then((v) => {
      const map = (ps: typeof v.queridinhas) => ps.map((p) => ({ id: p.id, name: p.name, image: imageUrl(p.images[0]) }));
      setEspacos({ queridinhas: map(v.queridinhas), lancamentos: map(v.lancamentos), presentes: map(v.presentes) });
    });
  }, []);

  return (
    <>
      {erro && <p className="m-0 rounded-[20px] bg-[#FDECEC] p-4 text-[13.5px] text-[#B4443C]">{erro}</p>}
      {!espacos ? (
        <p className="m-0 rounded-[20px] border border-line bg-white px-5 py-10 text-center text-muted">Carregando…</p>
      ) : (
        ESPACOS.map((e) => <Espaco key={e.slot} {...e} inicial={espacos[e.slot]} onErro={setErro} />)
      )}
    </>
  );
}

function Espaco({
  slot, titulo, texto, limite, inicial, onErro,
}: {
  slot: ShowcaseSlot;
  titulo: string;
  texto: string;
  limite: number;
  inicial: Peca[];
  onErro: (e: string | null) => void;
}) {
  const [pecas, setPecas] = useState(inicial);
  const [salvo, setSalvo] = useState(true);
  const [salvando, setSalvando] = useState(false);
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

  const mudar = (next: Peca[]) => {
    setPecas(next);
    setSalvo(false);
  };
  const mover = (i: number, d: -1 | 1) => {
    const next = [...pecas];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    mudar(next);
  };

  async function salvar() {
    onErro(null);
    setSalvando(true);
    try {
      await growthApi.setShowcase(slot, pecas.map((p) => p.id));
      setSalvo(true);
    } catch (e) {
      onErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const cheio = pecas.length >= limite;

  return (
    <section className="grid gap-4 rounded-[20px] border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 font-serif text-[22px] font-normal text-teal-dark">{titulo}</h2>
          <p className="m-0 mt-1 text-[13px] text-muted">
            {texto} Até {limite} peças.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvo || salvando}
          className="cursor-pointer rounded-full border-none bg-teal px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-teal-dark disabled:cursor-default disabled:bg-mist disabled:text-muted"
        >
          {salvando ? "Salvando…" : salvo ? "Salvo" : "Salvar ordem"}
        </button>
      </div>

      {pecas.length > 0 && (
        <ol className="m-0 grid list-none gap-2 p-0">
          {pecas.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 rounded-[14px] bg-fog px-3 py-2">
              <span className="w-5 text-center text-[12px] font-bold text-muted">{i + 1}</span>
              {p.image ? <img src={p.image} alt="" className="h-10 w-10 rounded-[10px] object-cover" /> : <span className="h-10 w-10 rounded-[10px] bg-mist" />}
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">{p.name}</span>
              <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)} className="cursor-pointer border-none bg-transparent p-1 text-muted hover:text-teal disabled:opacity-30">
                <ArrowUp size={15} />
              </button>
              <button type="button" aria-label="Descer" disabled={i === pecas.length - 1} onClick={() => mover(i, 1)} className="cursor-pointer border-none bg-transparent p-1 text-muted hover:text-teal disabled:opacity-30">
                <ArrowDown size={15} />
              </button>
              <button type="button" aria-label="Tirar" onClick={() => mudar(pecas.filter((x) => x.id !== p.id))} className="cursor-pointer border-none bg-transparent p-1 text-muted hover:text-[#B4443C]">
                <X size={15} />
              </button>
            </li>
          ))}
        </ol>
      )}

      {!cheio && (
        <div className="relative">
          <span className="flex items-center gap-2 rounded-full border-[1.5px] border-line bg-white px-4 py-2.5 focus-within:border-teal">
            <Search size={15} className="text-muted" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar peça publicada por nome ou código"
              className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] outline-none"
            />
          </span>
          {resultado.length > 0 && (
            <div className="absolute inset-x-0 top-[calc(100%+6px)] z-10 grid max-h-[320px] overflow-y-auto rounded-[16px] border border-line bg-white p-1.5 shadow-[0_12px_32px_rgba(11,74,77,0.12)]">
              {resultado.map((p) => {
                const ja = pecas.some((x) => x.id === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={ja}
                    onClick={() => {
                      mudar([...pecas, { id: p.id, name: p.name, image: imageUrl(p.image ?? undefined) }]);
                      setBusca("");
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-[12px] border-none bg-transparent px-2.5 py-2 text-left text-[13.5px] text-text hover:bg-fog disabled:cursor-default disabled:opacity-40"
                  >
                    <Plus size={14} className="text-teal" />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {ja && <span className="text-[12px] text-muted">já está</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function Avisos({ onErro }: { onErro: (e: string | null) => void }) {
  const [lista, setLista] = useState<AdminAnnouncement[] | null>(null);
  const [salvo, setSalvo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    growthApi.announcements().then(setLista).catch((e: Error) => onErro(e.message));
  }, [onErro]);

  const mudar = (next: AdminAnnouncement[]) => {
    setLista(next);
    setSalvo(false);
  };

  async function salvar() {
    if (!lista) return;
    onErro(null);
    setSalvando(true);
    try {
      await growthApi.setAnnouncements(lista.map((a, i) => ({ ...a, text: a.text.trim(), position: i })));
      setSalvo(true);
    } catch (e) {
      onErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="grid gap-4 rounded-[20px] border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 font-serif text-[22px] font-normal text-teal-dark">Avisos do topo</h2>
          <p className="m-0 mt-1 text-[13px] text-muted">A faixa teal que corre no alto da loja. Até 10 avisos, de 3 a 120 caracteres.</p>
        </div>
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvo || salvando}
          className="cursor-pointer rounded-full border-none bg-teal px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-teal-dark disabled:cursor-default disabled:bg-mist disabled:text-muted"
        >
          {salvando ? "Salvando…" : salvo ? "Salvo" : "Salvar avisos"}
        </button>
      </div>
      {!lista ? (
        <p className="m-0 text-muted">Carregando…</p>
      ) : (
        <div className="grid gap-2">
          {lista.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={a.text}
                maxLength={120}
                onChange={(e) => mudar(lista.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                className={`min-w-0 flex-1 rounded-[12px] border-[1.5px] border-line px-3 py-2.5 text-[13.5px] outline-none focus:border-teal ${a.active ? "text-text" : "text-muted"}`}
              />
              <Toggle pequeno ligado={a.active} rotulo="Aviso ativo" onClick={() => mudar(lista.map((x, j) => (j === i ? { ...x, active: !x.active } : x)))} />
              <button type="button" aria-label="Apagar aviso" onClick={() => mudar(lista.filter((_, j) => j !== i))} className="cursor-pointer border-none bg-transparent p-1 text-muted hover:text-[#B4443C]">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {lista.length < 10 && (
            <button
              type="button"
              onClick={() => mudar([...lista, { text: "", position: lista.length, active: true }])}
              className="flex w-fit cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-line bg-white px-4 py-2 text-[13px] font-semibold text-teal hover:border-teal"
            >
              <Plus size={14} /> Novo aviso
            </button>
          )}
        </div>
      )}
    </section>
  );
}
