// Configurações (v5). Editáveis: dados da loja, remetente da etiqueta, metas
// do mês e a equipe (papel de despacho, decisão 27). As regras de dinheiro
// (frete grátis, prazo, lote, disjuntor) continuam no código, com teste
// (princípios 3 e 5 da arquitetura) — a tela mostra onde cada uma mora. O
// markup padrão e a sincronização ficam na tela de Sincronização.

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Trash2, Truck, XCircle } from "lucide-react";
import { formatarBRL } from "../lib/dinheiro";
import { LOJA } from "../config/loja";
import { quoteShipping, shippingPrazo, type ShippingOption } from "../lib/frete";
import { lookupZip, onlyDigits } from "../lib/enderecos";
import { extraApi, lojaApi, type StoreConfig, type StoreSettings, type TeamMember } from "./api";

export default function Configuracoes() {
  const [c, setC] = useState<StoreConfig | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    extraApi.config().then(setC).catch((e: Error) => setErro(e.message));
  }, []);

  if (erro) return <p className="m-0 rounded-[20px] bg-[#FDECEC] p-4 text-[#B4443C]">{erro}</p>;
  if (!c) return <p className="m-0 text-muted">Carregando…</p>;

  return (
    <>
      <DadosDaLoja />
      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
        <CalcularFrete />
        <Equipe />
      </div>

      <p className="m-0 rounded-2xl bg-mist px-5 py-4 text-[13.5px] leading-relaxed text-text-2">
        As regras abaixo ficam no código, com teste, e não num formulário: são elas que decidem preço e prazo. Para mudar uma, peça a alteração no
        arquivo indicado. Assim nenhuma venda sai com regra errada por um clique.
      </p>

      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
        <Bloco titulo="Integrações">
          <Status ok={c.payment_ready} rotulo="Mercado Pago" detalhe={c.payment_ready ? (c.payment_test_mode ? "credenciais de TESTE" : "produção") : "sem credenciais: o checkout recusa"} />
          <Status ok={c.email_ready} rotulo="E-mails às clientes" detalhe={c.email_ready ? "ativos" : "RESEND_API_KEY não configurada: pedidos saem sem aviso"} />
          <Linha rotulo="Endereço do site" valor={c.site_url || "—"} />
          <Linha rotulo="Atendimento" valor={LOJA.email} />
        </Bloco>

        <Bloco titulo="Vendas e frete">
          <Linha rotulo="Frete grátis (PAC) acima de" valor={formatarBRL(c.free_shipping_above_cents)} onde="api/internal/dominio/frete.go" />
          <Linha rotulo="Parcelas sem juros" valor={`${c.installments_no_interest}x`} onde="PARCELAS_SEM_JUROS no .env" />
          <Linha rotulo="Desconto no Pix" valor={`${LOJA.descontoPixPct}% nas peças`} onde="api/internal/dominio/preco_pedido.go" />
          <Linha rotulo="Teto de desconto somado" valor="30% do preço cheio das peças" onde="api/internal/dominio/descontos.go" />
          <Linha rotulo="Frete grátis no Mirava Club" valor="PAC grátis do nível Encanto" onde="api/internal/dominio/preco_pedido.go" />
          <Linha rotulo="Embalagem por pedido" valor={formatarBRL(c.packaging_cents)} onde="EMBALAGEM_CENTAVOS no .env" />
        </Bloco>

        <Bloco titulo="Prazo e lote">
          <Linha rotulo="Prazo prometido" valor={`até ${c.promised_business_days} dias úteis`} onde="api/internal/dominio/admin.go" />
          <Linha rotulo="Alerta de prazo" valor={`faltando ${c.near_deadline_days} dias úteis`} />
          <Linha rotulo="Meta do lote (frete grátis no atacado)" valor={formatarBRL(c.batch_goal_cents)} onde="api/internal/dominio/lote.go" />
          <Linha rotulo="Teto de espera do lote" valor={`${c.batch_days_cap} dias úteis`} />
          <Linha rotulo="Frete estimado de lote abaixo da meta" valor={formatarBRL(c.batch_estimated_shipping)} />
        </Bloco>

        <Bloco titulo="Preço e catálogo">
          <Linha rotulo="Disjuntor de preço" valor={`variação acima de ${Math.round(c.variation_limit_pct)}%`} onde="api/internal/dominio/precificacao.go" />
          <Linha rotulo="Faixa de markup aceita" valor={`${c.min_markup_pct}% a ${c.max_markup_pct}%`} />
          <Linha rotulo="Selo “Novo”" valor={`peças cadastradas há até ${c.new_product_days} dias`} />
        </Bloco>
      </div>
    </>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="grid content-start gap-1 rounded-[20px] border border-line bg-white p-[22px]">
      <strong className="mb-2 text-[16px] text-text">{titulo}</strong>
      {children}
    </section>
  );
}

function Linha({ rotulo, valor, onde }: { rotulo: string; valor: string; onde?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t border-[#EEF3F2] py-2.5 text-[13.5px] first-of-type:border-t-0">
      <span className="grid">
        <span className="text-text-2">{rotulo}</span>
        {onde && <span className="font-mono text-[11px] text-faint">{onde}</span>}
      </span>
      <strong className="text-text">{valor}</strong>
    </div>
  );
}

function Status({ ok, rotulo, detalhe }: { ok: boolean; rotulo: string; detalhe: string }) {
  return (
    <div className="flex items-center gap-3 border-t border-[#EEF3F2] py-2.5 text-[13.5px] first-of-type:border-t-0">
      {ok ? <CheckCircle2 size={18} className="text-success" /> : <XCircle size={18} className="text-[#B4443C]" />}
      <span className="flex-1 text-text-2">{rotulo}</span>
      <span className={ok ? "font-semibold text-success" : "font-semibold text-[#B4443C]"}>{detalhe}</span>
    </div>
  );
}

const campo = "w-full min-w-0 rounded-[12px] border-[1.5px] border-line bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-teal";

function DadosDaLoja() {
  const [st, setSt] = useState<StoreSettings | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    lojaApi.settings().then(setSt).catch((e: Error) => setMsg(e.message));
  }, []);
  if (!st) return msg ? <p className="m-0 text-[#B4443C]">{msg}</p> : null;

  const set = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => setSt({ ...st, [k]: v });
  const reais = (c: number) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");
  const centavos = (v: string) => Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100) || 0;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await lojaApi.saveSettings(st!);
      setMsg("Configurações salvas.");
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <form onSubmit={salvar} className="grid gap-[18px] xl:grid-cols-3">
      <Bloco titulo="Dados da loja">
        <Rotulo t="Nome"><input value={st.store_name} onChange={(e) => set("store_name", e.target.value)} className={campo} /></Rotulo>
        <Rotulo t="E-mail de atendimento"><input type="email" value={st.store_email} onChange={(e) => set("store_email", e.target.value)} className={campo} /></Rotulo>
        <Rotulo t="Instagram"><input value={st.store_instagram} onChange={(e) => set("store_instagram", e.target.value)} className={campo} /></Rotulo>
      </Bloco>
      <Bloco titulo="Remetente da etiqueta">
        <Rotulo t="Nome"><input value={st.sender_name} onChange={(e) => set("sender_name", e.target.value)} placeholder="Mirava Semijoias" className={campo} /></Rotulo>
        <div className="grid grid-cols-[minmax(0,1fr)_70px] gap-2">
          <input value={st.sender_street} onChange={(e) => set("sender_street", e.target.value)} placeholder="Rua" className={campo} />
          <input value={st.sender_number} onChange={(e) => set("sender_number", e.target.value)} placeholder="Nº" className={campo} />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <input value={st.sender_complement} onChange={(e) => set("sender_complement", e.target.value)} placeholder="Complemento" className={campo} />
          <input value={st.sender_neighborhood} onChange={(e) => set("sender_neighborhood", e.target.value)} placeholder="Bairro" className={campo} />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_56px_96px] gap-2">
          <input value={st.sender_city} onChange={(e) => set("sender_city", e.target.value)} placeholder="Cidade" className={campo} />
          <input value={st.sender_state} maxLength={2} onChange={(e) => set("sender_state", e.target.value.toUpperCase())} placeholder="UF" className={campo} />
          <input value={st.sender_zip} onChange={(e) => set("sender_zip", onlyDigits(e.target.value).slice(0, 8))} placeholder="CEP" className={campo} />
        </div>
      </Bloco>
      <Bloco titulo="Metas e custos">
        <Rotulo t="Faturamento (R$)"><input inputMode="decimal" defaultValue={reais(st.goal_revenue_cents)} onBlur={(e) => set("goal_revenue_cents", centavos(e.target.value))} className={campo} /></Rotulo>
        <Rotulo t="Pedidos"><input inputMode="numeric" value={st.goal_orders || ""} onChange={(e) => set("goal_orders", Number(onlyDigits(e.target.value)) || 0)} className={campo} /></Rotulo>
        <Rotulo t="Lucro líquido (R$)"><input inputMode="decimal" defaultValue={reais(st.goal_profit_cents)} onBlur={(e) => set("goal_profit_cents", centavos(e.target.value))} className={campo} /></Rotulo>
        <Rotulo t="Custo de cada embrulho (R$): caixinha, laço e cartão">
          <input inputMode="decimal" defaultValue={reais(st.gift_wrap_cost_cents)} onBlur={(e) => set("gift_wrap_cost_cents", centavos(e.target.value))} placeholder="0,00" className={campo} />
        </Rotulo>
      </Bloco>
      <div className="flex items-center gap-3 xl:col-span-3">
        <button type="submit" className="cursor-pointer rounded-full border-none bg-teal px-6 py-3 text-[14px] font-semibold text-white hover:bg-teal-dark">
          Salvar configurações
        </button>
        {msg && <span className="text-[13px] text-text-2">{msg}</span>}
      </div>
    </form>
  );
}

function Rotulo({ t, children }: { t: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-[12.5px] font-semibold text-text-2">
      {t}
      {children}
    </label>
  );
}

function CalcularFrete() {
  const [cep, setCep] = useState("");
  const [opcoes, setOpcoes] = useState<ShippingOption[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  async function calcular(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const end = await lookupZip(onlyDigits(cep));
    if (!end?.state) {
      setMsg("CEP não encontrado.");
      return;
    }
    const q = await quoteShipping(end.state, 0);
    setOpcoes(q.options ?? []);
    setMsg(`${end.city}/${end.state}`);
  }
  return (
    <Bloco titulo="Calcular frete por CEP">
      <form onSubmit={calcular} className="flex gap-2">
        <input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="00000-000" inputMode="numeric" className={`${campo} flex-1`} />
        <button type="submit" className="flex cursor-pointer items-center gap-1.5 rounded-full border-none bg-teal px-4 text-[13px] font-semibold text-white">
          <Truck size={14} /> Calcular
        </button>
      </form>
      {msg && <span className="text-[13px] text-muted">{msg}</span>}
      {opcoes?.map((o) => (
        <div key={o.service} className="flex justify-between border-t border-[#EEF3F2] py-2 text-[13.5px]">
          <span className="text-text">{o.label}</span>
          <span className="text-muted">{shippingPrazo(o)}</span>
          <strong className="text-text">{formatarBRL(o.cents)}</strong>
        </div>
      ))}
      <span className="text-[12px] text-muted">Prazo dos Correios somado ao tempo de encomenda na Lilly. Pedido acima de R$ 300 tem PAC grátis.</span>
    </Bloco>
  );
}

function Equipe() {
  const [lista, setLista] = useState<TeamMember[]>([]);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const carregar = () => lojaApi.team().then(setLista).catch((e: Error) => setMsg(e.message));
  useEffect(() => {
    void carregar();
  }, []);
  return (
    <Bloco titulo="Equipe do painel">
      {lista.map((m) => (
        <div key={m.user_id} className="flex items-center gap-3 border-t border-[#EEF3F2] py-2 text-[13.5px] first-of-type:border-t-0">
          <span className="flex-1">
            <strong className="text-text">{m.name || m.email}</strong>
            <span className="block text-[12px] text-muted">{m.email}</span>
          </span>
          <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${m.role === "master" ? "bg-teal-dark text-white" : "bg-mist text-teal"}`}>
            {m.role === "master" ? "MASTER" : "DESPACHO"}
          </span>
          {m.role === "dispatch" && (
            <button type="button" aria-label="Tirar acesso" onClick={() => void lojaApi.removeTeam(m.user_id).then(carregar)} className="cursor-pointer border-none bg-transparent p-1 text-muted hover:text-[#B4443C]">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          void lojaApi.addTeam(email.trim()).then(() => { setEmail(""); void carregar(); setMsg("Acesso de despacho liberado."); }).catch((err: Error) => setMsg(err.message));
        }}
        className="mt-2 flex gap-2"
      >
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail da conta na loja" className={`${campo} flex-1`} />
        <button type="submit" className="cursor-pointer rounded-full border-none bg-teal px-4 text-[13px] font-semibold text-white">Dar acesso</button>
      </form>
      {msg && <span className="text-[13px] text-text-2">{msg}</span>}
      <span className="text-[12px] text-muted">Despacho vê só pedidos e lote (etiqueta, despachar, lista de compras). Preço, financeiro e clientes ficam só com a master.</span>
    </Bloco>
  );
}
