// Preço cheio riscado e selo de % quando a peça está em promoção (decisão 32).

import { formatarBRL } from "../lib/dinheiro";

export default function PrecoRiscado({ cheio, pct, className = "" }: { cheio: number; pct: number; className?: string }) {
  if (pct <= 0) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <s className="text-muted">{formatarBRL(cheio)}</s>
      <span className="rounded-full bg-teal px-2 py-0.5 text-[11px] font-bold text-white">−{pct}%</span>
    </span>
  );
}
