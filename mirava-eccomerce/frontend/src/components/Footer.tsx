import { Link } from "react-router-dom";
import { AtSign, Clock, HelpCircle, Lock, Mail, Moon, Package, RefreshCw, Sparkles, Sun, Truck, Link2, Flame, type LucideIcon } from "lucide-react";
import { LOJA } from "../config/loja";

// Rodapé do design v5: bloco teal-escuro com o topo arredondado, coluna da
// marca e três colunas de links com ícone.

interface FooterLink {
  label: string;
  Icon: LucideIcon;
  to?: string;
  href?: string;
}

const COLS: { title: string; links: FooterLink[] }[] = [
  {
    title: "COMPRAR",
    links: [
      { label: "Lançamentos", to: "/categoria/colecoes/todos", Icon: Sparkles },
      { label: "Mais vendidos", to: "/categoria/colecoes/todos", Icon: Flame },
      { label: "Banhados a prata", to: "/categoria/prata/todos", Icon: Moon },
      { label: "Banhados a ouro", to: "/categoria/ouro/todos", Icon: Sun },
      { label: "Berloques", to: "/categoria/colecoes/berloques", Icon: Link2 },
    ],
  },
  {
    title: "AJUDA",
    links: [
      { label: "Acompanhar pedido", to: "/rastreio", Icon: Truck },
      { label: "Meus pedidos", to: "/conta?aba=pedidos", Icon: Package },
      { label: "Perguntas frequentes", to: "/perguntas-frequentes", Icon: HelpCircle },
      { label: "Entrega e prazos", to: "/politicas/entrega", Icon: Clock },
      { label: "Trocas e devoluções", to: "/politicas/trocas", Icon: RefreshCw },
      { label: "Privacidade e termos", to: "/politicas/privacidade", Icon: Lock },
    ],
  },
  {
    title: "ATENDIMENTO",
    links: [
      { label: LOJA.email, href: `mailto:${LOJA.email}`, Icon: Mail },
      { label: "Seg a sex, 9h às 18h", Icon: Clock },
      { label: "@miravajoias", Icon: AtSign },
    ],
  },
];

const linkClass =
  "flex w-fit items-center gap-2.5 text-[14px] text-[#D9ECEA] transition-[color,transform] duration-200 hover:translate-x-1 hover:text-white";

export default function Footer() {
  return (
    <footer className="mt-20 rounded-t-[40px] bg-teal-dark text-[#D9ECEA]">
      <div className="mx-auto grid max-w-[1360px] grid-cols-1 gap-8 px-[clamp(16px,3vw,40px)] pt-[60px] pb-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
        <div className="grid content-start gap-5">
          <div className="grid gap-1.5">
            <span className="font-logo text-[32px] leading-none tracking-[0.28em] text-white">MIRAVA</span>
            <span className="text-[9px] tracking-[0.42em] text-teal-pale">SEMIJOIAS · PRATA &amp; OURO</span>
          </div>
          <p className="m-0 max-w-[34ch] text-[14px] leading-[1.7]">
            Semijoias banhadas a prata e ouro 18k, delicadas e feitas pra durar.
          </p>
          <div className="flex gap-2.5">
            <a
              href={`mailto:${LOJA.email}`}
              aria-label="E-mail"
              className="grid h-[42px] w-[42px] place-items-center rounded-full bg-white/8 text-teal-pale transition-colors hover:bg-teal hover:text-white"
            >
              <Mail size={18} strokeWidth={1.6} />
            </a>
          </div>
        </div>

        {COLS.map((col) => (
          <div key={col.title} className="grid content-start gap-3.5">
            <span className="text-[12.5px] font-bold tracking-[0.12em] text-[#CFEAE7]">{col.title}</span>
            {col.links.map(({ label, to, href, Icon }) => {
              const content = (
                <>
                  <Icon size={16} strokeWidth={1.6} className="shrink-0 text-teal-pale" />
                  {label}
                </>
              );
              if (to) return <Link key={label} to={to} className={linkClass}>{content}</Link>;
              if (href) return <a key={label} href={href} className={linkClass}>{content}</a>;
              return <span key={label} className="flex items-center gap-2.5 text-[14px]">{content}</span>;
            })}
          </div>
        ))}
      </div>

      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-4 border-t border-white/12 px-[clamp(16px,3vw,40px)] py-6 text-[12.5px]">
        <span>Todas as peças são feitas sob encomenda</span>
        <span className="flex items-center gap-1.5">
          <Lock size={13} strokeWidth={1.8} />
          Site seguro · © 2026 Mirava
        </span>
      </div>
    </footer>
  );
}
