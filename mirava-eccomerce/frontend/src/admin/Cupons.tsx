// Cupons (decisão 31): % ou valor fixo sobre as peças, nunca sobre o frete;
// um por pedido, sem somar com os pontos do Club; o desconto nunca passa de
// 30% das peças. Quem confere tudo isso é o Go — aqui só se cria e liga/desliga.

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { formatarBRL } from "../lib/dinheiro";
import { growthApi, type AdminCoupon, type NewCoupon } from "./api";
import Toggle from "./Toggle";
import Select from "../components/Select";

const VAZIO = { code: "", kind: "percent" as "percent" | "fixed", value: "", min: "", maxUses: "", starts: "", ends: "", description: "" };

function valorCupom(c: AdminCoupon) {
  return c.kind === "percent" ? `${c.value}%` : formatarBRL(c.value);
}

function validade(c: AdminCoupon) {
  const f = (d: string) => new Date(d).toLocaleDateString("pt-BR");
  if (c.starts_at && c.ends_at) return `${f(c.starts_at)} a ${f(c.ends_at)}`;
  if (c.ends_at) return `até ${f(c.ends_at)}`;
  if (c.starts_at) return `a partir de ${f(c.starts_at)}`;
  return "sem prazo";
}

// "12,50" → 1250. Vazio vira 0.
function reaisParaCentavos(v: string) {
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export default function Cupons() {
  const [lista, setLista] = useState<AdminCoupon[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<typeof VAZIO | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    growthApi.coupons().then(setLista).catch((e: Error) => setErro(e.message));
  }, []);
  useEffect(carregar, [carregar]);

  async function alternar(c: AdminCoupon) {
    try {
      await growthApi.toggleCoupon(c.code, !c.active);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function criar(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    const value = form.kind === "percent" ? Number(form.value) : reaisParaCentavos(form.value);
    const min = form.min ? reaisParaCentavos(form.min) : 0;
    if (!Number.isFinite(value) || !Number.isFinite(min)) {
      setErro("Confira os valores digitados.");
      return;
    }
    const body: NewCoupon = {
      code: form.code.trim().toUpperCase(),
      kind: form.kind,
      value,
      min_subtotal_cents: min,
      max_uses: Number(form.maxUses) || 0,
      // Datas do formulário são dias inteiros no horário de Brasília.
      starts_at: form.starts ? new Date(`${form.starts}T00:00:00-03:00`).toISOString() : null,
      ends_at: form.ends ? new Date(`${form.ends}T23:59:59-03:00`).toISOString() : null,
      description: form.description.trim(),
    };
    setErro(null);
    setSalvando(true);
    try {
      await growthApi.createCoupon(body);
      setForm(null);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const input = "w-full rounded-[12px] border-[1.5px] border-line bg-white px-3 py-2.5 text-[14px] text-text outline-none focus:border-teal";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-[640px] text-[13.5px] leading-relaxed text-text-2">
          Um cupom por pedido, só sobre as peças (o frete fica de fora) e sem somar com os pontos do Mirava Club. O desconto
          nunca passa de 30% do valor das peças, mesmo num cupom de valor fixo.
        </p>
        {!form && (
          <button
            type="button"
            onClick={() => setForm(VAZIO)}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border-none bg-teal px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-teal-dark"
          >
            <Plus size={16} strokeWidth={2} /> Novo cupom
          </button>
        )}
      </div>

      {erro && <p className="m-0 rounded-[20px] bg-[#FDECEC] p-4 text-[13.5px] text-[#B4443C]">{erro}</p>}

      {form && (
        <form onSubmit={criar} className="grid gap-3.5 rounded-[20px] border border-line bg-white p-5 sm:grid-cols-4">
          <div className="flex items-center justify-between sm:col-span-4">
            <strong className="text-[15px] text-text">Novo cupom</strong>
            <button type="button" aria-label="Fechar" onClick={() => setForm(null)} className="cursor-pointer border-none bg-transparent text-muted hover:text-text">
              <X size={18} />
            </button>
          </div>
          <label className="grid gap-1 text-[12.5px] font-semibold text-text-2 sm:col-span-2">
            Código
            <input required maxLength={30} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, "") })} className={`${input} uppercase`} placeholder="VERAO15" />
          </label>
          <label className="grid gap-1 text-[12.5px] font-semibold text-text-2">
            Tipo
            <Select
              variant="field"
              value={form.kind}
              onChange={(v) => setForm({ ...form, kind: v as "percent" | "fixed", value: "" })}
              options={[{ value: "percent", label: "Porcentagem" }, { value: "fixed", label: "Valor fixo" }]}
            />
          </label>
          <label className="grid gap-1 text-[12.5px] font-semibold text-text-2">
            {form.kind === "percent" ? "Desconto (%), até 30" : "Desconto (R$)"}
            <input required inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className={input} placeholder={form.kind === "percent" ? "15" : "20,00"} />
          </label>
          <label className="grid gap-1 text-[12.5px] font-semibold text-text-2">
            Mínimo em peças (R$)
            <input inputMode="decimal" value={form.min} onChange={(e) => setForm({ ...form, min: e.target.value })} className={input} placeholder="opcional" />
          </label>
          <label className="grid gap-1 text-[12.5px] font-semibold text-text-2">
            Limite de usos
            <input inputMode="numeric" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value.replace(/\D/g, "") })} className={input} placeholder="sem limite" />
          </label>
          <label className="grid gap-1 text-[12.5px] font-semibold text-text-2">
            Começa em
            <input type="date" value={form.starts} onChange={(e) => setForm({ ...form, starts: e.target.value })} className={input} />
          </label>
          <label className="grid gap-1 text-[12.5px] font-semibold text-text-2">
            Termina em
            <input type="date" value={form.ends} onChange={(e) => setForm({ ...form, ends: e.target.value })} className={input} />
          </label>
          <label className="grid gap-1 text-[12.5px] font-semibold text-text-2 sm:col-span-4">
            Anotação (só você vê)
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={input} placeholder="Ex.: campanha do Instagram de novembro" />
          </label>
          <div className="sm:col-span-4">
            <button type="submit" disabled={salvando} className="cursor-pointer rounded-full border-none bg-teal px-6 py-3 text-[14px] font-semibold text-white hover:bg-teal-dark disabled:opacity-60">
              {salvando ? "Criando…" : "Criar cupom"}
            </button>
          </div>
        </form>
      )}

      <section className="overflow-x-auto rounded-[20px] border border-line bg-white">
        {!lista ? (
          <p className="m-0 px-5 py-10 text-center text-muted">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="m-0 px-5 py-10 text-center text-muted">Nenhum cupom criado ainda.</p>
        ) : (
          <table className="w-full min-w-[720px] border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left text-[11.5px] tracking-[0.08em] text-muted uppercase">
                <th className="px-5 py-3 font-semibold">Código</th>
                <th className="px-3 py-3 font-semibold">Desconto</th>
                <th className="px-3 py-3 font-semibold">Mínimo</th>
                <th className="px-3 py-3 font-semibold">Validade</th>
                <th className="px-3 py-3 font-semibold">Usos</th>
                <th className="px-3 py-3 font-semibold">Já descontado</th>
                <th className="px-5 py-3 text-right font-semibold">Ativo</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.code} className="border-t border-[#EEF3F2]">
                  <td className="px-5 py-3">
                    <strong className="font-mono text-text">{c.code}</strong>
                    {c.description && <span className="block text-[12px] text-muted">{c.description}</span>}
                  </td>
                  <td className="px-3 py-3 font-semibold text-teal">{valorCupom(c)}</td>
                  <td className="px-3 py-3 text-text-2">{c.min_subtotal_cents ? formatarBRL(c.min_subtotal_cents) : "—"}</td>
                  <td className="px-3 py-3 text-text-2">{validade(c)}</td>
                  <td className="px-3 py-3 text-text-2">
                    {c.uses}
                    {c.max_uses > 0 && ` / ${c.max_uses}`}
                  </td>
                  <td className="px-3 py-3 text-text-2">{formatarBRL(c.discounted_cents)}</td>
                  <td className="px-5 py-3 text-right">
                    <Toggle pequeno ligado={c.active} onClick={() => void alternar(c)} rotulo={`Cupom ${c.code} ativo`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
