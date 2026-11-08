// Select da loja e do painel: botão + lista própria, no lugar do menu nativo do
// navegador. Dois formatos: `pill` (filtros, com destaque teal quando `active`)
// e `field` (campo de formulário). A lista abre num portal para não ser
// cortada por drawer ou modal, e o foco fica no botão: setas, Home/End, Enter,
// Esc e digitar a inicial funcionam como no select nativo.

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  active?: boolean;
  variant?: "pill" | "field";
  required?: boolean;
  /** Para select sem <label> em volta. */
  ariaLabel?: string;
  /** Classes extras no container (largura, flex). */
  className?: string;
}

const MARGEM = 8;

export default function Select({
  value, onChange, options, active = false, variant = "pill", required = false, ariaLabel, className = "",
}: SelectProps) {
  const [aberto, setAberto] = useState(false);
  const [marcado, setMarcado] = useState(0);
  const [posicao, setPosicao] = useState<CSSProperties>({ visibility: "hidden" });
  const botao = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const busca = useRef({ texto: "", ate: 0 });
  const id = useId();

  const indice = options.findIndex((o) => o.value === value);
  const atual = options[indice];

  const abrir = () => {
    setMarcado(Math.max(indice, 0));
    setPosicao({ visibility: "hidden" });
    setAberto(true);
  };
  const escolher = (i: number) => {
    onChange(options[i].value);
    setAberto(false);
    botao.current?.focus();
  };

  // Mede depois de renderizar: abre para baixo e vira para cima se não couber.
  useLayoutEffect(() => {
    if (!aberto || !botao.current || !lista.current) return;
    const b = botao.current.getBoundingClientRect();
    const l = lista.current.getBoundingClientRect();
    const cabeEmbaixo = b.bottom + 6 + l.height + MARGEM <= window.innerHeight;
    const acima = !cabeEmbaixo && b.top > window.innerHeight - b.bottom;
    setPosicao({
      left: Math.max(MARGEM, Math.min(b.left, window.innerWidth - l.width - MARGEM)),
      top: acima ? Math.max(MARGEM, b.top - 6 - l.height) : b.bottom + 6,
      minWidth: b.width,
    });
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: Event) => {
      const alvo = e.target as Node;
      if (!lista.current?.contains(alvo) && !botao.current?.contains(alvo)) setAberto(false);
    };
    const fechar = () => setAberto(false);
    document.addEventListener("pointerdown", fora);
    document.addEventListener("scroll", fora, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("scroll", fora, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  useEffect(() => {
    if (aberto) lista.current?.children[marcado]?.scrollIntoView({ block: "nearest" });
  }, [aberto, marcado]);

  const teclado = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!aberto) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        abrir();
      }
      return;
    }
    const ultimo = options.length - 1;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // Esc fecha a lista, não o drawer em volta.
      setAberto(false);
    } else if (e.key === "Tab") {
      setAberto(false);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (options[marcado]) escolher(marcado);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setMarcado((i) => Math.min(i + 1, ultimo));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMarcado((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setMarcado(e.key === "Home" ? 0 : ultimo);
    } else if (e.key.length === 1) {
      const agora = Date.now();
      busca.current.texto = (agora < busca.current.ate ? busca.current.texto : "") + e.key.toLowerCase();
      busca.current.ate = agora + 700;
      const achou = options.findIndex((o) => o.label.toLowerCase().startsWith(busca.current.texto));
      if (achou >= 0) setMarcado(achou);
    }
  };

  const estilo =
    variant === "pill"
      ? `gap-2.5 rounded-full py-2.5 pr-3.5 pl-4 text-[13.5px] font-semibold ${active ? "border-teal bg-mist text-teal" : "border-line bg-white text-text"}`
      : "w-full gap-2 rounded-[12px] border-line bg-white px-3.5 py-2.5 text-[14px] text-text";

  return (
    <span className={`relative inline-flex min-w-0 ${variant === "field" ? "w-full" : ""} ${className}`}>
      <button
        ref={botao}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        aria-activedescendant={aberto ? `${id}-${marcado}` : undefined}
        aria-label={ariaLabel}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        onKeyDown={teclado}
        className={`flex min-w-0 cursor-pointer items-center justify-between border-[1.5px] text-left font-sans transition-colors outline-none hover:border-teal focus-visible:shadow-[0_0_0_3px_rgba(15,110,115,0.12)] ${
          aberto ? "border-teal" : ""
        } ${estilo}`}
      >
        <span className="truncate">{atual?.label ?? ""}</span>
        <ChevronDown size={15} strokeWidth={2} className={`shrink-0 text-teal transition-transform duration-200 ${aberto ? "rotate-180" : ""}`} />
      </button>

      {required && (
        <input
          required
          tabIndex={-1}
          aria-hidden
          value={value}
          onChange={() => {}}
          onFocus={() => botao.current?.focus()}
          className="pointer-events-none absolute bottom-0 left-1/2 h-px w-px opacity-0"
        />
      )}

      {aberto &&
        createPortal(
          <ul
            ref={lista}
            id={id}
            role="listbox"
            style={posicao}
            className="animate-fade-in fixed z-[1000] m-0 grid max-h-[280px] max-w-[min(380px,calc(100vw-16px))] list-none gap-0.5 overflow-y-auto overscroll-contain rounded-[18px] border border-line bg-white p-1.5 font-sans shadow-[0_18px_44px_rgba(7,40,40,0.16)]"
          >
            {options.map((o, i) => {
              const escolhido = o.value === value;
              return (
                <li
                  key={o.value}
                  id={`${id}-${i}`}
                  role="option"
                  aria-selected={escolhido}
                  onPointerEnter={() => setMarcado(i)}
                  onClick={() => escolher(i)}
                  className={`flex cursor-pointer items-center justify-between gap-4 rounded-[12px] px-3 py-2.5 text-[14px] transition-colors ${
                    i === marcado ? "bg-mist" : ""
                  } ${escolhido ? "font-semibold text-teal" : "font-medium text-text"}`}
                >
                  {o.label}
                  {escolhido && <Check size={15} strokeWidth={2.2} className="shrink-0" />}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </span>
  );
}
