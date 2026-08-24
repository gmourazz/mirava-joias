// Gráfico de receita dos últimos 14 dias — uma série só, um hue só (vinho da
// marca), sem legenda (o título já diz o que é). Área em wash de ~10%, linha
// de 2px, ponto final com anel na cor da superfície, crosshair + tooltip no
// hover. Ver skill de dataviz: sequential/magnitude não precisa de paleta
// categórica, só a rampa rosa→vinho que a marca já tem.

import { useMemo, useState } from "react";
import { formatarBRL } from "../../lib/dinheiro";
import type { DailyRevenue } from "../../lib/admin";

const WINE = "#D46A9F";
const WINE_DARK = "#8E3B6B";
const WIDTH = 640;
const HEIGHT = 200;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

function formatDiaCurto(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export default function RevenueChart({ data }: { data: DailyRevenue[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const { points, gridSteps } = useMemo(() => {
    const maxRaw = Math.max(...data.map((d) => d.revenue_cents), 1);
    // Arredonda o teto pra um número "redondo" — grid não fica com valor
    // estranho tipo R$137,42 no topo.
    const magnitude = 10 ** Math.floor(Math.log10(maxRaw));
    const max = Math.ceil(maxRaw / magnitude) * magnitude || maxRaw;

    const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
    const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const step = data.length > 1 ? innerW / (data.length - 1) : 0;

    const points = data.map((d, i) => ({
      x: PAD_LEFT + i * step,
      y: PAD_TOP + innerH * (1 - d.revenue_cents / max),
      d,
    }));

    const gridSteps = [0, 0.5, 1].map((f) => ({
      y: PAD_TOP + innerH * (1 - f),
      valor: max * f,
    }));

    return { points, gridSteps };
  }, [data]);

  if (data.length === 0) return null;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${HEIGHT - PAD_BOTTOM} L ${points[0].x} ${HEIGHT - PAD_BOTTOM} Z`;
  const active = hover != null ? points[hover] : null;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const xSvg = xRatio * WIDTH;
    let nearest = 0;
    let best = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - xSvg);
      if (dist < best) { best = dist; nearest = i; }
    });
    setHover(nearest);
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full cursor-crosshair"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="receitaWash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={WINE} stopOpacity="0.16" />
            <stop offset="100%" stopColor={WINE} stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridSteps.map((g, i) => (
          <g key={i}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={g.y} y2={g.y} stroke="#F0DCE6" strokeWidth={1} />
            <text x={0} y={g.y - 4} fontSize="9.5" fill="#B49AA6" fontFamily="Montserrat, sans-serif">
              {formatarBRL(g.valor)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="url(#receitaWash)" />
        <path d={linePath} fill="none" stroke={WINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => {
          const eixoLabel = i % 2 === 0 || i === points.length - 1;
          // Pontas ancoradas pra dentro — texto centralizado no primeiro e
          // no último ponto extrapola a borda do SVG e corta ("24/0" em vez
          // de "24/08").
          const anchor = i === 0 ? "start" : i === points.length - 1 ? "end" : "middle";
          return (
            <g key={i}>
              {eixoLabel && (
                <text
                  x={p.x}
                  y={HEIGHT - 8}
                  fontSize="9.5"
                  fill="#B49AA6"
                  textAnchor={anchor}
                  fontFamily="Montserrat, sans-serif"
                >
                  {formatDiaCurto(p.d.date)}
                </text>
              )}
            </g>
          );
        })}

        {/* ponto final, sempre visível */}
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={5} fill={WINE_DARK} stroke="#fff" strokeWidth={2} />

        {active && (
          <g>
            <line
              x1={active.x} x2={active.x}
              y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM}
              stroke={WINE_DARK} strokeWidth={1} strokeDasharray="3,3" opacity={0.5}
            />
            <circle cx={active.x} cy={active.y} r={5} fill={WINE_DARK} stroke="#fff" strokeWidth={2} />
          </g>
        )}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-[10px] bg-[#2b1420] px-3 py-2 text-center shadow-lg"
          style={{ left: `${Math.min(94, Math.max(6, (active.x / WIDTH) * 100))}%` }}
        >
          <p className="m-0 text-[10px] tracking-[0.06em] text-white/60 uppercase">{formatDiaCurto(active.d.date)}</p>
          <p className="m-0 font-serif text-[13px] text-white">{formatarBRL(active.d.revenue_cents)}</p>
          <p className="m-0 text-[9.5px] text-white/50">
            {active.d.orders} {active.d.orders === 1 ? "pedido" : "pedidos"}
          </p>
        </div>
      )}
    </div>
  );
}
