// Produtos do painel (v5): abas de categoria, filtros, busca por nome ou SKU,
// tabela com custo, preço, lucro, alerta do disjuntor e os botões de
// publicar e de destaque na home. O catálogo tem milhares de peças, então a
// paginação e os filtros rodam no servidor (GET /admin/produtos).
//
// Preço não se edita aqui: muda pelo markup (da peça, da categoria ou o
// padrão — decisão 21, calculado no Go) ou aceitando a sugestão do disjuntor.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, Pencil, Plus, Search, Tag } from "lucide-react";
import { formatarBRL } from "../lib/dinheiro";
import { imageUrl } from "../catalogo/consultas";
import { rotuloCategoria } from "../catalogo/categorias";
import { ApiError } from "../lib/api";
import Select from "../components/Select";
import { extraApi, lojaApi, productApi, type AdminCategory, type AdminProduct, type ProductPage } from "./api";
import ProdutoDrawer from "./ProdutoDrawer";
import Toggle from "./Toggle";
import PainelPreco from "./PainelPreco";
import CategoriasModal from "./CategoriasModal";
import NovoProduto from "./NovoProduto";

export default function Produtos() {
  const [params, setParams] = useSearchParams();
  const [pagina, setPagina] = useState<ProductPage | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState(params.get("busca") ?? "");
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [massa, setMassa] = useState<string | null>(null);
  const [markupMassa, setMarkupMassa] = useState("");
  const [cats, setCats] = useState<AdminCategory[]>([]);
  const [modal, setModal] = useState<"categorias" | "novo" | null>(null);

  const carregarCats = useCallback(() => {
    lojaApi.categories().then(setCats).catch(() => {});
  }, []);
  useEffect(carregarCats, [carregarCats]);

  const categoria = params.get("categoria") ?? "";
  const abrir = params.get("abrir");
  const numPagina = Number(params.get("pagina")) || 1;

  const setParam = (updates: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("pagina" in updates) && !("abrir" in updates)) next.delete("pagina");
    setParams(next, { replace: true });
  };

  // Só os filtros vão para a API — "abrir" é estado da tela.
  const filtros = new URLSearchParams(params);
  filtros.delete("abrir");
  const chave = filtros.toString();

  useEffect(() => setSelecao(new Set()), [chave]);

  const carregar = useCallback(() => {
    productApi
      .list(new URLSearchParams(chave))
      .then(setPagina)
      .catch((e: Error) => setErro(e.message));
  }, [chave]);
  useEffect(carregar, [carregar]);

  // Busca espera a dona parar de digitar.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("busca") ?? "") !== busca.trim()) setParam({ busca: busca.trim() });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const totalPaginas = pagina ? Math.max(1, Math.ceil(pagina.total / pagina.per_page)) : 1;

  async function emMassa(b: { published?: boolean; featured?: boolean; markup_pct?: number; inherit_markup?: boolean; promo_pct?: number; promo_days?: number }) {
    setMassa(null);
    setErro(null);
    try {
      const r = await extraApi.bulkProducts({ ids: [...selecao], ...b });
      setMassa(`${r.updated} ${r.updated === 1 ? "peça atualizada" : "peças atualizadas"}${r.failed ? ` · ${r.failed} não puderam ser alteradas` : ""}.`);
      setSelecao(new Set());
      setMarkupMassa("");
      carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui aplicar a mudança.");
    }
  }

  // "+10% lucro / −10% lucro" (v5): soma 10 pontos ao markup que vale hoje
  // em cada peça selecionada. Cada uma passa pela mesma regra do editor.
  async function ajustarLucro(delta: number) {
    setMassa(null);
    setErro(null);
    const pecas = (pagina?.items ?? []).filter((p) => selecao.has(p.id));
    let ok = 0;
    for (const p of pecas) {
      const novo = Math.min(500, Math.max(20, Math.round(p.effective_markup_pct) + delta));
      try {
        await productApi.markup(p.id, novo);
        ok++;
      } catch {
        // segue para a próxima; o total mostra quantas foram
      }
    }
    setMassa(`Markup ajustado em ${ok} de ${pecas.length} peças.`);
    setSelecao(new Set());
    carregar();
  }

  return (
    <>
      <PainelPreco cats={cats} mudou={() => { carregarCats(); carregar(); }} />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => setModal("categorias")} className={botaoClaro}>
          <Tag size={15} /> Categorias
        </button>
        <Link to="/admin/sincronizacao#fila" className={botaoClaro}>
          <Download size={15} /> Importar da Lilly
        </Link>
        <button type="button" onClick={() => setModal("novo")} className="flex cursor-pointer items-center gap-1.5 rounded-full border-none bg-teal px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-teal-dark">
          <Plus size={15} /> Novo produto
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-line pb-0 [scrollbar-width:none]">
        {[{ key: "", label: "Todas", n: 0 }, ...cats.map((c) => ({ key: c.slug, label: c.label, n: c.count }))].map((c) => {
          const ativa = categoria === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setParam({ categoria: c.key })}
              className={`shrink-0 cursor-pointer border-0 border-b-[2.5px] bg-transparent px-3 py-2.5 text-[14px] font-semibold ${
                ativa ? "border-teal text-teal" : "border-transparent text-muted hover:text-text"
              }`}
            >
              {c.label}
              {c.n > 0 && <span className="ml-1.5 text-[12px] font-normal text-muted">{c.n}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-full border-[1.5px] border-line bg-white px-4 py-2.5">
          <Search size={16} strokeWidth={1.8} className="text-teal" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou SKU da Lilly…"
            className="min-w-0 flex-1 border-none bg-transparent text-[14px] outline-none"
          />
        </label>
        <Select
          value={params.get("status") ?? ""}
          active={Boolean(params.get("status"))}
          onChange={(v) => setParam({ status: v })}
          options={[
            { value: "", label: "Status: todos" },
            { value: "publicados", label: "Publicadas" },
            { value: "despublicados", label: "Despublicadas" },
            { value: "alerta", label: "Com alerta de preço" },
            { value: "destaque", label: "Na home (destaque)" },
            { value: "margem", label: "Lucro abaixo do mínimo" },
          ]}
        />
        <Select
          value={params.get("preco") ?? ""}
          active={Boolean(params.get("preco"))}
          onChange={(v) => setParam({ preco: v })}
          options={[
            { value: "", label: "Preço: todos" },
            { value: "ate60", label: "Até R$ 60" },
            { value: "60a100", label: "R$ 60–100" },
            { value: "acima100", label: "+ R$ 100" },
          ]}
        />
        <Select
          value={params.get("vitrine") ?? ""}
          active={Boolean(params.get("vitrine"))}
          onChange={(v) => setParam({ vitrine: v })}
          options={[
            { value: "", label: "Vitrine: todas" },
            { value: "capa", label: "Na capa" },
            { value: "home", label: "Na home" },
            { value: "fora", label: "Fora da vitrine" },
          ]}
        />
        <Select
          value={params.get("vendas") ?? ""}
          active={Boolean(params.get("vendas"))}
          onChange={(v) => setParam({ vendas: v })}
          options={[
            { value: "", label: "Vendas: todas" },
            { value: "promocao", label: "Em promoção" },
            { value: "parados", label: "Paradas 30d+" },
          ]}
        />
        <Select
          value={params.get("banho") ?? ""}
          active={Boolean(params.get("banho"))}
          onChange={(v) => setParam({ banho: v })}
          options={[
            { value: "", label: "Banho: todos" },
            { value: "prata", label: "Prata" },
            { value: "ouro", label: "Ouro" },
          ]}
        />
      </div>

      {erro && <p className="m-0 rounded-[20px] bg-[#FDECEC] p-4 text-[#B4443C]">{erro}</p>}

      {selecao.size > 0 && (
        <div className="sticky top-[76px] z-10 flex flex-wrap items-center gap-2 rounded-2xl bg-teal-dark px-4 py-3 text-[13.5px] text-white">
          <strong className="mr-2">
            {selecao.size} {selecao.size === 1 ? "selecionada" : "selecionadas"}
          </strong>
          <button type="button" onClick={() => void ajustarLucro(10)} className="cursor-pointer rounded-full border-none bg-white/12 px-3.5 py-2 font-semibold text-white hover:bg-white/20">
            +10% lucro
          </button>
          <button type="button" onClick={() => void ajustarLucro(-10)} className="cursor-pointer rounded-full border-none bg-white/12 px-3.5 py-2 font-semibold text-white hover:bg-white/20">
            −10% lucro
          </button>
          {[
            { t: "Ativar", b: { published: true } },
            { t: "Desativar", b: { published: false } },
            { t: "Colocar na home", b: { featured: true } },
            { t: "Tirar da home", b: { featured: false } },
            { t: "Promoção 15% por 7 dias", b: { promo_pct: 15, promo_days: 7 } },
            { t: "Aplicar markup padrão", b: { inherit_markup: true } },
          ].map((a) => (
            <button key={a.t} type="button" onClick={() => void emMassa(a.b)} className="cursor-pointer rounded-full border-none bg-white/12 px-3.5 py-2 font-semibold text-white hover:bg-white/20">
              {a.t}
            </button>
          ))}
          <span className="flex items-center gap-1 rounded-full bg-white/12 py-1 pr-1 pl-3">
            markup
            <input
              value={markupMassa}
              onChange={(e) => setMarkupMassa(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="200"
              className="w-12 rounded-full border-none bg-white px-2 py-1 text-[13px] text-text outline-none"
            />
            %
            <button
              type="button"
              disabled={!markupMassa}
              onClick={() => void emMassa({ markup_pct: Number(markupMassa) })}
              className="cursor-pointer rounded-full border-none bg-teal px-3 py-1 font-semibold text-white disabled:opacity-40"
            >
              Aplicar
            </button>
          </span>
          <button type="button" aria-label="Limpar seleção" onClick={() => setSelecao(new Set())} className="ml-auto cursor-pointer border-none bg-transparent p-1 text-white">
            ✕
          </button>
        </div>
      )}
      {massa && <p className="m-0 rounded-2xl bg-[#E3F6F1] px-4 py-3 text-[13.5px] text-success">{massa}</p>}

      <section className="overflow-x-auto rounded-[20px] border border-line bg-white">
        <div className="min-w-[1080px]">
          <div className="grid grid-cols-[28px_minmax(210px,2fr)_80px_76px_86px_96px_140px_120px_80px_60px_36px] gap-3 border-b border-line px-5 py-3 text-[11.5px] font-bold tracking-[0.06em] text-muted uppercase">
            <input
              type="checkbox"
              aria-label="Selecionar todas desta página"
              checked={Boolean(pagina && pagina.items.length > 0 && pagina.items.every((p) => selecao.has(p.id)))}
              onChange={(e) => setSelecao(e.target.checked && pagina ? new Set(pagina.items.map((p) => p.id)) : new Set())}
              className="h-[18px] w-[18px] cursor-pointer accent-teal"
            />
            <span>Produto</span>
            <span>SKU Lilly</span>
            <span>Banho</span>
            <span>Atacado</span>
            <span>Preço loja</span>
            <span>Lucro</span>
            <span>Preço da Lilly</span>
            <span>Publicada</span>
            <span>Home</span>
            <span />
          </div>
          {!pagina ? (
            <p className="m-0 px-5 py-10 text-center text-muted">Carregando…</p>
          ) : pagina.items.length === 0 ? (
            <p className="m-0 px-5 py-10 text-center text-muted">Nenhuma peça encontrada com esses filtros.</p>
          ) : (
            pagina.items.map((p) => (
              <Linha
                key={p.id}
                p={p}
                abrir={() => setParam({ abrir: p.id })}
                mudou={carregar}
                marcada={selecao.has(p.id)}
                marcar={(v) =>
                  setSelecao((prev) => {
                    const next = new Set(prev);
                    if (v) next.add(p.id);
                    else next.delete(p.id);
                    return next;
                  })
                }
              />
            ))
          )}
        </div>
      </section>

      {pagina && pagina.total > 0 && (
        <div className="flex items-center justify-between gap-3 text-[13.5px] text-muted">
          <span>
            {pagina.total} {pagina.total === 1 ? "peça" : "peças"} · página {numPagina} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={numPagina <= 1}
              onClick={() => setParam({ pagina: String(numPagina - 1) })}
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border-[1.5px] border-line bg-white text-teal disabled:opacity-40"
              aria-label="Página anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={numPagina >= totalPaginas}
              onClick={() => setParam({ pagina: String(numPagina + 1) })}
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border-[1.5px] border-line bg-white text-teal disabled:opacity-40"
              aria-label="Próxima página"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {abrir && <ProdutoDrawer id={abrir} fechar={() => setParam({ abrir: "" })} mudou={carregar} />}
      {modal === "categorias" && <CategoriasModal fechar={() => setModal(null)} mudou={() => { carregarCats(); carregar(); }} />}
      {modal === "novo" && (
        <NovoProduto
          cats={cats}
          fechar={() => setModal(null)}
          criado={(id) => {
            setModal(null);
            carregar();
            setParam({ abrir: id });
          }}
        />
      )}
    </>
  );
}

const botaoClaro =
  "flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-line bg-white px-4 py-2.5 text-[13.5px] font-semibold text-teal hover:border-teal hover:text-teal";

function Linha({ p, abrir, mudou, marcada, marcar }: { p: AdminProduct; abrir: () => void; mudou: () => void; marcada: boolean; marcar: (v: boolean) => void }) {
  const [salvando, setSalvando] = useState(false);
  const [falhou, setFalhou] = useState<string | null>(null);
  const foto = imageUrl(p.image ?? undefined);
  const lucro = p.price_cents - p.cost_cents;
  const margem = p.price_cents > 0 ? Math.round((lucro / p.price_cents) * 100) : 0;

  async function alternar(campo: "published" | "featured") {
    setSalvando(true);
    setFalhou(null);
    try {
      await productApi.update(p.id, { [campo]: !p[campo] });
      mudou();
    } catch (e) {
      setFalhou(e instanceof ApiError ? e.message : "Não consegui salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className={`grid grid-cols-[28px_minmax(210px,2fr)_80px_76px_86px_96px_140px_120px_80px_60px_36px] items-center gap-3 border-b border-[#EEF3F2] px-5 py-3 last:border-b-0 hover:bg-[#F7FAFA] ${marcada ? "bg-[#F1F8F7]" : ""}`}>
      <input type="checkbox" aria-label={`Selecionar ${p.name}`} checked={marcada} onChange={(e) => marcar(e.target.checked)} className="h-[18px] w-[18px] cursor-pointer accent-teal" />
      <button type="button" onClick={abrir} className="flex min-w-0 cursor-pointer items-center gap-3 border-none bg-transparent p-0 text-left">
        <span className="h-[46px] w-[46px] shrink-0 overflow-hidden rounded-xl bg-mist-3">{foto && <img src={foto} alt="" loading="lazy" className="h-full w-full object-cover" />}</span>
        <span className="grid min-w-0">
          <span className="truncate font-medium text-text">{p.name}</span>
          <span className="text-[12px] text-muted">
            {rotuloCategoria(p.category)} · {p.units_sold} vendidas
            {p.last_sale_days !== null && p.last_sale_days >= 30 && ` · parado ${p.last_sale_days}d`}
          </span>
          <span className="flex flex-wrap gap-1">
            {p.promo_pct > 0 && <Selo cor="teal">−{p.promo_pct}%</Selo>}
            {!p.available && <Selo cor="alerta">esgotada na Lilly</Selo>}
            {p.showcase.length > 0 && <Selo>home</Selo>}
            {p.manual && <Selo>manual</Selo>}
          </span>
          {falhou && <span className="text-[12px] text-[#B4443C]">{falhou}</span>}
        </span>
      </button>
      <span className="font-mono text-[12.5px]">{p.sku ?? "—"}</span>
      <span className="flex items-center gap-1.5 text-[13px]">
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: p.metal === "ouro" ? "linear-gradient(135deg,#F6E3AE,#C9A253)" : "linear-gradient(135deg,#F1F3F4,#AEB5B9)" }}
        />
        {p.metal === "ouro" ? "Ouro" : "Prata"}
      </span>
      <span>{formatarBRL(p.cost_cents)}</span>
      <span className="font-semibold">{formatarBRL(p.price_cents)}</span>
      <span className="grid">
        <span className="font-semibold text-success">{formatarBRL(lucro)}</span>
        <span className="text-[12px] text-muted">
          {margem}% · markup {Math.round(p.effective_markup_pct)}%{p.markup_pct === null ? "" : " (da peça)"}
        </span>
      </span>
      <span>
        {p.suggested_price_cents !== null ? (
          <button type="button" onClick={abrir} className="cursor-pointer rounded-full border-none bg-[#FFF4E0] px-2.5 py-1 text-[11.5px] font-semibold text-[#9A6B12]">
            Preço mudou · revisar
          </button>
        ) : p.supplier_retail_cents ? (
          <span className="text-[12.5px] text-muted">varejo {formatarBRL(p.supplier_retail_cents)}</span>
        ) : (
          <span className="text-[12.5px] text-faint">—</span>
        )}
      </span>
      <Toggle ligado={p.published} disabled={salvando} onClick={() => void alternar("published")} rotulo="Publicada" />
      <Toggle ligado={p.featured} disabled={salvando} onClick={() => void alternar("featured")} rotulo="Na home" pequeno />
      <span className="flex gap-1">
        <button type="button" onClick={abrir} aria-label="Editar" className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border-none bg-fog text-teal">
          <Pencil size={15} strokeWidth={1.8} />
        </button>
      </span>
    </div>
  );
}

function Selo({ children, cor }: { children: React.ReactNode; cor?: "teal" | "alerta" }) {
  const c = cor === "teal" ? "bg-teal text-white" : cor === "alerta" ? "bg-[#FFF4E0] text-[#9A6B12]" : "bg-mist text-teal";
  return <span className={`rounded-full px-2 py-px text-[10.5px] font-bold ${c}`}>{children}</span>;
}
