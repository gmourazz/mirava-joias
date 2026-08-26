// Atalho de filtro em forma de card — usado na lista de Pedidos pra pular
// direto pros status mais comuns (pago a despachar, enviado...) sem abrir
// o select com os dez status possíveis.

export default function FilterTile({
  label,
  n,
  sublabel,
  active,
  onClick,
}: {
  label: string;
  n: number;
  sublabel?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-[14px] border p-4 text-left transition-[border,box-shadow] ${
        active
          ? "border-wine bg-white shadow-[0_6px_16px_-8px_rgba(142,59,107,0.3)]"
          : "border-blush bg-cream/40 hover:border-mauve"
      }`}
    >
      <p className={`m-0 text-[10px] tracking-[0.08em] uppercase ${active ? "font-semibold text-wine-dark" : "text-mauve"}`}>
        {label}
      </p>
      <p className="m-0 mt-1 font-serif text-[21px] text-ink">{n}</p>
      {sublabel && <p className="m-0 mt-0.5 text-[11px] text-mauve">{sublabel}</p>}
    </button>
  );
}
