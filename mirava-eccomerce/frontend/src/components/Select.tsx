// Select em pill do design v5: borda fina, chevron teal e, quando o filtro
// está diferente do padrão, borda, texto e fundo em teal claro. É o <select>
// nativo por baixo — no celular abre o seletor do sistema, que é o que a
// cliente já sabe usar.

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  active?: boolean;
}

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%230F6E73' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export default function Select({ value, onChange, options, active = false }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`cursor-pointer appearance-none rounded-full border-[1.5px] bg-no-repeat py-2.5 pr-10 pl-3.5 font-sans text-[13.5px] font-semibold transition-colors outline-none hover:border-teal focus:shadow-[0_0_0_3px_rgba(15,110,115,0.12)] ${
        active ? "border-teal bg-mist text-teal" : "border-line bg-white text-text"
      }`}
      style={{ backgroundImage: CHEVRON, backgroundPosition: "right 14px center" }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
