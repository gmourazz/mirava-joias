// Partes do design v5 na tela de Sincronização: alertas de preço (disjuntor
// e lucro abaixo do mínimo), conexão (testar / sincronizar agora), regras
// editáveis, fila "novos na Lilly" e mapeamento de categorias.

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Plus, RefreshCw, Trash2, Wifi } from "lucide-react";
import { formatarBRL } from "../lib/dinheiro";
import { imageUrl } from "../catalogo/consultas";
import { rotuloCategoria } from "../catalogo/categorias";
import { lojaApi, productApi, type AdminCategory, type AdminProduct, type QueueItem, type StoreSettings } from "./api";
import Toggle from "./Toggle";
import Select from "../components/Select";

const card = "grid gap-3 rounded-[20px] border border-line bg-white p-[22px]";
const botao = "flex cursor-pointer items-center gap-1.5 rounded-full border-none bg-teal px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-teal-dark disabled:opacity-50";
const botaoClaro = "cursor-pointer rounded-full border-[1.5px] border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-teal hover:border-teal disabled:opacity-50";

export function AlertasPreco({ st }: { st: StoreSettings }) {
  const [disjuntor, setDisjuntor] = useState<AdminProduct[]>([]);
  const [margem, setMargem] = useState<AdminProduct[]>([]);
  const carregar = useCallback(() => {
    productApi.list(new URLSearchParams({ status: "alerta" })).then((p) => setDisjuntor(p.items)).catch(() => {});
    productApi.list(new URLSearchParams({ status: "margem", banho: "" })).then((p) => setMargem(p.items.filter((x) => x.published))).catch(() => {});
  }, []);
  useEffect(carregar, [carregar]);

  const lista = [
    ...disjuntor.map((p) => ({ p, tipo: "disjuntor" as const })),
    ...margem.filter((p) => !disjuntor.some((d) => d.id === p.id)).slice(0, 10).map((p) => ({ p, tipo: "margem" as const })),
  ];
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="grid">
          <strong className="flex items-center gap-2 text-[16px] text-text">
            <AlertTriangle size={17} className="text-[#B07A12]" /> Alertas de preço da Lilly
          </strong>
          <span className="text-[13px] text-muted">Avisa quando o atacado sobe demais ou o lucro fica abaixo do mínimo de {st.min_margin_pct}%.</span>
        </span>
      </div>
      {lista.length === 0 ? (
        <p className="m-0 flex items-center gap-2 rounded-2xl bg-mist px-4 py-3 text-[13.5px] text-teal-dark">
          <Check size={16} /> Todos os produtos estão acima do lucro mínimo.
        </p>
      ) : (
        lista.map(({ p, tipo }) => {
          const m = p.price_cents > 0 ? Math.round(((p.price_cents - p.cost_cents) / p.price_cents) * 100) : 0;
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 border-t border-[#EEF3F2] pt-3 text-[13.5px]">
              <span className="min-w-[200px] flex-1">
                <strong className="text-text">{p.name}</strong>
                <span className="block text-[12.5px] text-muted">
                  {tipo === "disjuntor" && p.suggested_price_cents !== null
                    ? `Preço iria de ${formatarBRL(p.price_cents)} para ${formatarBRL(p.suggested_price_cents)} (travado pelo disjuntor)`
                    : `Atacado ${formatarBRL(p.cost_cents)} → venda ${formatarBRL(p.price_cents)}`}
                </span>
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${m < st.min_margin_pct ? "bg-[#FFF4E0] text-[#9A6B12]" : "bg-mist text-teal"}`}>lucro {m}%</span>
              {tipo === "disjuntor" ? (
                <>
                  <button type="button" className={botao} onClick={() => void productApi.suggestion(p.id, true).then(carregar)}>Aceitar novo preço</button>
                  <button type="button" className={botaoClaro} onClick={() => void productApi.suggestion(p.id, false).then(carregar)}>Manter</button>
                </>
              ) : (
                <Link to={`/admin/produtos?abrir=${p.id}`} className={botaoClaro}>Ajustar markup</Link>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}

export function ConexaoERegras({ st, salvar }: { st: StoreSettings; salvar: (s: StoreSettings) => Promise<void> }) {
  const [form, setForm] = useState(st);
  const [teste, setTeste] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rodando, setRodando] = useState(false);
  useEffect(() => setForm(st), [st]);

  const set = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => setForm((f) => ({ ...f, [k]: v }));
  const exemplo = Math.round(3000 * (1 + form.default_markup_pct / 100));

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#E3F6F1] px-2.5 py-1 text-[11px] font-bold tracking-[0.1em] text-success">CONECTADO</span>
        <span className="text-[13px] text-muted">sem credencial de API: lê o sitemap e as páginas públicas da Lilly</span>
        <span className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            className={botaoClaro}
            onClick={() => {
              setTeste("Testando…");
              void lojaApi.testConnection().then((r) => setTeste(r.ok ? `Conexão ok · ${r.urls} páginas no sitemap` : `Falhou: ${r.error}`));
            }}
          >
            <span className="flex items-center gap-1.5"><Wifi size={14} /> Testar conexão</span>
          </button>
          <button
            type="button"
            disabled={rodando}
            className={botao}
            onClick={() => {
              setRodando(true);
              void lojaApi
                .syncNow()
                .then(() => setTeste("Sincronização iniciada. Acompanhe no histórico abaixo (leva um tempo: tem pausa entre as páginas)."))
                .catch((e: Error) => setTeste(e.message))
                .finally(() => setRodando(false));
            }}
          >
            <RefreshCw size={14} /> Sincronizar agora
          </button>
        </span>
      </div>
      {teste && <span className="text-[13px] text-text-2">{teste}</span>}

      <strong className="mt-2 text-[16px] text-text">Regras de sincronização</strong>
      <div className="grid gap-3 md:grid-cols-2">
        <Campo label="Frequência automática">
          <div className="flex flex-wrap gap-1.5">
            {([3, 6, 12, 24] as const).map((h) => (
              <button key={h} type="button" onClick={() => set("sync_every_hours", h)} className={`cursor-pointer rounded-full border-[1.5px] px-3.5 py-2 text-[13px] font-semibold ${form.sync_every_hours === h ? "border-teal bg-teal text-white" : "border-line bg-white text-text"}`}>
                {h === 24 ? "1x por dia" : `a cada ${h}h`}
              </button>
            ))}
          </div>
        </Campo>
        <Campo label={`Markup padrão sobre o custo · ex.: custo R$ 30,00 vira ${formatarBRL(exemplo)}`}>
          <span className="flex w-fit items-center rounded-full border-[1.5px] border-line pr-3">
            <input
              inputMode="numeric"
              value={form.default_markup_pct}
              onChange={(e) => set("default_markup_pct", Number(e.target.value.replace(/\D/g, "")) || 0)}
              className="w-20 rounded-full border-none px-3 py-2 text-[14px] outline-none"
            />
            %
          </span>
        </Campo>
        <Campo label="Quando esgotar no fornecedor">
          <div className="flex flex-wrap gap-1.5">
            {([["show", "Mostrar como indisponível"], ["hide", "Ocultar da loja"]] as const).map(([v, t]) => (
              <button key={v} type="button" onClick={() => set("out_of_stock_action", v)} className={`cursor-pointer rounded-full border-[1.5px] px-3.5 py-2 text-[13px] font-semibold ${form.out_of_stock_action === v ? "border-teal bg-teal text-white" : "border-line bg-white text-text"}`}>
                {t}
              </button>
            ))}
          </div>
        </Campo>
        <Campo label="Lucro mínimo (alerta)">
          <span className="flex w-fit items-center rounded-full border-[1.5px] border-line pr-3">
            <input
              inputMode="numeric"
              value={form.min_margin_pct}
              onChange={(e) => set("min_margin_pct", Number(e.target.value.replace(/\D/g, "")) || 0)}
              className="w-16 rounded-full border-none px-3 py-2 text-[14px] outline-none"
            />
            %
          </span>
        </Campo>
      </div>
      <div className="grid gap-2">
        {([
          ["auto_import", "Importar produtos novos sozinho", "Desligado, a peça nova fica na fila “Novos na Use Lilly” esperando você."],
          ["sync_images", "Sincronizar fotos", "Puxa as fotos da Lilly (peça com “manter minhas fotos” não muda)."],
          ["sync_descriptions", "Sincronizar nomes e descrições", "Texto que você editou no painel nunca é sobrescrito."],
          ["round_to_90", "Arredondar preços para ,90", "R$ 69,00 vira R$ 69,90 (sempre para cima)."],
        ] as const).map(([k, t, d]) => (
          <div key={k} className="flex items-center justify-between gap-3 rounded-2xl bg-fog px-4 py-3">
            <span className="grid">
              <strong className="text-[13.5px] text-text">{t}</strong>
              <span className="text-[12px] text-muted">{d}</span>
            </span>
            <Toggle ligado={form[k]} rotulo={t} onClick={() => set(k, !form[k])} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={botao}
          onClick={() => {
            setMsg(null);
            void salvar(form)
              .then(() => lojaApi.recalculate())
              .then((r) => setMsg(`Regras salvas · ${r.updated} preços recalculados.`))
              .catch((e: Error) => setMsg(e.message));
          }}
        >
          Salvar regras e recalcular preços
        </button>
        {msg && <span className="text-[13px] text-text-2">{msg}</span>}
      </div>
    </section>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <span className="text-[12.5px] font-semibold text-text-2">{label}</span>
      {children}
    </div>
  );
}

export function NovosNaLilly() {
  const [fila, setFila] = useState<QueueItem[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const carregar = useCallback(() => {
    lojaApi.queue().then(setFila).catch((e: Error) => setMsg(e.message));
  }, []);
  useEffect(carregar, [carregar]);

  async function acao(id: string, f: () => Promise<unknown>) {
    setOcupado(id);
    setMsg(null);
    try {
      await f();
      carregar();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section id="fila" className={card}>
      <div className="flex items-center justify-between gap-2">
        <strong className="flex items-center gap-2 text-[16px] text-text">
          Novos na Use Lilly <span className="rounded-full bg-teal px-2.5 py-0.5 text-[12px] text-white">{fila?.length ?? 0}</span>
        </strong>
        {fila && fila.length > 0 && (
          <button
            type="button"
            className={botaoClaro}
            onClick={() => void lojaApi.importAll().then((r) => setMsg(`Importando ${r.queued} peças em segundo plano. Atualize a página em alguns minutos.`))}
          >
            Importar todos →
          </button>
        )}
      </div>
      {msg && <span className="text-[13px] text-text-2">{msg}</span>}
      {!fila ? (
        <p className="m-0 text-muted">Carregando…</p>
      ) : fila.length === 0 ? (
        <p className="m-0 rounded-2xl bg-fog px-4 py-3 text-[13.5px] text-muted">Tudo em dia. Nenhum produto novo no fornecedor.</p>
      ) : (
        <div className="grid max-h-[420px] overflow-y-auto">
          {fila.map((q) => (
            <div key={q.id} className="flex flex-wrap items-center gap-3 border-t border-[#EEF3F2] py-2.5 text-[13.5px]">
              <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-mist-3">{q.image && <img src={imageUrl(q.image) ?? ""} alt="" className="h-full w-full object-cover" />}</span>
              <span className="min-w-[180px] flex-1">
                <strong className="text-text">{q.name}</strong>
                <span className="block text-[12px] text-muted">
                  {q.sku} · {rotuloCategoria(q.category)} · custo {formatarBRL(q.cost_cents)} → venda {formatarBRL(q.price_cents)}
                </span>
              </span>
              <button type="button" disabled={ocupado === q.id} className={botaoClaro} onClick={() => void acao(q.id, () => lojaApi.ignoreQueued(q.id))}>
                Ignorar
              </button>
              <button type="button" disabled={ocupado === q.id} className={botao} onClick={() => void acao(q.id, () => lojaApi.importQueued(q.id))}>
                {ocupado === q.id ? "Importando…" : "Importar"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function Mapeamento() {
  const [lista, setLista] = useState<{ keyword: string; category: string }[] | null>(null);
  const [cats, setCats] = useState<AdminCategory[]>([]);
  const [salvo, setSalvo] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    lojaApi.mappings().then(setLista).catch(() => setLista([]));
    lojaApi.categories().then(setCats).catch(() => {});
  }, []);
  if (!lista) return null;
  const mudar = (l: typeof lista) => {
    setLista(l);
    setSalvo(false);
  };

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="grid">
          <strong className="text-[16px] text-text">Mapeamento de categorias</strong>
          <span className="text-[13px] text-muted">Palavra no nome da peça na Lilly → categoria na Mirava. A primeira da lista que aparecer decide.</span>
        </span>
        <button
          type="button"
          disabled={salvo}
          className={botao}
          onClick={() => void lojaApi.setMappings(lista).then(() => { setSalvo(true); setMsg("Mapeamento salvo. Vale a partir da próxima sincronização."); }).catch((e: Error) => setMsg(e.message))}
        >
          {salvo ? "Salvo" : "Salvar mapeamento"}
        </button>
      </div>
      {msg && <span className="text-[13px] text-text-2">{msg}</span>}
      <div className="grid gap-1.5 md:grid-cols-2">
        {lista.map((m, i) => (
          <div key={i} className="flex items-center gap-2 rounded-2xl bg-fog px-3 py-2 text-[13.5px]">
            <span className="text-[12px] text-muted">Lilly:</span>
            <input
              value={m.keyword}
              onChange={(e) => mudar(lista.map((x, j) => (j === i ? { ...x, keyword: e.target.value.toLowerCase() } : x)))}
              className="w-28 rounded-lg border-none bg-white px-2 py-1 outline-none"
            />
            <span className="text-muted">→</span>
            <Select
              variant="field"
              ariaLabel="Categoria"
              className="flex-1"
              value={m.category}
              onChange={(v) => mudar(lista.map((x, j) => (j === i ? { ...x, category: v } : x)))}
              options={cats.map((c) => ({ value: c.slug, label: c.label }))}
            />
            <button type="button" aria-label="Tirar" onClick={() => mudar(lista.filter((_, j) => j !== i))} className="cursor-pointer border-none bg-transparent p-1 text-muted hover:text-[#B4443C]">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className={`${botaoClaro} w-fit`} onClick={() => mudar([...lista, { keyword: "", category: cats[0]?.slug ?? "outros" }])}>
        <span className="flex items-center gap-1.5"><Plus size={14} /> Nova palavra</span>
      </button>
    </section>
  );
}
