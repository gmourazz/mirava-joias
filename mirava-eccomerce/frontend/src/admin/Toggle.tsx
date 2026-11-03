// Interruptor do painel (v5): trilho de 40×23 que fica teal quando ligado,
// botão branco que desliza com mola. `pequeno` é a versão 34×20 das tabelas.

export default function Toggle({ ligado, onClick, disabled, rotulo, pequeno = false }: { ligado: boolean; onClick: () => void; disabled?: boolean; rotulo: string; pequeno?: boolean }) {
  const w = pequeno ? "w-[34px] h-5" : "w-10 h-[23px]";
  const k = pequeno ? "h-[14px] w-[14px]" : "h-[17px] w-[17px]";
  const x = pequeno ? "translate-x-[14px]" : "translate-x-[17px]";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={disabled}
      onClick={onClick}
      className={`relative shrink-0 cursor-pointer rounded-full border-none p-0 transition-colors disabled:opacity-50 ${w} ${ligado ? "bg-teal" : "bg-[#DDE4E4]"}`}
    >
      <span className={`absolute top-[3px] left-[3px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.2)] transition-transform duration-300 ease-[cubic-bezier(.3,1.4,.5,1)] ${k} ${ligado ? x : ""}`} />
    </button>
  );
}
