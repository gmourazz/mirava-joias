// Configurações (v5), só leitura: as regras em vigor e o estado das
// integrações. Regra de dinheiro mora no código, com teste (princípio 3 e 5
// da arquitetura) — mudar aqui por formulário seria mudar preço sem teste.
// A tela mostra onde cada uma é alterada.

import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { formatarBRL } from "../lib/dinheiro";
import { LOJA } from "../config/loja";
import { extraApi, type StoreConfig } from "./api";

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
      <p className="m-0 rounded-2xl bg-mist px-5 py-4 text-[13.5px] leading-relaxed text-text-2">
        Estas regras ficam no código, com teste, e não num formulário: são elas que decidem preço e prazo. Para mudar uma, peça a alteração no
        arquivo indicado — assim nenhuma venda sai com regra errada por um clique.
      </p>

      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
        <Bloco titulo="Integrações">
          <Status ok={c.payment_ready} rotulo="Mercado Pago" detalhe={c.payment_ready ? (c.payment_test_mode ? "credenciais de TESTE" : "produção") : "sem credenciais — checkout recusa"} />
          <Status ok={c.email_ready} rotulo="E-mails às clientes" detalhe={c.email_ready ? "ativos" : "RESEND_API_KEY não configurada — pedidos saem sem aviso"} />
          <Linha rotulo="Endereço do site" valor={c.site_url || "—"} />
          <Linha rotulo="Atendimento" valor={LOJA.email} />
        </Bloco>

        <Bloco titulo="Vendas e frete">
          <Linha rotulo="Frete grátis (PAC) acima de" valor={formatarBRL(c.free_shipping_above_cents)} onde="api/internal/dominio/frete.go" />
          <Linha rotulo="Parcelas sem juros" valor={`${c.installments_no_interest}x`} onde="PARCELAS_SEM_JUROS no .env" />
          <Linha rotulo="Desconto no Pix" valor={LOJA.descontoPixPct > 0 ? `${LOJA.descontoPixPct}%` : "nenhum"} onde="frontend/src/config/loja.ts + checkout no servidor" />
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
