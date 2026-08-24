// Lista de barras horizontais — magnitude, um hue só (vinho), sem legenda:
// cada linha já se identifica pelo rótulo à esquerda, a cor não carrega
// identidade nenhuma aqui. Usado pra "mais vendidos" e "pedidos por status".

export interface BarListItem {
  label: string;
  value: number;
  formattedValue: string;
}

export default function BarList({ items }: { items: BarListItem[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);

  if (items.length === 0) {
    return <p className="m-0 text-[12.5px] text-mauve">Sem dados ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const pct = Math.max(4, Math.round((item.value / max) * 100));
        return (
          <div key={i}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-[12.5px] text-ink">{item.label}</span>
              <span className="shrink-0 text-[12px] font-medium text-wine-dark">{item.formattedValue}</span>
            </div>
            <div className="h-[7px] overflow-hidden rounded-full bg-blush">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#e3b1c8_0%,#d46a9f_100%)] transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
