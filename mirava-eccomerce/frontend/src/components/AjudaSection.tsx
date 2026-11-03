// "Precisa de ajuda?" (v5): quatro cartões de atalho para o FAQ, as
// políticas e o e-mail.

import { Link } from "react-router-dom";
import { Clock, HelpCircle, Mail, RefreshCw, type LucideIcon } from "lucide-react";
import { LOJA } from "../config/loja";
import { textoPrazo } from "../lib/dinheiro";
import SectionHeading from "./SectionHeading";

const CARDS: { Icon: LucideIcon; t: string; d: string; cta: string; to?: string; href?: string }[] = [
  { Icon: HelpCircle, t: "Perguntas frequentes", d: "Pedidos, pagamento, entrega e mais", cta: "Ver dúvidas", to: "/perguntas-frequentes" },
  { Icon: Clock, t: "Prazo de entrega", d: `Peças sob encomenda chegam em ${textoPrazo()}`, cta: "Saiba mais", to: "/politicas/entrega" },
  { Icon: RefreshCw, t: "Trocas e devoluções", d: "Até 7 dias depois de receber", cta: "Saiba mais", to: "/politicas/trocas" },
  { Icon: Mail, t: "Fale com a gente", d: LOJA.email, cta: "Enviar e-mail", href: `mailto:${LOJA.email}` },
];

const cardClass =
  "group grid content-start gap-3 rounded-[26px] border border-line p-6 text-text transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-line-strong hover:text-text";

export default function AjudaSection() {
  return (
    <section className="mx-auto max-w-[1360px] px-[clamp(16px,3vw,40px)] pt-20">
      <SectionHeading eyebrow="Precisa de ajuda?" title="Estamos aqui por você" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map(({ Icon, t, d, cta, to, href }) => {
          const body = (
            <>
              <span className="grid h-[50px] w-[50px] place-items-center rounded-full bg-mist text-teal">
                <Icon size={22} strokeWidth={1.6} />
              </span>
              <span className="text-[17px] font-semibold">{t}</span>
              <span className="text-[14px] leading-[1.6] break-words text-muted">{d}</span>
              <span className="mt-1 text-[11.5px] font-semibold tracking-[0.14em] text-teal uppercase">{cta} →</span>
            </>
          );
          return to ? (
            <Link key={t} to={to} className={cardClass}>{body}</Link>
          ) : (
            <a key={t} href={href} className={cardClass}>{body}</a>
          );
        })}
      </div>
    </section>
  );
}
