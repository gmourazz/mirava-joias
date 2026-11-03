// Políticas da loja (v5): abas com ícone e um cartão com o texto da política
// escolhida. A aba vai na URL (/politicas/trocas), para os links do rodapé e
// do checkout caírem direto no texto certo.

import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Lock, RefreshCw, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import { POLITICAS, type PoliticaKey } from "../data/politicas";
import { LOJA } from "../config/loja";

const ICONE: Record<PoliticaKey, LucideIcon> = {
  trocas: RefreshCw,
  entrega: Truck,
  privacidade: Lock,
  termos: ShieldCheck,
};

export default function Politicas() {
  const { aba } = useParams();
  const navigate = useNavigate();
  const politica = POLITICAS.find((p) => p.key === aba) ?? POLITICAS[0];

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [aba]);

  return (
    <div className="mx-auto grid max-w-[1100px] gap-6 px-[clamp(16px,3vw,40px)] pt-7">
      <nav className="text-[12px] tracking-[0.1em] text-[#5E7473] uppercase">
        <Link to="/" className="text-[#5E7473] hover:text-teal">Início</Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-teal">Políticas da loja</span>
      </nav>
      <h1 className="m-0 font-serif text-[clamp(34px,4vw,52px)] leading-[1.05] font-normal text-teal-dark">Políticas da loja</h1>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {POLITICAS.map((p) => {
          const Icon = ICONE[p.key];
          const ativa = p.key === politica.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => navigate(`/politicas/${p.key}`)}
              className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-full border-none px-[18px] py-3 text-[14px] font-semibold transition-colors ${
                ativa ? "bg-teal text-white" : "bg-chip text-text hover:bg-mist-2"
              }`}
            >
              <Icon size={16} strokeWidth={1.8} />
              {p.label}
            </button>
          );
        })}
      </div>

      <article key={politica.key} className="animate-fade-in rounded-3xl border border-line bg-white p-[clamp(22px,3vw,40px)]">
        <h2 className="m-0 font-serif text-[28px] font-normal text-teal-dark">{politica.label}</h2>
        <p className="m-0 mt-1 text-[13px] text-faint">Atualizada em {politica.atualizada}</p>
        {!politica.revisado && (
          <p className="m-0 mt-4 rounded-[14px] bg-mist px-4 py-3 text-[13px] text-text-2">
            Versão preliminar, em revisão. Em caso de dúvida, fale com a gente pelo e-mail {LOJA.email}.
          </p>
        )}
        <div className="mt-6 grid gap-6">
          {politica.secoes.map((s) => (
            <section key={s.t} className="grid gap-2">
              <h3 className="m-0 text-[16px] font-bold text-text">{s.t}</h3>
              <p className="m-0 text-[14.5px] leading-[1.75] text-text-2">{s.d}</p>
            </section>
          ))}
        </div>
      </article>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-mist px-6 py-5">
        <p className="m-0 text-[14.5px] text-text-2">
          Ficou alguma dúvida? Fale com a gente pelo e-mail <strong className="text-text">{LOJA.email}</strong>.
        </p>
        <Link to="/perguntas-frequentes" className="rounded-full bg-teal px-6 py-3 text-[14px] font-semibold text-white hover:bg-teal-dark hover:text-white">
          Perguntas frequentes
        </Link>
      </div>
    </div>
  );
}
