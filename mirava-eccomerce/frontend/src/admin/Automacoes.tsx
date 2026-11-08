// Automações por e-mail. A tarefa agendada (POST /tarefas/automacoes, a cada
// hora) lê as filas e manda; cada fila marca o envio na mesma consulta, então
// ninguém recebe o mesmo e-mail duas vezes. Sem o Resend configurado, nada
// sai — os avisos ficam na fila esperando.

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Mail, Pencil } from "lucide-react";
import { growthApi, lojaApi, type AutomationStatus } from "./api";
import Toggle from "./Toggle";

const INFO: Record<AutomationStatus["key"], { titulo: string; texto: string }> = {
  payment_reminder: {
    titulo: "Lembrete de pagamento",
    texto: "Pedido criado e não pago: um lembrete entre 24 e 72 horas depois, com o link para pagar.",
  },
  abandoned_cart: {
    titulo: "Carrinho abandonado",
    texto: "Cliente logada que deixou peças na sacola por mais de 1 hora e não comprou. Um e-mail por sacola.",
  },
  review_request: {
    titulo: "Pedir avaliação",
    texto: "De 7 a 30 dias depois da entrega, convida a cliente a avaliar as peças.",
  },
  stock_alert: {
    titulo: "Avise-me quando voltar",
    texto: "Quando a peça volta a ficar disponível, avisa quem pediu.",
  },
  return_update: {
    titulo: "Andamento da troca",
    texto: "A cada etapa da troca ou devolução, avisa a cliente com o recado que você escreveu.",
  },
};

// Texto padrão (o mesmo do código, em notificacao.go) — aparece como prévia
// enquanto a dona não escreve o dela.
const PADRAO: Record<AutomationStatus["key"], { assunto: string; corpo: string }> = {
  payment_reminder: { assunto: "Seu pedido #{pedido} está te esperando", corpo: "O pedido #{pedido} ainda está esperando o pagamento. As peças são encomendadas só depois que ele é confirmado. Pelo Pix, cai na hora." },
  abandoned_cart: { assunto: "Suas peças ainda estão na sacola ✦", corpo: "Você deixou peças lindas na sacola. Elas continuam guardadas para você, é só voltar e finalizar quando quiser." },
  review_request: { assunto: "Conta pra gente: o que achou da sua peça?", corpo: "Sua peça do pedido #{pedido} já está com você há uns dias. Conta pra gente o que achou?" },
  stock_alert: { assunto: "{produto} voltou ✦", corpo: "Boa notícia: {produto} voltou a ficar disponível. Garanta a sua antes que acabe de novo." },
  return_update: { assunto: "Sua troca do pedido #{pedido} andou", corpo: "Sua solicitação de troca do pedido #{pedido} mudou de etapa." },
};
const VARIAVEIS = ["{nome}", "{pedido}", "{produto}", "{total}", "{cupom}", "{link}"];
const EXEMPLO: Record<string, string> = { "{nome}": "Marina", "{pedido}": "1042", "{produto}": "Anel Solitário Aura", "{total}": "R$ 129,90", "{cupom}": "BEMVINDA10", "{link}": "mirava.com.br" };
const preencher = (t: string) => VARIAVEIS.reduce((acc, v) => acc.split(v).join(EXEMPLO[v]), t);

export default function Automacoes() {
  const [dados, setDados] = useState<{ items: AutomationStatus[]; email_ready: boolean } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [textos, setTextos] = useState<Record<string, { subject: string; body: string }>>({});
  const [editando, setEditando] = useState<string | null>(null);

  const carregar = useCallback(() => {
    growthApi.automations().then(setDados).catch((e: Error) => setErro(e.message));
    lojaApi.automationTexts().then(setTextos).catch(() => {});
  }, []);
  useEffect(carregar, [carregar]);

  async function alternar(a: AutomationStatus) {
    try {
      await growthApi.setAutomation(a.key, !a.enabled);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <>
      {erro && <p className="m-0 rounded-[20px] bg-[#FDECEC] p-4 text-[13.5px] text-[#B4443C]">{erro}</p>}
      {dados && (
        <p
          className={`m-0 flex items-start gap-2.5 rounded-[20px] p-4 text-[13.5px] leading-relaxed ${
            dados.email_ready ? "bg-mist text-teal-dark" : "bg-[#FDF3E6] text-[#8A5A14]"
          }`}
        >
          {dados.email_ready ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
          {dados.email_ready
            ? "E-mail configurado. As automações ligadas rodam a cada hora."
            : "O envio de e-mail ainda não está configurado (Resend). As automações ficam na fila e começam a sair quando ele for ligado."}
        </p>
      )}
      <section className="rounded-[20px] border border-line bg-white">
        {!dados ? (
          <p className="m-0 px-5 py-10 text-center text-muted">Carregando…</p>
        ) : (
          dados.items.map((a) => {
            const info = INFO[a.key];
            if (!info) return null;
            return (
              <div key={a.key} className="flex flex-wrap items-center gap-4 border-b border-[#EEF3F2] px-5 py-4 last:border-b-0">
                <div className="min-w-[240px] flex-1">
                  <strong className="text-[14.5px] text-text">{info.titulo}</strong>
                  <p className="m-0 mt-0.5 text-[13px] leading-relaxed text-muted">{info.texto}</p>
                </div>
                <span className="text-[12.5px] text-text-2">
                  {/* O aviso de troca sai na hora em que a etapa muda (se o
                      e-mail estiver ligado); aqui conta as trocas que andaram. */}
                  {a.key === "return_update" ? (
                    <><strong className="text-text">{a.sent}</strong> trocas andaram</>
                  ) : (
                    <>
                      <strong className="text-text">{a.sent}</strong> enviados
                      {(a.key === "abandoned_cart" || a.key === "stock_alert") && (
                        <> · <strong className="text-text">{a.pending}</strong> {a.key === "stock_alert" ? "esperando a peça" : "sacolas salvas"}</>
                      )}
                    </>
                  )}
                </span>
                <button type="button" onClick={() => setEditando(editando === a.key ? null : a.key)} className="flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-line bg-white px-3.5 py-2 text-[12.5px] font-semibold text-teal hover:border-teal">
                  <Pencil size={13} /> {textos[a.key]?.subject || textos[a.key]?.body ? "Mensagem própria" : "Editar mensagem"}
                </button>
                <Toggle ligado={a.enabled} onClick={() => void alternar(a)} rotulo={info.titulo} />
                {editando === a.key && (
                  <Editor
                    chave={a.key}
                    inicial={textos[a.key] ?? { subject: "", body: "" }}
                    emailPronto={dados.email_ready}
                    salvo={() => lojaApi.automationTexts().then(setTextos).catch(() => {})}
                  />
                )}
              </div>
            );
          })
        )}
      </section>
    </>
  );
}

function Editor({ chave, inicial, emailPronto, salvo }: {
  chave: AutomationStatus["key"];
  inicial: { subject: string; body: string };
  emailPronto: boolean;
  salvo: () => void;
}) {
  const [assunto, setAssunto] = useState(inicial.subject);
  const [corpo, setCorpo] = useState(inicial.body);
  const [msg, setMsg] = useState<string | null>(null);
  const [foco, setFoco] = useState<"assunto" | "corpo">("corpo");
  const padrao = PADRAO[chave];

  const inserir = (v: string) => (foco === "assunto" ? setAssunto((t) => t + v) : setCorpo((t) => t + v));

  return (
    <div className="grid w-full gap-3 rounded-2xl bg-fog p-4">
      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-text-2">
        <Mail size={14} /> E-mail · enviar por: e-mail (o atendimento da loja é só por e-mail)
      </span>
      <input
        value={assunto}
        maxLength={120}
        onFocus={() => setFoco("assunto")}
        onChange={(e) => setAssunto(e.target.value)}
        placeholder={`Assunto (padrão: ${padrao.assunto})`}
        className="rounded-[12px] border-[1.5px] border-line bg-white px-3 py-2.5 text-[14px] outline-none focus:border-teal"
      />
      <textarea
        value={corpo}
        maxLength={2000}
        rows={4}
        onFocus={() => setFoco("corpo")}
        onChange={(e) => setCorpo(e.target.value)}
        placeholder={`Mensagem (padrão: ${padrao.corpo})`}
        className="resize-y rounded-[12px] border-[1.5px] border-line bg-white px-3 py-2.5 text-[14px] outline-none focus:border-teal"
      />
      <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
        <span className="text-muted">Inserir:</span>
        {VARIAVEIS.map((v) => (
          <button key={v} type="button" onClick={() => inserir(v)} className="cursor-pointer rounded-full border-none bg-white px-2.5 py-1 font-mono text-teal">
            {v}
          </button>
        ))}
      </div>
      <div className="grid gap-1 rounded-xl border border-line bg-white p-4">
        <span className="text-[10px] tracking-[0.3em] text-teal-mid">MIRAVA</span>
        <strong className="text-[15px] text-teal-dark">{preencher(assunto || padrao.assunto)}</strong>
        <span className="text-[13.5px] leading-relaxed whitespace-pre-line text-text-2">Oi, Marina!{"\n\n"}{preencher(corpo || padrao.corpo)}</span>
        <span className="text-[11.5px] text-muted">Prévia com dados de exemplo</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void lojaApi.setAutomationText(chave, assunto, corpo).then(() => { setMsg("Mensagem salva."); salvo(); }).catch((e: Error) => setMsg(e.message))}
          className="cursor-pointer rounded-full border-none bg-teal px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-teal-dark"
        >
          Salvar automação
        </button>
        <button
          type="button"
          disabled={!emailPronto}
          title={emailPronto ? "" : "Configure o envio de e-mail (Resend) primeiro"}
          onClick={() => void lojaApi.setAutomationText(chave, assunto, corpo).then(() => lojaApi.testAutomation(chave)).then((r) => setMsg(`Teste enviado para ${r.to}.`)).catch((e: Error) => setMsg(e.message))}
          className="cursor-pointer rounded-full border-[1.5px] border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-teal disabled:cursor-not-allowed disabled:opacity-40"
        >
          Enviar teste
        </button>
        {(assunto || corpo) && (
          <button type="button" onClick={() => { setAssunto(""); setCorpo(""); }} className="cursor-pointer border-none bg-transparent text-[12.5px] text-muted hover:text-teal">
            voltar ao texto padrão
          </button>
        )}
        {msg && <span className="text-[13px] text-text-2">{msg}</span>}
      </div>
    </div>
  );
}
