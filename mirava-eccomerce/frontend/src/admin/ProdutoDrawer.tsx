// Editor da peça (v5): checklist antes de publicar, fotos (próprias ou da
// Lilly), onde aparece na loja, nome, descrição, categoria, banho, markup (o
// preço sai do Go, decisão 21), alerta do disjuntor e o Google (SEO).

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ExternalLink, ImagePlus, Star, Trash2, X } from "lucide-react";
import { formatarBRL } from "../lib/dinheiro";
import { imageUrl } from "../catalogo/consultas";
import { ApiError } from "../lib/api";
import { showcase, type ShowcaseSlot } from "../lib/extras";
import { growthApi, lojaApi, productApi, uploadImage, type AdminCategory, type AdminProduct } from "./api";
import Toggle from "./Toggle";

const ESPACOS: { slot: ShowcaseSlot; label: string }[] = [
  { slot: "queridinhas", label: "As queridinhas" },
  { slot: "lancamentos", label: "Lançamentos" },
  { slot: "presentes", label: "Presentes" },
];

export default function ProdutoDrawer({ id, fechar, mudou }: { id: string; fechar: () => void; mudou: () => void }) {
  const [p, setP] = useState<AdminProduct | null>(null);
  const [cats, setCats] = useState<AdminCategory[]>([]);
  const [minMargem, setMinMargem] = useState(50);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [metal, setMetal] = useState<"prata" | "ouro">("prata");
  const [seoT, setSeoT] = useState("");
  const [seoD, setSeoD] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [markup, setMarkup] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  const carregar = () =>
    productApi
      .get(id)
      .then((prod) => {
        setP(prod);
        setNome(prod.name);
        setDescricao(prod.description ?? "");
        setCategoria(prod.category);
        setMetal(prod.metal);
        setSeoT(prod.seo_title ?? "");
        setSeoD(prod.seo_description ?? "");
        setFotos(prod.images ?? []);
        setMarkup(prod.markup_pct === null ? "" : String(Math.round(prod.markup_pct)));
      })
      .catch((e: Error) => setErro(e.message));

  useEffect(() => {
    void carregar();
    lojaApi.categories().then(setCats).catch(() => {});
    lojaApi.settings().then((s) => setMinMargem(s.min_margin_pct)).catch(() => {});
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
      setErro(e instanceof ApiError || e instanceof Error ? e.message : "Não consegui salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function enviarFoto(file: File) {
    setErro(null);
    try {
      const path = await uploadImage(file, "produtos");
      setFotos((f) => (f.includes(path) ? f : [...f, path]));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  // Vitrine: liga/desliga a peça num espaço (a lista inteira é regravada na
  // ordem atual, com a peça no fim).
  async function alternarEspaco(slot: ShowcaseSlot, dentro: boolean) {
    if (!p) return;
    const atual = await showcase(true);
    const ids = atual[slot].map((x) => x.id).filter((x) => x !== p.id);
    if (!dentro) ids.push(p.id);
    await growthApi.setShowcase(slot, ids);
  }

  const lucro = p ? p.price_cents - p.cost_cents : 0;
  const margem = p && p.price_cents > 0 ? (lucro / p.price_cents) * 100 : 0;
  const mudou_ =
    p &&
    (nome.trim() !== p.name ||
      descricao !== (p.description ?? "") ||
      categoria !== p.category ||
      metal !== p.metal ||
      seoT !== (p.seo_title ?? "") ||
      seoD !== (p.seo_description ?? "") ||
      fotos.join("|") !== (p.images ?? []).join("|"));
  const markupNum = markup === "" ? null : Number(markup.replace(",", "."));
  const markupMudou = p && markupNum !== (p.markup_pct === null ? null : Math.round(p.markup_pct));

  // Checklist do design: foto, descrição própria, lucro no mínimo, Google.
  const checks = p
    ? [
        { ok: fotos.length > 0, label: "Tem foto" },
        { ok: descricao.trim().length >= 40, label: "Descrição com pelo menos 40 letras" },
        { ok: margem >= minMargem, label: `Lucro de pelo menos ${minMargem}% do preço` },
        { ok: seoT.trim().length > 0 && seoD.trim().length > 0, label: "Título e descrição do Google" },
      ]
    : [];
  const feitos = checks.filter((c) => c.ok).length;
  const podePublicar = checks.slice(0, 3).every((c) => c.ok);

  const tituloGoogle = seoT || (p ? `${p.name} banhado a ${p.metal} | Mirava` : "");
  const descGoogle = seoD || (p ? `${p.name} com verniz protetor e hipoalergênica. Encomendada pra você e entregue em até 20 dias úteis.` : "");

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div className="animate-fade-in absolute inset-0 bg-teal-dark/35" onClick={fechar} />
      <aside className="animate-drawer absolute inset-y-0 right-0 flex w-[min(540px,100%)] flex-col bg-white">
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
          <div className="grid gap-1">
            <span className="font-mono text-[12px] text-muted">{p?.sku ?? (p?.manual ? "cadastrada à mão" : "")}</span>
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
              {/* Checklist antes de publicar */}
              <section className="grid gap-3 rounded-2xl border border-line p-4">
                <div className="flex items-center justify-between">
                  <strong className="text-[14px] text-text">Checklist antes de publicar</strong>
                  <span className="rounded-full bg-mist px-2.5 py-1 text-[12px] font-bold text-teal">{feitos}/4</span>
                </div>
                <ul className="m-0 grid list-none gap-1.5 p-0">
                  {checks.map((c) => (
                    <li key={c.label} className={`flex items-center gap-2 text-[13px] ${c.ok ? "text-text" : "text-muted"}`}>
                      <span className={`grid h-5 w-5 place-items-center rounded-full ${c.ok ? "bg-teal text-white" : "border-[1.5px] border-line-strong"}`}>
                        {c.ok && <Check size={12} strokeWidth={3} />}
                      </span>
                      {c.label}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                  <span className="grid">
                    <strong className="text-[14px] text-text">Publicada na loja</strong>
                    <span className="text-[12.5px] text-muted">
                      {p.published ? "Visível para as clientes" : podePublicar ? "Pronta para ir ao ar" : "Complete os 3 primeiros itens"}
                    </span>
                  </span>
                  <Toggle
                    ligado={p.published}
                    disabled={salvando || (!p.published && !podePublicar)}
                    rotulo="Publicada"
                    onClick={() => void executar(() => productApi.update(p.id, { published: !p.published }), p.published ? "Peça tirada da loja." : "Peça publicada.")}
                  />
                </div>
              </section>

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

              {/* Fotos */}
              <section className="grid gap-2.5">
                <div className="flex items-center justify-between">
                  <strong className="text-[14px] text-text">Fotos</strong>
                  <button
                    type="button"
                    onClick={() => arquivo.current?.click()}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border-none bg-teal px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-teal-dark"
                  >
                    <ImagePlus size={15} /> Enviar minha foto
                  </button>
                  <input
                    ref={arquivo}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void enviarFoto(f);
                      e.target.value = "";
                    }}
                  />
                </div>
                {fotos.length === 0 ? (
                  <p className="m-0 rounded-2xl bg-fog px-4 py-6 text-center text-[13px] text-muted">Sem foto ainda.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {fotos.map((f, i) => {
                      const src = imageUrl(f);
                      return (
                        <div key={f} className={`group relative aspect-square overflow-hidden rounded-xl bg-mist-3 ${i === 0 ? "ring-[3px] ring-teal" : ""}`}>
                          {src && <img src={src} alt="" className="h-full w-full object-cover" />}
                          {i === 0 && <span className="absolute top-1 left-1 rounded-full bg-teal px-1.5 py-0.5 text-[10px] font-bold text-white">PRINCIPAL</span>}
                          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-white/90 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                            {i > 0 && (
                              <button type="button" aria-label="Tornar principal" onClick={() => setFotos((l) => [f, ...l.filter((x) => x !== f)])} className="cursor-pointer border-none bg-transparent p-0.5 text-teal">
                                <Star size={14} />
                              </button>
                            )}
                            {i > 0 && (
                              <button type="button" aria-label="Para a esquerda" onClick={() => setFotos((l) => { const n = [...l]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} className="cursor-pointer border-none bg-transparent p-0.5 text-text">
                                <ArrowLeft size={14} />
                              </button>
                            )}
                            {i < fotos.length - 1 && (
                              <button type="button" aria-label="Para a direita" onClick={() => setFotos((l) => { const n = [...l]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })} className="cursor-pointer border-none bg-transparent p-0.5 text-text">
                                <ArrowRight size={14} />
                              </button>
                            )}
                            <button type="button" aria-label="Tirar foto" onClick={() => setFotos((l) => l.filter((x) => x !== f))} className="cursor-pointer border-none bg-transparent p-0.5 text-[#B4443C]">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <span className="text-[12px] text-muted">A primeira é a principal. Passe o mouse para reordenar ou tirar.</span>
                {!p.manual && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-fog p-3.5">
                    <span className="grid">
                      <strong className="text-[13.5px] text-text">Manter minhas fotos na sincronização</strong>
                      <span className="text-[12px] text-muted">A Lilly troca as fotos às vezes; ligado, a sua escolha não muda.</span>
                    </span>
                    <Toggle
                      pequeno
                      ligado={p.keep_own_photos}
                      disabled={salvando}
                      rotulo="Manter minhas fotos"
                      onClick={() => void executar(() => productApi.update(p.id, { keep_own_photos: !p.keep_own_photos }), "Preferência das fotos salva.")}
                    />
                  </div>
                )}
              </section>

              {/* Onde aparece */}
              <section className="grid gap-2">
                <strong className="text-[14px] text-text">Onde aparece na loja</strong>
                <div className="flex flex-wrap gap-2">
                  <Chip
                    ativo={p.featured}
                    label="Capa (destaques)"
                    onClick={() => void executar(() => productApi.update(p.id, { featured: !p.featured }), "Vitrine atualizada.")}
                  />
                  {ESPACOS.map((e) => {
                    const dentro = p.showcase.includes(e.slot);
                    return (
                      <Chip
                        key={e.slot}
                        ativo={dentro}
                        label={e.label}
                        onClick={() => void executar(() => alternarEspaco(e.slot, dentro), "Vitrine atualizada.")}
                        disabled={!p.published && !dentro}
                      />
                    );
                  })}
                </div>
                {!p.published && <span className="text-[12px] text-muted">Publique a peça para colocá-la nos espaços da home.</span>}
              </section>

              {/* Texto */}
              <label className="grid gap-1.5">
                <span className="text-[13px] font-semibold text-text-2">Nome na loja</span>
                <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[13px] font-semibold text-text-2">Descrição</span>
                <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={5} className={`${campo} resize-y leading-relaxed`} />
                <span className="text-[12px] text-muted">Reescreva na voz da Mirava — copiar o texto da Lilly faz o site competir com ela no Google. Texto editado aqui não é sobrescrito pela sincronização.</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1.5">
                  <span className="text-[13px] font-semibold text-text-2">Categoria</span>
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={campo}>
                    {cats.map((c) => (
                      <option key={c.slug} value={c.slug}>{c.label}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[13px] font-semibold text-text-2">Banho</span>
                  <select value={metal} onChange={(e) => setMetal(e.target.value as "prata" | "ouro")} className={campo}>
                    <option value="prata">Prata</option>
                    <option value="ouro">Ouro 18k</option>
                  </select>
                </label>
              </div>

              {/* Preço */}
              <div className="grid grid-cols-3 gap-2">
                <Caixa label="Custo Lilly" valor={formatarBRL(p.cost_cents)} />
                <Caixa label="Preço na loja" valor={formatarBRL(p.price_cents)} destaque />
                <Caixa label={`Lucro/peça · ${Math.round(margem)}%`} valor={formatarBRL(lucro)} verde={margem >= minMargem} />
              </div>
              <div className="grid gap-2 rounded-2xl bg-fog p-4">
                <span className="text-[13px] font-semibold text-text-2">Markup desta peça</span>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center rounded-full border-[1.5px] border-line bg-white pr-4">
                    <input
                      inputMode="numeric"
                      value={markup}
                      placeholder={String(Math.round(p.effective_markup_pct))}
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
                  {p.markup_pct === null
                    ? `Herdando ${Math.round(p.effective_markup_pct)}% (da categoria ou o padrão da loja). Digite um valor para usar um markup só desta peça.`
                    : "Markup próprio desta peça. Apague o número e aplique para voltar a herdar da categoria."}
                  {" "}Entre 20% e 500%; o preço é calculado pelo sistema.
                  {!p.auto_price && " Hoje esta peça está com preço manual: aplicar o markup volta para o automático."}
                </span>
              </div>

              {/* Google */}
              <section className="grid gap-2.5 rounded-2xl border border-line p-4">
                <strong className="text-[14px] text-text">Google (SEO)</strong>
                <div className="grid gap-0.5 rounded-xl bg-fog p-3">
                  <span className="text-[12px] text-[#4D7A5F]">mirava.com.br › produto › {p.slug}</span>
                  <span className="text-[15px] text-[#1A4FB0]">{tituloGoogle}</span>
                  <span className="text-[12.5px] text-text-2">{descGoogle}</span>
                </div>
                <input value={seoT} maxLength={70} onChange={(e) => setSeoT(e.target.value)} placeholder="Título no Google (até 60 é o ideal)" className={campo} />
                <textarea value={seoD} maxLength={170} onChange={(e) => setSeoD(e.target.value)} rows={2} placeholder="Descrição no Google (até 155 é o ideal)" className={`${campo} resize-none`} />
                <span className={`text-[12px] ${seoT.length > 60 || seoD.length > 155 ? "text-[#9A6B12]" : "text-muted"}`}>
                  {seoT.length}/60 no título · {seoD.length}/155 na descrição
                </span>
              </section>

              <div className="flex flex-wrap gap-3 text-[13px]">
                {p.supplier_url && (
                  <a href={p.supplier_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-teal">
                    Ver na Lilly <ExternalLink size={13} />
                  </a>
                )}
                <a href={`/produto/${p.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-teal">
                  Ver na loja <ExternalLink size={13} />
                </a>
                <span className="text-muted">{p.units_sold} vendidas pela Mirava · {p.available ? "disponível na Lilly" : "esgotada na Lilly"}</span>
              </div>
            </>
          )}
        </div>

        {p && (
          <div className="flex gap-2 border-t border-line px-6 py-4">
            <button type="button" onClick={fechar} className="flex-1 cursor-pointer rounded-full border-[1.5px] border-line-strong bg-white py-3 text-[14px] font-semibold text-teal">
              Cancelar
            </button>
            <button
              type="button"
              disabled={!mudou_ || salvando}
              onClick={() =>
                void executar(
                  () =>
                    productApi.update(p.id, {
                      name: nome.trim(),
                      description: descricao,
                      category: categoria,
                      metal,
                      seo_title: seoT.trim(),
                      seo_description: seoD.trim(),
                      images: fotos,
                    }),
                  "Produto salvo.",
                )
              }
              className="flex-[2] cursor-pointer rounded-full border-none bg-teal py-3 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Salvar produto
            </button>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}

const campo = "rounded-[14px] border-[1.5px] border-line bg-white px-3.5 py-3 text-[14px] outline-none focus:border-teal";

function Chip({ ativo, label, onClick, disabled }: { ativo: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-2 text-[12.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
        ativo ? "border-teal bg-teal text-white" : "border-line bg-white text-text hover:border-teal"
      }`}
    >
      {ativo && <Check size={13} strokeWidth={3} />}
      {label}
    </button>
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
