// Marketing (design v5): sacolas abandonadas, avaliações, promoções
// programadas, kits "compre junto", avise-me, calendário de datas e os
// cadastros de novidades. Regras de dinheiro (teto de 30%, promoção e kit não
// somam) moram no Go — aqui só se agenda e se acompanha (decisão 32).

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bell, CalendarDays, Clock, Gift, Mail, Megaphone, ShoppingCart, Star, Trash2, Users, X } from "lucide-react";
import { formatarBRL } from "../lib/dinheiro";
import Avaliacoes from "./Avaliacoes";
import BuscaProduto from "./BuscaProduto";
import Toggle from "./Toggle";
import { baixarCSV } from "./csv";
import { lojaApi, type AdminCart, type AdminCategory, type AdminKit, type AdminProduct, type Promotion } from "./api";

const ABAS = [
  { key: "carrinhos", label: "Carrinhos abandonados", Icon: ShoppingCart },
  { key: "avaliacoes", label: "Avaliações", Icon: Star },
  { key: "promocoes", label: "Promoções programadas", Icon: Clock },
  { key: "kits", label: "Kits e combos", Icon: Gift },
  { key: "aviseme", label: "Avise-me", Icon: Bell },
  { key: "calendario", label: "Calendário", Icon: CalendarDays },
  { key: "novidades", label: "Cadastros de novidades", Icon: Users },
] as const;
type Aba = (typeof ABAS)[number]["key"];

const card = "grid gap-3 rounded-[20px] border border-line bg-white p-[22px]";
const botao = "cursor-pointer rounded-full border-none bg-teal px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-teal-dark disabled:opacity-50";
const botaoClaro = "cursor-pointer rounded-full border-[1.5px] border-line bg-white px-3.5 py-2 text-[12.5px] font-semibold text-teal hover:border-teal disabled:opacity-50";
const campo = "rounded-[12px] border-[1.5px] border-line bg-white px-3 py-2.5 text-[14px] outline-none focus:border-teal";

export default function Marketing() {
  const [params, setParams] = useSearchParams();
  const aba = (ABAS.some((a) => a.key === params.get("aba")) ? params.get("aba") : "carrinhos") as Aba;
  // Calendário → "Criar promoção" já abre o formulário preenchido.
  const [rascunho, setRascunho] = useState<Partial<Promotion> | null>(null);

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {ABAS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setParams({ aba: key })}
            className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-4 py-2 text-[13px] font-semibold ${
              aba === key ? "border-teal bg-teal text-white" : "border-line bg-white text-text hover:border-teal"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {aba === "carrinhos" && <Carrinhos />}
      {aba === "avaliacoes" && <Avaliacoes parte="avaliacoes" />}
      {aba === "promocoes" && <Promocoes rascunho={rascunho} limpar={() => setRascunho(null)} />}
      {aba === "kits" && <Kits />}
      {aba === "aviseme" && <Avaliacoes parte="aviseme" />}
      {aba === "calendario" && (
        <Calendario
          criar={(p) => {
            setRascunho(p);
            setParams({ aba: "promocoes" });
          }}
        />
      )}
      {aba === "novidades" && <Novidades />}
    </>
  );
}

// ─── Carrinhos abandonados ──────────────────────────────────────────────────

function Carrinhos() {
  const [lista, setLista] = useState<AdminCart[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const carregar = useCallback(() => {
    lojaApi.carts().then(setLista).catch((e: Error) => setMsg(e.message));
  }, []);
  useEffect(carregar, [carregar]);

  const recuperados = (lista ?? []).filter((c) => c.recovered);
  const avisados = (lista ?? []).filter((c) => c.notified_at);
  const taxa = avisados.length > 0 ? Math.round((avisados.filter((c) => c.recovered).length / avisados.length) * 100) : 0;

  return (
    <>
      <section className="grid gap-3 md:grid-cols-3">
        <Num label="Sacolas paradas (30 dias)" valor={String((lista ?? []).filter((c) => !c.recovered).length)} />
        <Num label="Recuperadas" valor={`${recuperados.length} · ${formatarBRL(recuperados.reduce((s, c) => s + c.total_cents, 0))}`} />
        <Num label="Taxa de recuperação" valor={`${taxa}%`} nota="das que receberam lembrete" />
      </section>
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className="text-[16px] text-text">Sacolas de clientes logadas</strong>
          <Link to="/admin/automacoes" className="flex items-center gap-1.5 text-[13px] font-semibold text-teal">
            <Megaphone size={14} /> Recuperação automática em Automações →
          </Link>
        </div>
        {msg && <span className="text-[13px] text-text-2">{msg}</span>}
        {!lista ? (
          <p className="m-0 text-muted">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="m-0 rounded-2xl bg-fog px-4 py-3 text-[13.5px] text-muted">Nenhuma sacola salva nos últimos 30 dias.</p>
        ) : (
          lista.map((c) => (
            <div key={c.user_id} className="flex flex-wrap items-center gap-3 border-t border-[#EEF3F2] pt-3 text-[13.5px]">
              <span className="min-w-[200px] flex-1">
                <strong className="text-text">{c.name || c.email}</strong>
                <span className="block text-[12.5px] text-muted">
                  {c.email} · {c.items} {c.items === 1 ? "peça" : "peças"} · {new Date(c.updated_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
              </span>
              <strong className="text-text">{formatarBRL(c.total_cents)}</strong>
              {c.recovered ? (
                <span className="rounded-full bg-[#E3F6F1] px-2.5 py-1 text-[12px] font-bold text-success">Comprou</span>
              ) : c.notified_at ? (
                <span className="rounded-full bg-mist px-2.5 py-1 text-[12px] font-semibold text-teal">Lembrete enviado</span>
              ) : (
                <button
                  type="button"
                  className={botaoClaro}
                  onClick={() => void lojaApi.remindCart(c.user_id).then(() => { setMsg(`Lembrete enviado para ${c.email}.`); carregar(); }).catch((e: Error) => setMsg(e.message))}
                >
                  <span className="flex items-center gap-1.5"><Mail size={13} /> E-mail</span>
                </button>
              )}
            </div>
          ))
        )}
      </section>
    </>
  );
}

function Num({ label, valor, nota }: { label: string; valor: string; nota?: string }) {
  return (
    <div className="grid gap-1 rounded-[20px] border border-line bg-white p-[18px]">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="font-serif text-[24px] leading-none text-teal-dark">{valor}</span>
      {nota && <span className="text-[12px] text-muted">{nota}</span>}
    </div>
  );
}

// ─── Promoções programadas ──────────────────────────────────────────────────

function estadoPromo(p: Promotion) {
  const agora = Date.now();
  const a = new Date(p.starts_at).getTime(), b = new Date(p.ends_at).getTime();
  if (agora < a) return { t: "Agendada", c: "bg-mist text-teal" };
  if (agora < b) return { t: "No ar", c: "bg-teal text-white" };
  return { t: "Encerrada", c: "bg-fog text-muted" };
}

function Promocoes({ rascunho, limpar }: { rascunho: Partial<Promotion> | null; limpar: () => void }) {
  const [lista, setLista] = useState<Promotion[] | null>(null);
  const [cats, setCats] = useState<AdminCategory[]>([]);
  const [nome, setNome] = useState("");
  const [pct, setPct] = useState("20");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [escopo, setEscopo] = useState<Promotion["scope"]>("all");
  const [categoria, setCategoria] = useState("");
  const [pecas, setPecas] = useState<AdminProduct[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(() => {
    lojaApi.promotions().then(setLista).catch((e: Error) => setMsg(e.message));
  }, []);
  useEffect(carregar, [carregar]);
  useEffect(() => {
    lojaApi.categories().then((c) => { setCats(c); setCategoria((x) => x || c[0]?.slug || ""); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!rascunho) return;
    setNome(rascunho.name ?? "");
    setPct(String(rascunho.pct ?? 20));
    setInicio(rascunho.starts_at?.slice(0, 16) ?? "");
    setFim(rascunho.ends_at?.slice(0, 16) ?? "");
    setEscopo("all");
    limpar();
  }, [rascunho, limpar]);

  async function agendar(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await lojaApi.createPromotion({
        name: nome.trim(),
        pct: Number(pct),
        scope: escopo,
        category: escopo === "category" ? categoria : null,
        product_ids: escopo === "products" ? pecas.map((p) => p.id) : [],
        // Horário do formulário é o de Brasília.
        starts_at: new Date(`${inicio}:00-03:00`).toISOString(),
        ends_at: new Date(`${fim}:00-03:00`).toISOString(),
      });
      setNome("");
      setPecas([]);
      setMsg("Promoção agendada.");
      carregar();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  const escopoTexto = (p: Promotion) =>
    p.scope === "all" ? "Todo o site" : p.scope === "category" ? cats.find((c) => c.slug === p.category)?.label ?? p.category : `${p.product_ids.length} peças escolhidas`;

  return (
    <>
      <form onSubmit={agendar} className={card}>
        <strong className="text-[16px] text-text">Agendar promoção</strong>
        <p className="m-0 text-[13px] text-muted">
          A peça aparece com o preço cheio riscado. Promoções sobrepostas não somam (vale a maior), e a soma de promoção, kit, cupom, pontos e Pix nunca passa de 30% do preço cheio.
        </p>
        <div className="grid gap-3 md:grid-cols-[2fr_90px_1fr_1fr]">
          <input required minLength={2} maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome (ex.: Black Friday Mirava)" className={campo} />
          <span className="flex items-center rounded-[12px] border-[1.5px] border-line pr-3">
            <input required inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value.replace(/\D/g, ""))} className="w-full rounded-[12px] border-none px-3 py-2.5 text-[14px] outline-none" />%
          </span>
          <input required type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} aria-label="Início" />
          <input required type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} className={campo} aria-label="Fim" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([["all", "Todo o site"], ["category", "Uma categoria"], ["products", "Peças escolhidas"]] as const).map(([k, t]) => (
            <button key={k} type="button" onClick={() => setEscopo(k)} className={`cursor-pointer rounded-full border-[1.5px] px-3.5 py-2 text-[13px] font-semibold ${escopo === k ? "border-teal bg-teal text-white" : "border-line bg-white text-text"}`}>
              {t}
            </button>
          ))}
          {escopo === "category" && (
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={campo}>
              {cats.map((c) => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
            </select>
          )}
        </div>
        {escopo === "products" && (
          <div className="grid gap-2">
            <BuscaProduto onPick={(p) => setPecas((l) => [...l, p])} excluir={pecas.map((p) => p.id)} />
            <div className="flex flex-wrap gap-1.5">
              {pecas.map((p) => (
                <span key={p.id} className="flex items-center gap-1 rounded-full bg-mist px-3 py-1 text-[12.5px] text-teal-dark">
                  {p.name}
                  <button type="button" aria-label="Tirar" onClick={() => setPecas((l) => l.filter((x) => x.id !== p.id))} className="cursor-pointer border-none bg-transparent p-0 text-muted">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button type="submit" className={botao}>Agendar promoção</button>
          {msg && <span className="text-[13px] text-text-2">{msg}</span>}
        </div>
      </form>

      <section className={card}>
        <strong className="text-[16px] text-text">Promoções</strong>
        {!lista ? (
          <p className="m-0 text-muted">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="m-0 rounded-2xl bg-fog px-4 py-3 text-[13.5px] text-muted">Nenhuma promoção agendada.</p>
        ) : (
          lista.map((p) => {
            const e = estadoPromo(p);
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 border-t border-[#EEF3F2] pt-3 text-[13.5px]">
                <span className="font-serif text-[22px] text-teal">−{p.pct}%</span>
                <span className="min-w-[200px] flex-1">
                  <strong className="text-text">{p.name}</strong>
                  <span className="block text-[12.5px] text-muted">
                    {escopoTexto(p)} · {p.products} peças no ar · {new Date(p.starts_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} a{" "}
                    {new Date(p.ends_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
                <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${e.c}`}>{e.t}</span>
                <button
                  type="button"
                  aria-label="Excluir"
                  onClick={() => window.confirm(`Excluir a promoção "${p.name}"?`) && void lojaApi.deletePromotion(p.id!).then(carregar)}
                  className="cursor-pointer border-none bg-transparent p-1 text-muted hover:text-[#B4443C]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}

// ─── Kits ───────────────────────────────────────────────────────────────────

function Kits() {
  const [lista, setLista] = useState<AdminKit[] | null>(null);
  const [a, setA] = useState<AdminProduct | null>(null);
  const [b, setB] = useState<AdminProduct | null>(null);
  const [pct, setPct] = useState("10");
  const [msg, setMsg] = useState<string | null>(null);
  const carregar = useCallback(() => {
    lojaApi.kits().then(setLista).catch((e: Error) => setMsg(e.message));
  }, []);
  useEffect(carregar, [carregar]);

  return (
    <>
      <section className={card}>
        <strong className="text-[16px] text-text">Criar kit “compre junto”</strong>
        <p className="m-0 text-[13px] text-muted">Aparece na página das duas peças. Com as duas na sacola, o desconto entra sozinho no checkout. Não soma com a promoção da peça: vale o maior.</p>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_100px_auto] md:items-start">
          {[{ v: a, set: setA, l: "Peça 1" }, { v: b, set: setB, l: "Peça 2" }].map((x) => (
            <div key={x.l} className="grid gap-1.5">
              <span className="text-[12.5px] font-semibold text-text-2">{x.l}</span>
              {x.v ? (
                <span className="flex items-center justify-between gap-2 rounded-[12px] bg-mist px-3 py-2.5 text-[13.5px] text-teal-dark">
                  {x.v.name}
                  <button type="button" aria-label="Trocar" onClick={() => x.set(null)} className="cursor-pointer border-none bg-transparent p-0 text-muted"><X size={14} /></button>
                </span>
              ) : (
                <BuscaProduto onPick={x.set} placeholder="Buscar peça" />
              )}
            </div>
          ))}
          <label className="grid gap-1.5 text-[12.5px] font-semibold text-text-2">
            Desconto %
            <input inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value.replace(/\D/g, ""))} className={campo} />
          </label>
          <button
            type="button"
            disabled={!a || !b}
            className={`${botao} md:mt-6`}
            onClick={() => {
              setMsg(null);
              void lojaApi.createKit(a!.id, b!.id, Number(pct)).then(() => { setA(null); setB(null); setMsg("Kit criado e ativo na loja."); carregar(); }).catch((e: Error) => setMsg(e.message));
            }}
          >
            Criar kit
          </button>
        </div>
        {a && b && (
          <span className="text-[13px] text-text-2">
            Separadas: {formatarBRL(a.price_cents + b.price_cents)} · no kit: até {formatarBRL(Math.round((a.price_cents + b.price_cents) * (1 - Number(pct || 0) / 100)))} (o servidor confere o teto e a promoção)
          </span>
        )}
        {msg && <span className="text-[13px] text-text-2">{msg}</span>}
      </section>
      <section className={card}>
        <strong className="text-[16px] text-text">Kits</strong>
        {!lista ? (
          <p className="m-0 text-muted">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="m-0 rounded-2xl bg-fog px-4 py-3 text-[13.5px] text-muted">Nenhum kit ainda.</p>
        ) : (
          lista.map((k) => {
            const sep = k.price_a_cents + k.price_b_cents;
            return (
              <div key={k.id} className="flex flex-wrap items-center gap-3 border-t border-[#EEF3F2] pt-3 text-[13.5px]">
                <span className="min-w-[220px] flex-1">
                  <strong className="text-text">{k.name_a} + {k.name_b}</strong>
                  <span className="block text-[12.5px] text-muted">
                    separadas {formatarBRL(sep)} · kit {formatarBRL(Math.round(sep * (1 - k.pct / 100)))}
                  </span>
                </span>
                <span className="rounded-full bg-teal px-2.5 py-1 text-[12px] font-bold text-white">−{k.pct}%</span>
                <Toggle pequeno ligado={k.active} rotulo="Kit ativo" onClick={() => void lojaApi.toggleKit(k.id, !k.active).then(carregar)} />
                <button type="button" aria-label="Excluir" onClick={() => void lojaApi.deleteKit(k.id).then(carregar)} className="cursor-pointer border-none bg-transparent p-1 text-muted hover:text-[#B4443C]">
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}

// ─── Calendário ─────────────────────────────────────────────────────────────

// Datas que mais vendem joia. Móveis (Mães, Pais, Páscoa) calculadas por ano.
function segundoDomingo(ano: number, mes: number) {
  const d = new Date(ano, mes, 1);
  const primeiro = (7 - d.getDay()) % 7;
  return new Date(ano, mes, 1 + primeiro + 7);
}
function pascoa(ano: number) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}
function blackFriday(ano: number) {
  const d = new Date(ano, 10, 1);
  const quinta = (4 - d.getDay() + 7) % 7;
  return new Date(ano, 10, 1 + quinta + 21 + 1);
}
function datas(ano: number) {
  return [
    { nome: "Dia da Mulher", data: new Date(ano, 2, 8), dica: "Kits de presente e peças delicadas do dia a dia." },
    { nome: "Páscoa", data: pascoa(ano), dica: "Presentinhos até R$ 80 vendem bem." },
    { nome: "Dia das Mães", data: segundoDomingo(ano, 4), dica: "A maior data do ano para joias: comece a divulgar 3 semanas antes, por causa do prazo de encomenda." },
    { nome: "Dia dos Namorados", data: new Date(ano, 5, 12), dica: "Pares e berloques de coração. Lembre que a entrega leva até 20 dias úteis." },
    { nome: "Dia dos Pais", data: segundoDomingo(ano, 7), dica: "Pulseiras e correntes masculinas, se houver no catálogo." },
    { nome: "Black Friday", data: blackFriday(ano), dica: "Promoção com início e fim certos; o teto de 30% protege a margem." },
    { nome: "Natal", data: new Date(ano, 11, 25), dica: "Encomenda leva tempo: pare de prometer entrega para o Natal no começo de dezembro." },
  ];
}

function baixarLembrete(nome: string, data: Date) {
  const d = new Date(data.getTime() - 21 * 86400000);
  const f = (x: Date) => `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, "0")}${String(x.getDate()).padStart(2, "0")}`;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mirava//Painel//PT", "BEGIN:VEVENT",
    `UID:${f(data)}-${nome.replace(/\W/g, "")}@mirava`, `DTSTART;VALUE=DATE:${f(d)}`, `DTEND;VALUE=DATE:${f(new Date(d.getTime() + 86400000))}`,
    `SUMMARY:Preparar ${nome} na Mirava`, `DESCRIPTION:Faltam 3 semanas para ${nome}. Agende a promoção e avise as clientes.`, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `lembrete-${nome.toLowerCase().replace(/\s+/g, "-")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function Calendario({ criar }: { criar: (p: Partial<Promotion>) => void }) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const lista = [...datas(hoje.getFullYear()), ...datas(hoje.getFullYear() + 1)]
    .filter((d) => d.data >= hoje)
    .slice(0, 8);
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return (
    <section className={card}>
      <strong className="text-[16px] text-text">Próximas datas</strong>
      {lista.map((d) => {
        const faltam = Math.round((d.data.getTime() - hoje.getTime()) / 86400000);
        const inicio = new Date(d.data.getTime() - 21 * 86400000);
        return (
          <div key={d.nome + d.data.getFullYear()} className="flex flex-wrap items-center gap-4 border-t border-[#EEF3F2] pt-3 text-[13.5px]">
            <span className="grid w-14 justify-items-center rounded-2xl bg-mist py-2 text-teal-dark">
              <strong className="text-[20px] leading-none">{d.data.getDate()}</strong>
              <span className="text-[11px] uppercase">{d.data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
            </span>
            <span className="min-w-[220px] flex-1">
              <strong className="text-text">{d.nome}</strong> <span className="text-[12.5px] text-muted">· faltam {faltam} dias</span>
              <span className="block text-[12.5px] text-text-2">{d.dica}</span>
            </span>
            <button
              type="button"
              className={botao}
              onClick={() => criar({ name: `${d.nome} Mirava`, pct: 15, starts_at: `${iso(inicio)}T00:00`, ends_at: `${iso(d.data)}T23:59` })}
            >
              Criar promoção
            </button>
            <button type="button" className={botaoClaro} onClick={() => baixarLembrete(d.nome, d.data)}>
              Lembrar
            </button>
          </div>
        );
      })}
      <span className="text-[12px] text-muted">“Lembrar” baixa um lembrete para o calendário do celular, 3 semanas antes da data.</span>
    </section>
  );
}

// ─── Cadastros de novidades ─────────────────────────────────────────────────

function Novidades() {
  const [lista, setLista] = useState<{ email: string; whatsapp: string | null; source: string; created_at: string }[] | null>(null);
  useEffect(() => {
    lojaApi.subscribers().then(setLista).catch(() => setLista([]));
  }, []);
  const origem: Record<string, string> = { popup: "Pop-up", rodape: "Home", cadastro: "Criar conta", conta: "Minha conta" };
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="grid">
          <strong className="text-[16px] text-text">Cadastros de novidades ({lista?.length ?? 0})</strong>
          <span className="text-[13px] text-muted">Quem pediu para receber lançamentos e cupons. Só use para isso (LGPD).</span>
        </span>
        {lista && lista.length > 0 && (
          <button
            type="button"
            className={botaoClaro}
            onClick={() =>
              baixarCSV("novidades.csv", [
                ["E-mail", "WhatsApp", "Origem", "Data"],
                ...lista.map((s) => [s.email, s.whatsapp ?? "", origem[s.source] ?? s.source, new Date(s.created_at).toLocaleDateString("pt-BR")]),
              ])
            }
          >
            Exportar CSV
          </button>
        )}
      </div>
      {!lista ? (
        <p className="m-0 text-muted">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="m-0 rounded-2xl bg-fog px-4 py-3 text-[13.5px] text-muted">Nenhum cadastro ainda.</p>
      ) : (
        <div className="grid max-h-[480px] overflow-y-auto">
          {lista.map((s) => (
            <div key={s.email} className="flex flex-wrap gap-3 border-t border-[#EEF3F2] py-2 text-[13.5px]">
              <span className="min-w-[200px] flex-1 text-text">{s.email}</span>
              <span className="text-muted">{s.whatsapp ?? "—"}</span>
              <span className="text-muted">{origem[s.source] ?? s.source}</span>
              <span className="text-muted">{new Date(s.created_at).toLocaleDateString("pt-BR")}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
