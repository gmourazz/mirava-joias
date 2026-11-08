// "Como o seu preço é calculado" + "Lucro por categoria" (design v5, decisão
// 21). A conta mostrada aqui é só a prévia do simulador; o preço gravado é
// sempre calculado no Go (dominio.PriceFromMarkupRounded), e o botão de
// recalcular aplica a mesma regra no catálogo inteiro.

import { useEffect, useState } from "react";
import { formatarBRL } from "../lib/dinheiro";
import { lojaApi, type AdminCategory, type StoreSettings } from "./api";

function prever(custo: number, markup: number, round90: boolean) {
  const p = Math.round(custo * (1 + markup / 100));
  if (!round90 || p <= 0) return p;
  return (Math.floor(p / 100) + (p % 100 > 90 ? 1 : 0)) * 100 + 90;
}

export default function PainelPreco({ cats, mudou }: { cats: AdminCategory[]; mudou: () => void }) {
  const [st, setSt] = useState<StoreSettings | null>(null);
  const [custo, setCusto] = useState("30");
  const [mk, setMk] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    lojaApi.settings().then(setSt).catch(() => {});
  }, []);
  useEffect(() => {
    setMk(Object.fromEntries(cats.map((c) => [c.slug, c.markup_pct === null ? "" : String(Math.round(c.markup_pct))])));
  }, [cats]);

  if (!st) return null;
  const custoC = Math.round(Number(custo.replace(",", ".")) * 100) || 0;
  const preco = prever(custoC, st.default_markup_pct, st.round_to_90);
  const lucro = preco - custoC;
  const mudadas = cats.filter((c) => (mk[c.slug] ?? "") !== (c.markup_pct === null ? "" : String(Math.round(c.markup_pct))));

  async function salvar() {
    setMsg(null);
    setSalvando(true);
    try {
      for (const c of mudadas) {
        const v = mk[c.slug];
        await lojaApi.updateCategory(c.slug, c.label, c.position, v === "" ? null : Number(v));
      }
      const r = await lojaApi.recalculate();
      setMsg(`Salvo. ${r.updated} ${r.updated === 1 ? "preço recalculado" : "preços recalculados"}.`);
      mudou();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="grid content-start gap-4 rounded-[20px] bg-teal-dark p-[22px] text-white">
        <strong className="text-[15px]">Como o seu preço é calculado</strong>
        <div className="flex flex-wrap items-center gap-2.5 text-[14px]">
          <Bloco titulo="Atacado Lilly" valor={formatarBRL(custoC)} />
          <span className="text-[20px] text-teal-pale">+</span>
          <Bloco titulo="Seu lucro" valor={`${Math.round(st.default_markup_pct)}%`} />
          <span className="text-[20px] text-teal-pale">=</span>
          <Bloco titulo="Preço na loja" valor={formatarBRL(preco)} destaque />
        </div>
        <label className="flex flex-wrap items-center gap-2 text-[13px] text-teal-pale">
          Simular atacado R$
          <input
            value={custo}
            onChange={(e) => setCusto(e.target.value.replace(/[^\d,.]/g, ""))}
            inputMode="decimal"
            className="w-20 rounded-full border-none bg-white px-3 py-1.5 text-[14px] text-text outline-none"
          />
        </label>
        <p className="m-0 text-[13.5px] leading-relaxed text-[#BFE3DF]">
          Você lucra <strong className="text-white">{formatarBRL(lucro)}</strong> por peça, {preco > 0 ? Math.round((lucro / preco) * 100) : 0}% do preço de venda
          fica com você (antes da taxa do Mercado Pago e da embalagem).
          {st.round_to_90 && " Preços arredondados para ,90."} O markup padrão e o arredondamento ficam em Sincronização → Regras.
        </p>
      </div>

      <div className="grid content-start gap-3 rounded-[20px] border border-line bg-white p-[22px]">
        <div className="flex items-baseline justify-between gap-2">
          <strong className="text-[15px] text-text">Lucro por categoria</strong>
          <span className="text-[12px] text-muted">vazio = usa o padrão {Math.round(st.default_markup_pct)}%</span>
        </div>
        <div className="grid gap-1.5">
          {cats.map((c) => (
            <div key={c.slug} className="flex items-center gap-2 text-[13.5px]">
              <span className="flex-1 text-text">
                {c.label} <span className="text-[12px] text-muted">· {c.count}</span>
              </span>
              <span className="flex items-center rounded-full border-[1.5px] border-line pr-3">
                <input
                  value={mk[c.slug] ?? ""}
                  onChange={(e) => setMk((m) => ({ ...m, [c.slug]: e.target.value.replace(/\D/g, "") }))}
                  placeholder={String(Math.round(st.default_markup_pct))}
                  inputMode="numeric"
                  className="w-14 rounded-full border-none bg-transparent px-3 py-1.5 text-right text-[13.5px] outline-none"
                />
                <span className="text-muted">%</span>
              </span>
              {mk[c.slug] && (
                <button type="button" onClick={() => setMk((m) => ({ ...m, [c.slug]: "" }))} className="cursor-pointer border-none bg-transparent text-[12px] text-muted hover:text-teal">
                  limpar
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={mudadas.length === 0 || salvando}
          onClick={() => void salvar()}
          className="cursor-pointer rounded-full border-none bg-teal px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-teal-dark disabled:cursor-default disabled:opacity-40"
        >
          {salvando ? "Salvando…" : "Salvar e recalcular preços"}
        </button>
        {msg && <span className="text-[12.5px] text-text-2">{msg}</span>}
        <span className="text-[12px] text-muted">Peça com markup próprio (no editor) não muda. Entre 20% e 500%.</span>
      </div>
    </section>
  );
}

function Bloco({ titulo, valor, destaque = false }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <span className={`grid rounded-xl px-3.5 py-2 ${destaque ? "bg-teal" : "bg-white/8"}`}>
      <strong className="text-[13.5px]">{titulo}</strong>
      <span className="text-[12px] text-teal-pale">{valor}</span>
    </span>
  );
}
