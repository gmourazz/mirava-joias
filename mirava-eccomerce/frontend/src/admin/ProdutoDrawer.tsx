// Editor da peça (v5): foto, nome, descrição, markup (o preço sai do Go),
// alerta do disjuntor e os interruptores de publicar e de destaque na home.
//
// Do protótipo ficam de fora, por ora, o envio de foto própria, o SEO e a
// vitrine por espaço (capa, queridinhas…): precisam de backend novo.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ExternalLink, X } from "lucide-react";
import { formatarBRL } from "../lib/dinheiro";
import { imageUrl } from "../catalogo/consultas";
import { CATEGORY_LABEL } from "../catalogo/tipos";
import { ApiError } from "../lib/api";
import { productApi, type AdminProduct } from "./api";
import Toggle from "./Toggle";

export default function ProdutoDrawer({ id, fechar, mudou }: { id: string; fechar: () => void; mudou: () => void }) {
  const [p, setP] = useState<AdminProduct | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [markup, setMarkup] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = () =>
    productApi
      .get(id)
      .then((prod) => {
        setP(prod);
        setNome(prod.name);
        setDescricao(prod.description ?? "");
        setMarkup(String(Math.round(prod.markup_pct)));
      })
      .catch((e: Error) => setErro(e.message));

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fechar]);

  async function executar(acao: () => Promise<unknown>, ok: string) {
    setErro(null);
    setAviso(null);
    setSalvando(true);
    try {
      await acao();
      await carregar();
      mudou();
      setAviso(ok);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui salvar");
    } finally {
      setSalvando(false);
    }
  }

  const foto = imageUrl(p?.image ?? undefined);
  const lucro = p ? p.price_cents - p.cost_cents : 0;
  const textoMudou = p && (nome.trim() !== p.name || descricao !== (p.description ?? ""));
  const markupNum = Number(markup.replace(",", "."));
  const markupMudou = p && markup !== "" && markupNum !== Math.round(p.markup_pct);

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div className="animate-fade-in absolute inset-0 bg-teal-dark/35" onClick={fechar} />
      <aside className="animate-drawer absolute inset-y-0 right-0 flex w-[min(500px,100%)] flex-col bg-white">
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
          <div className="grid gap-1">
            <span className="font-mono text-[12px] text-muted">{p?.sku ?? ""}</span>
            <span className="font-serif text-[24px] leading-tight text-teal-dark">Editar produto</span>
          </div>
          <button type="button" aria-label="Fechar" onClick={fechar} className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-none bg-chip">
            <X size={18} />
          </button>
        </div>

        <div className="grid flex-1 content-start gap-5 overflow-y-auto px-6 py-5">
          {erro && <p className="m-0 rounded-2xl bg-[#FDECEC] px-4 py-3 text-[13.5px] text-[#B4443C]">{erro}</p>}
          {aviso && <p className="m-0 rounded-2xl bg-[#E3F6F1] px-4 py-3 text-[13.5px] text-success">{aviso}</p>}
          {!p && !erro && <p className="m-0 text-muted">Carregando…</p>}

          {p && (
            <>
              <div className="flex gap-4">
                <span className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-mist-3">{foto && <img src={foto} alt="" className="h-full w-full object-cover" />}</span>
                <div className="grid content-start gap-1.5 text-[13.5px]">
                  <span className="text-muted">
                    {CATEGORY_LABEL[p.category as keyof typeof CATEGORY_LABEL] ?? p.category} · {p.metal === "ouro" ? "Banhado a ouro" : "Banhado a prata"}
                  </span>
                  <span className="text-muted">{p.units_sold} vendidas pela Mirava</span>
                  {p.supplier_url && (
                    <a href={p.supplier_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-teal">
                      Ver na Lilly <ExternalLink size={13} />
                    </a>
                  )}
                  <a href={`/produto/${p.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-teal">
                    Ver na loja <ExternalLink size={13} />
                  </a>
                </div>
              </div>

              {p.suggested_price_cents !== null && (
                <div className="grid gap-3 rounded-2xl border-[1.5px] border-[#F0D9A8] bg-[#FFFAF2] p-4">
                  <span className="flex items-center gap-2 font-semibold text-[#9A6B12]">
                    <AlertTriangle size={17} strokeWidth={1.8} />
                    Alerta de preço da Lilly
                  </span>
                  <span className="text-[13.5px] text-text-2">
                    O custo mudou e o preço calculado passaria de <strong>{formatarBRL(p.price_cents)}</strong> para{" "}
                    <strong>{formatarBRL(p.suggested_price_cents)}</strong>. {p.suggestion_reason && `(${p.suggestion_reason})`}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => void executar(() => productApi.suggestion(p.id, true), "Preço sugerido aplicado.")}
                      className="cursor-pointer rounded-full border-none bg-teal px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
                    >
                      Aceitar {formatarBRL(p.suggested_price_cents)}
                    </button>
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => void executar(() => productApi.suggestion(p.id, false), "Preço mantido.")}
                      className="cursor-pointer rounded-full border-[1.5px] border-line-strong bg-white px-4 py-2.5 text-[13px] font-semibold text-teal disabled:opacity-50"
                    >
                      Manter {formatarBRL(p.price_cents)}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <Caixa label="Custo Lilly" valor={formatarBRL(p.cost_cents)} />
                <Caixa label="Preço na loja" valor={formatarBRL(p.price_cents)} destaque />
                <Caixa label="Lucro/peça" valor={formatarBRL(lucro)} verde />
              </div>

              <div className="grid gap-2 rounded-2xl bg-fog p-4">
                <span className="text-[13px] font-semibold text-text-2">Markup desta peça</span>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center rounded-full border-[1.5px] border-line bg-white pr-4">
                    <input
                      inputMode="numeric"
                      value={markup}
                      onChange={(e) => setMarkup(e.target.value.replace(/[^\d,.]/g, ""))}
                      className="w-20 rounded-full border-none bg-transparent px-4 py-2.5 text-[15px] font-semibold outline-none"
                    />
                    <span className="text-muted">%</span>
                  </div>
                  <button
                    type="button"
                    disabled={!markupMudou || salvando}
                    onClick={() => void executar(() => productApi.markup(p.id, markupNum), "Markup aplicado e preço recalculado.")}
                    className="cursor-pointer rounded-full border-none bg-teal px-4 py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Aplicar e recalcular preço
                  </button>
                </div>
                <span className="text-[12.5px] text-muted">
                  Entre 20% e 500%. O preço novo é calculado pelo sistema (custo × (1 + markup)) e aparece aqui depois de aplicar.
                  {!p.auto_price && " Hoje esta peça está com preço manual: aplicar o markup volta para o automático."}
                </span>
              </div>

              <label className="grid gap-1.5">
                <span className="text-[13px] font-semibold text-text-2">Nome na loja</span>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="rounded-[14px] border-[1.5px] border-line px-3.5 py-3 text-[14.5px] outline-none focus:border-teal"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[13px] font-semibold text-text-2">Descrição</span>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={5}
                  className="resize-y rounded-[14px] border-[1.5px] border-line px-3.5 py-3 text-[14px] leading-relaxed outline-none focus:border-teal"
                />
                <span className="text-[12px] text-muted">Reescreva na voz da Mirava — copiar o texto da Lilly faz o site competir com ela no Google.</span>
              </label>

              <div className="grid gap-3 rounded-2xl border border-line p-4">
                <Linha titulo="Publicada na loja" sub="Visível para as clientes">
                  <Toggle
                    ligado={p.published}
                    disabled={salvando}
                    rotulo="Publicada"
                    onClick={() => void executar(() => productApi.update(p.id, { published: !p.published }), p.published ? "Peça tirada da loja." : "Peça publicada.")}
                  />
                </Linha>
                <Linha titulo="Destaque na home" sub="Aparece na aba Destaques das queridinhas">
                  <Toggle
                    ligado={p.featured}
                    disabled={salvando}
                    rotulo="Destaque"
                    onClick={() => void executar(() => productApi.update(p.id, { featured: !p.featured }), p.featured ? "Destaque removido." : "Peça em destaque.")}
                  />
                </Linha>
              </div>
            </>
          )}
        </div>

        {p && (
          <div className="flex gap-2 border-t border-line px-6 py-4">
            <button type="button" onClick={fechar} className="flex-1 cursor-pointer rounded-full border-[1.5px] border-line-strong bg-white py-3 text-[14px] font-semibold text-teal">
              Fechar
            </button>
            <button
              type="button"
              disabled={!textoMudou || salvando}
              onClick={() => void executar(() => productApi.update(p.id, { name: nome.trim(), description: descricao }), "Texto salvo.")}
              className="flex-[2] cursor-pointer rounded-full border-none bg-teal py-3 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Salvar texto
            </button>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}

function Caixa({ label, valor, destaque = false, verde = false }: { label: string; valor: string; destaque?: boolean; verde?: boolean }) {
  return (
    <div className={`grid gap-1 rounded-xl p-3 ${destaque ? "bg-mist" : "bg-fog"}`}>
      <span className="text-[11.5px] text-muted">{label}</span>
      <strong className={verde ? "text-success" : destaque ? "text-teal" : "text-text"}>{valor}</strong>
    </div>
  );
}

function Linha({ titulo, sub, children }: { titulo: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="grid">
        <strong className="text-[14px] text-text">{titulo}</strong>
        <span className="text-[12.5px] text-muted">{sub}</span>
      </span>
      {children}
    </div>
  );
}
