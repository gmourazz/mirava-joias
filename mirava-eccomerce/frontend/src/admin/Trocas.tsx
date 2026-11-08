// Trocas e devoluções com etapas (dominio/trocas.go): solicitada → aguardando
// envio → peça recebida → concluída, ou recusada logo no começo. A etapa só
// anda um passo por vez; a anotação vai no e-mail para a cliente.

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RETURN_STAGES, type ReturnRequest, type ReturnStage } from "../lib/extras";
import { growthApi } from "./api";

const PROXIMA: Partial<Record<ReturnStage, { to: ReturnStage; label: string }[]>> = {
  requested: [
    { to: "awaiting_shipment", label: "Aprovar e pedir envio" },
    { to: "rejected", label: "Recusar" },
  ],
  awaiting_shipment: [{ to: "received", label: "Recebi a peça" }],
  received: [{ to: "done", label: "Concluir" }],
};

const ROTULO: Record<ReturnStage, string> = {
  requested: "Solicitada",
  awaiting_shipment: "Aguardando envio",
  received: "Peça recebida",
  done: "Concluída",
  rejected: "Recusada",
};

export default function Trocas() {
  const [lista, setLista] = useState<ReturnRequest[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState<string | null>(null);

  const carregar = useCallback(() => {
    growthApi.returns().then(setLista).catch((e: Error) => setErro(e.message));
  }, []);
  useEffect(carregar, [carregar]);

  async function avancar(r: ReturnRequest, to: ReturnStage) {
    if (to === "rejected" && !window.confirm(`Recusar a solicitação do pedido #${r.order_number}?`)) return;
    setErro(null);
    setEnviando(r.id);
    try {
      await growthApi.advanceReturn(r.id, r.stage, to, notas[r.id]?.trim() ?? "");
      setNotas((n) => ({ ...n, [r.id]: "" }));
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(null);
    }
  }

  const abertas = (lista ?? []).filter((r) => r.stage !== "done" && r.stage !== "rejected");
  const fechadas = (lista ?? []).filter((r) => r.stage === "done" || r.stage === "rejected");

  return (
    <>
      {erro && <p className="m-0 rounded-[20px] bg-[#FDECEC] p-4 text-[13.5px] text-[#B4443C]">{erro}</p>}
      {!lista ? (
        <p className="m-0 rounded-[20px] border border-line bg-white px-5 py-10 text-center text-muted">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="m-0 rounded-[20px] border border-line bg-white px-5 py-10 text-center text-muted">Nenhuma troca pedida até agora.</p>
      ) : (
        <>
          {abertas.map((r) => {
            const atual = RETURN_STAGES.findIndex((s) => s.key === r.stage);
            return (
              <section key={r.id} className="grid gap-3 rounded-[20px] border border-line bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold text-text">
                    <Link to={`/admin/pedidos?abrir=${r.order_id}`} className="text-teal">
                      #{r.order_number}
                    </Link>{" "}
                    · {r.customer} · {r.kind === "troca" ? "Troca" : "Devolução"}
                  </span>
                  <span className="text-[12.5px] text-muted">pedida em {new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
                <p className="m-0 text-[13.5px] text-text-2">
                  <span className="text-muted">{r.items_summary}</span>
                  <br />“{r.reason}”
                </p>
                <ol className="m-0 grid list-none grid-cols-4 gap-1.5 p-0">
                  {RETURN_STAGES.map((s, i) => (
                    <li key={s.key} className="grid gap-1.5">
                      <span className={`h-1.5 rounded-full ${i <= atual ? "bg-teal" : "bg-line"}`} />
                      <span className={`text-[11.5px] ${i === atual ? "font-semibold text-teal" : "text-muted"}`}>{s.label}</span>
                    </li>
                  ))}
                </ol>
                {r.admin_note && <p className="m-0 text-[12.5px] text-muted">Última anotação: {r.admin_note}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={notas[r.id] ?? ""}
                    onChange={(e) => setNotas((n) => ({ ...n, [r.id]: e.target.value }))}
                    maxLength={500}
                    placeholder="Recado para a cliente (vai no e-mail). Ex.: endereço de postagem"
                    className="min-w-[240px] flex-1 rounded-full border-[1.5px] border-line bg-white px-4 py-2.5 text-[13.5px] outline-none focus:border-teal"
                  />
                  {(PROXIMA[r.stage] ?? []).map((p) => (
                    <button
                      key={p.to}
                      type="button"
                      disabled={enviando === r.id}
                      onClick={() => void avancar(r, p.to)}
                      className={`cursor-pointer rounded-full px-4 py-2.5 text-[13px] font-semibold disabled:opacity-60 ${
                        p.to === "rejected"
                          ? "border-[1.5px] border-line bg-white text-text-2 hover:border-[#B4443C] hover:text-[#B4443C]"
                          : "border-none bg-teal text-white hover:bg-teal-dark"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}

          {fechadas.length > 0 && (
            <section className="rounded-[20px] border border-line bg-white">
              <h2 className="m-0 border-b border-[#EEF3F2] px-5 py-3 text-[13px] font-semibold tracking-[0.08em] text-muted uppercase">Encerradas</h2>
              {fechadas.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EEF3F2] px-5 py-3 text-[13.5px] last:border-b-0">
                  <span>
                    <strong className="text-text">#{r.order_number}</strong> · {r.customer} · {r.kind === "troca" ? "Troca" : "Devolução"}
                  </span>
                  <span className={r.stage === "done" ? "font-semibold text-teal" : "text-muted"}>{ROTULO[r.stage]}</span>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}
