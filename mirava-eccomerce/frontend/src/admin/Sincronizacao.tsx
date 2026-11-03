// Sincronização com a Use Lilly (v5): alertas de preço, conexão (testar e
// sincronizar agora — a trava no servidor impede duas leituras juntas),
// regras editáveis, fila "novos na Lilly", mapeamento de categorias, estado
// do espelho, histórico das leituras e as falhas da última rodada.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, XCircle } from "lucide-react";
import { formatarBRL } from "../lib/dinheiro";
import { lojaApi, reportApi, type StoreSettings, type SyncData, type SyncRun } from "./api";
import { AlertasPreco, ConexaoERegras, Mapeamento, NovosNaLilly } from "./SincronizacaoExtras";

export default function Sincronizacao() {
  const [dados, setDados] = useState<SyncData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [st, setSt] = useState<StoreSettings | null>(null);

  useEffect(() => {
    reportApi.sync().then(setDados).catch((e: Error) => setErro(e.message));
    lojaApi.settings().then(setSt).catch(() => {});
  }, []);

  useEffect(() => {
    if (dados && window.location.hash === "#fila") document.getElementById("fila")?.scrollIntoView({ behavior: "smooth" });
  }, [dados]);

  if (erro) return <p className="m-0 rounded-[20px] bg-[#FDECEC] p-4 text-[#B4443C]">{erro}</p>;
  if (!dados) return <p className="m-0 text-muted">Carregando…</p>;

  const { overview: o, rules } = dados;
  const ultima = o.runs.find((r) => !r.interrupted && r.status !== "running") ?? null;

  return (
    <>
      {st && <AlertasPreco st={st} />}
      <section className="flex flex-wrap items-center gap-5 rounded-[20px] border border-line bg-white p-[22px]">
        <span className="grid h-[60px] w-[60px] place-items-center rounded-2xl bg-teal-dark font-logo text-[13px] tracking-[0.18em] text-white">LILLY</span>
        <div className="grid flex-1 gap-1">
          <strong className="text-[17px] text-text">Use Lilly · fornecedora</strong>
          <span className="text-[13.5px] text-muted">
            uselilly.com · leitura do sitemap e das páginas públicas
            {ultima && ` · última leitura completa em ${new Date(ultima.finished_at ?? ultima.started_at).toLocaleString("pt-BR")}`}
          </span>
        </div>
        <a href="https://www.uselilly.com" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full border-[1.5px] border-line-strong px-4 py-2.5 text-[13px] font-semibold text-teal">
          Abrir site <ExternalLink size={14} />
        </a>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Peças no espelho da Lilly" valor={o.mirror_total} nota={`${o.mirror_available} disponíveis`} />
        <Stat label="Sumiram do site dela" valor={o.mirror_vanished} nota="não aparecem mais no sitemap" />
        <Stat label="Publicadas na Mirava" valor={o.published} nota={`${o.unpublished} despublicadas`} to="/admin/produtos?status=despublicados" />
        <Stat label="Alertas de preço" valor={o.price_alerts} nota="travados pelo disjuntor" to="/admin/produtos?status=alerta" alerta={o.price_alerts > 0} />
      </section>

      {st && (
        <ConexaoERegras
          st={st}
          salvar={async (n) => {
            await lojaApi.saveSettings(n);
            setSt(n);
          }}
        />
      )}
      <NovosNaLilly />
      <Mapeamento />

      <section className="grid gap-3 rounded-[20px] border border-line bg-white p-[22px]">
        <strong className="text-[16px] text-text">Regras fixas</strong>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Regra titulo="Disjuntor de preço" texto={`Se o preço calculado variar mais de ${Math.round(rules.variation_limit_pct)}%, não muda sozinho: vira alerta para você aceitar ou recusar.`} />
          <Regra titulo="Peça nova" texto={st?.auto_import ? "Entra na loja sozinha, com o markup da categoria ou o padrão. Desligue a importação automática para revisar antes." : "Fica na fila “Novos na Use Lilly” até você importar ou ignorar."} />
          <Regra titulo="Lote de compra" texto={`Fecha em ${formatarBRL(rules.batch_goal_cents)} de atacado ou quando o pedido mais antigo faz ${rules.batch_days_cap} dias úteis.`} />
        </div>
        <span className="text-[12.5px] text-muted">A leitura roda sozinha pelo agendador na frequência escolhida acima, com pausa entre as páginas para não sobrecarregar o site da Lilly.</span>
      </section>

      <section className="overflow-x-auto rounded-[20px] border border-line bg-white">
        <div className="min-w-[760px]">
          <div className="border-b border-line px-5 py-4">
            <strong className="text-[16px] text-text">Histórico de leituras</strong>
          </div>
          {o.runs.length === 0 ? (
            <p className="m-0 px-5 py-8 text-center text-muted">Nenhuma leitura registrada ainda.</p>
          ) : (
            o.runs.map((r) => <LinhaLeitura key={r.id} r={r} />)
          )}
        </div>
      </section>

      {o.failures.length > 0 && (
        <section className="grid gap-2 rounded-[20px] border border-line bg-white p-[22px]">
          <strong className="text-[16px] text-text">Páginas que falharam na última rodada com problema</strong>
          <span className="text-[12.5px] text-muted">
            Se forem muitas, o layout do site da Lilly provavelmente mudou e o leitor precisa de ajuste. O dado anterior da peça é mantido.
          </span>
          <div className="mt-2 grid max-h-[320px] overflow-y-auto">
            {o.failures.map((f, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-3 border-t border-[#EEF3F2] py-2 text-[13px]">
                <a href={f.url} target="_blank" rel="noreferrer" className="truncate text-teal">{f.url.replace(/^https?:\/\/(www\.)?/, "")}</a>
                <span className="text-muted">{f.reason}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function LinhaLeitura({ r }: { r: SyncRun }) {
  const estado = r.interrupted
    ? { Icon: XCircle, label: "Interrompida", cor: "text-[#B4443C]" }
    : r.status === "running"
      ? { Icon: Clock, label: "Rodando", cor: "text-teal" }
      : r.status === "success"
        ? { Icon: CheckCircle2, label: "Concluída", cor: "text-success" }
        : r.status === "partial"
          ? { Icon: AlertTriangle, label: "Parcial", cor: "text-[#B07A12]" }
          : { Icon: XCircle, label: "Erro", cor: "text-[#B4443C]" };
  return (
    <div className="grid grid-cols-[150px_120px_1fr] items-center gap-4 border-b border-[#EEF3F2] px-5 py-3 text-[13.5px] last:border-b-0">
      <span className="text-text-2">{new Date(r.started_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
      <span className={`flex items-center gap-1.5 font-semibold ${estado.cor}`}>
        <estado.Icon size={15} strokeWidth={2} />
        {estado.label}
      </span>
      <span className="text-muted">
        {r.processed} de {r.sitemap_urls} páginas · {r.created} novas · {r.updated} atualizadas · {r.failed} falhas · {r.vanished} sumiram
        {r.locked_prices > 0 && <strong className="text-[#B07A12]"> · {r.locked_prices} preços travados</strong>}
        {r.error && <span className="text-[#B4443C]"> · {r.error}</span>}
      </span>
    </div>
  );
}

function Stat({ label, valor, nota, to, alerta = false }: { label: string; valor: number; nota: string; to?: string; alerta?: boolean }) {
  const corpo = (
    <>
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className={`font-serif text-[26px] leading-none ${alerta ? "text-[#B07A12]" : "text-teal-dark"}`}>{valor.toLocaleString("pt-BR")}</span>
      <span className="text-[12px] text-muted">{nota}</span>
    </>
  );
  const cls = "grid gap-1.5 rounded-[20px] border border-line bg-white p-[18px]";
  return to ? (
    <Link to={to} className={`${cls} hover:border-line-strong`}>{corpo}</Link>
  ) : (
    <div className={cls}>{corpo}</div>
  );
}

function Regra({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="grid content-start gap-1 rounded-2xl bg-fog p-4">
      <strong className="text-[14px] text-text">{titulo}</strong>
      <span className="text-[13px] leading-relaxed text-text-2">{texto}</span>
    </div>
  );
}
