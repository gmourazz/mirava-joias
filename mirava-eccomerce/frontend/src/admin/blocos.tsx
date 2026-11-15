// Blocos de leitura das telas de configuração do painel (Configurações e
// Técnico).

import type { ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export const campo = "w-full min-w-0 rounded-[12px] border-[1.5px] border-line bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-teal";

export function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="grid content-start gap-1 rounded-[20px] border border-line bg-white p-[22px]">
      <strong className="mb-2 text-[16px] text-text">{titulo}</strong>
      {children}
    </section>
  );
}

export function Linha({ rotulo, valor, onde }: { rotulo: string; valor: string; onde?: string }) {
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

export function Status({ ok, rotulo, detalhe }: { ok: boolean; rotulo: string; detalhe: string }) {
  return (
    <div className="flex items-center gap-3 border-t border-[#EEF3F2] py-2.5 text-[13.5px] first-of-type:border-t-0">
      {ok ? <CheckCircle2 size={18} className="text-success" /> : <XCircle size={18} className="text-[#B4443C]" />}
      <span className="flex-1 text-text-2">{rotulo}</span>
      <span className={ok ? "font-semibold text-success" : "font-semibold text-[#B4443C]"}>{detalhe}</span>
    </div>
  );
}

