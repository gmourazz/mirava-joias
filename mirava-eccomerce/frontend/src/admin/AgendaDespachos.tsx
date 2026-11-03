// Agenda de despachos (v5): os próximos 10 dias úteis, com cada pedido em
// aberto marcado no dia-limite de despacho (↑) e no prazo final de entrega
// (⚑). As duas datas vêm da API (dominio.ShipBy e DeadlineFor); a tela só
// distribui pelos dias. O que já venceu aparece no primeiro dia útil.

import type { AdminOrder } from "./api";

const DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function proximosDiasUteis(n: number): Date[] {
  const out: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (out.length < n) {
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const dataLocal = (iso: string) => {
  // Datas do prazo chegam como dia (meia-noite UTC): usar só a parte da data.
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d);
};

export default function AgendaDespachos({ pedidos, abrir }: { pedidos: AdminOrder[]; abrir: (id: string) => void }) {
  const dias = proximosDiasUteis(10);
  const hoje = dias[0];
  const itens = new Map<string, { o: AdminOrder; tipo: "despacho" | "prazo" }[]>();
  const marcar = (data: Date, o: AdminOrder, tipo: "despacho" | "prazo") => {
    const alvo = data < hoje ? hoje : data;
    const k = chaveDia(alvo);
    itens.set(k, [...(itens.get(k) ?? []), { o, tipo }]);
  };
  for (const o of pedidos) {
    if (!o.deadline) continue;
    marcar(dataLocal(o.deadline.ship_by), o, "despacho");
    marcar(dataLocal(o.deadline.due), o, "prazo");
  }

  return (
    <section className="grid gap-3 rounded-[20px] border border-line bg-white p-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <strong className="text-[16px] text-text">Próximos 10 dias úteis</strong>
        <span className="flex gap-4 text-[12.5px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-teal" /> Despachar até
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#C4483D]" /> Prazo final
          </span>
        </span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {dias.map((d, i) => {
          const lista = itens.get(chaveDia(d)) ?? [];
          return (
            <div key={chaveDia(d)} className={`grid min-h-28 w-[118px] shrink-0 content-start gap-1.5 rounded-2xl p-3 ${i === 0 ? "bg-mist" : "bg-fog"}`}>
              <span className="text-[11px] font-bold tracking-[0.1em] text-muted">{chaveDia(d) === chaveDia(new Date()) ? "HOJE" : DIAS[d.getDay()]}</span>
              <span className="font-serif text-[20px] leading-none text-teal-dark">
                {String(d.getDate()).padStart(2, "0")}/{String(d.getMonth() + 1).padStart(2, "0")}
              </span>
              {lista.length === 0 ? (
                <span className="text-[12px] text-faint">Livre</span>
              ) : (
                lista.map(({ o, tipo }) => (
                  <button
                    key={o.id + tipo}
                    type="button"
                    onClick={() => abrir(o.id)}
                    className={`cursor-pointer rounded-lg border-none px-2 py-1 text-left text-[12px] font-semibold ${
                      tipo === "despacho" ? "bg-teal text-white" : "bg-[#FDECEC] text-[#C4483D]"
                    }`}
                  >
                    {tipo === "despacho" ? "↑" : "⚑"} #{o.number}
                  </button>
                ))
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
