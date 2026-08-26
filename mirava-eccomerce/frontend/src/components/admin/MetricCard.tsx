// Card de métrica do painel — número grande + rótulo + ícone. Usado na
// grade principal da Visão geral. "destaque" é o card com fundo em degradê,
// reservado pra uma métrica só por tela (hoje: lucro estimado do mês).

import type { LucideIcon } from "lucide-react";

export default function MetricCard({
  icon: Icon,
  titulo,
  valor,
  destaque = false,
}: {
  icon: LucideIcon;
  titulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-[16px] border p-4 shadow-[0_6px_20px_-10px_rgba(92,42,70,0.25)] transition-shadow hover:shadow-[0_10px_26px_-10px_rgba(92,42,70,0.3)] ${
        destaque
          ? "border-wine/40 bg-[linear-gradient(160deg,#fff9fb_0%,#fdeaf2_100%)]"
          : "border-blush bg-white"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            destaque ? "bg-wine text-white" : "bg-blush text-wine-dark"
          }`}
        >
          <Icon className="h-[15px] w-[15px]" strokeWidth={1.8} />
        </span>
        <p className="m-0 text-[10.5px] tracking-[0.08em] text-ink-soft uppercase">{titulo}</p>
      </div>
      <p className={`m-0 mt-2.5 font-serif text-[21px] ${destaque ? "text-wine-dark" : "text-ink"}`}>{valor}</p>
    </div>
  );
}
