// Título de seção do design v5: eyebrow com brilho em teal médio, título em
// DM Serif Display (o <em> sai em itálico teal) e, opcionalmente, um link
// "ver tudo" à direita. Um componente só, para o ritmo da home não variar de
// seção pra seção.

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  action?: { to: string; label: string };
  align?: "left" | "center";
  /** "light" para usar em cima de fundo escuro. */
  tone?: "dark" | "light";
  /** Conteúdo extra à direita (abas, setas). Substitui o `action`. */
  aside?: ReactNode;
}

export default function SectionHeading({
  eyebrow, title, description, action, align = "left", tone = "dark", aside,
}: SectionHeadingProps) {
  const center = align === "center";
  const titleColor = tone === "light" ? "text-white" : "text-teal-dark";
  const eyebrowColor = tone === "light" ? "text-teal-pale" : "text-teal-mid";
  const textColor = tone === "light" ? "text-[#D6EEEB]" : "text-text-2";

  return (
    <div className={`mb-7 flex flex-wrap gap-x-6 gap-y-4 ${center ? "flex-col items-center text-center" : "items-end justify-between"}`}>
      <div className={`grid gap-3 ${center ? "justify-items-center" : ""}`}>
        {eyebrow && (
          <span className={`flex items-center gap-2 text-[12px] font-bold tracking-[0.18em] uppercase ${eyebrowColor}`}>
            <Sparkles size={14} strokeWidth={1.8} />
            {eyebrow}
          </span>
        )}
        <h2 className={`m-0 font-serif text-[clamp(30px,3.2vw,42px)] leading-[1.08] font-normal [&_em]:text-teal ${titleColor}`}>
          {title}
        </h2>
        {description && <p className={`m-0 max-w-[52ch] text-[15px] leading-[1.7] ${textColor}`}>{description}</p>}
      </div>
      {aside ??
        (action && (
          <Link
            to={action.to}
            className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.14em] text-teal uppercase hover:text-teal-dark"
          >
            {action.label}
            <ArrowRight size={14} strokeWidth={1.8} />
          </Link>
        ))}
    </div>
  );
}
