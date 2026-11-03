// Perguntas frequentes (v5): faixa com busca no topo, categorias na lateral e
// o acordeão ao lado. A busca procura em todas as categorias, na pergunta e
// na resposta. No fim, a faixa escura de contato.

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AtSign, CreditCard, Gem, HelpCircle, Mail, Package, Plus, RefreshCw, Search, Truck, type LucideIcon,
} from "lucide-react";
import { FAQ, FAQ_CATEGORIAS, type FaqCategoria } from "../data/content";
import { LOJA } from "../config/loja";

const ICONE: Record<FaqCategoria, LucideIcon> = {
  pedidos: Package,
  pagamento: CreditCard,
  entrega: Truck,
  trocas: RefreshCw,
  pecas: Gem,
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function PerguntasFrequentes() {
  const [categoria, setCategoria] = useState<FaqCategoria>("pedidos");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState(0);

  const termo = semAcento(busca.trim());
  const lista = termo
    ? FAQ.filter((f) => semAcento(f.q + " " + f.a).includes(termo))
    : FAQ.filter((f) => f.cat === categoria);
  const atual = FAQ_CATEGORIAS.find((c) => c.key === categoria)!;
  const IconeAtual = termo ? Search : ICONE[categoria];

  const escolher = (c: FaqCategoria) => {
    setCategoria(c);
    setBusca("");
    setAberta(0);
  };

  return (
    <div>
      <div className="bg-mist">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-[clamp(16px,3vw,40px)] py-12 text-center">
          <nav className="text-[12px] tracking-[0.1em] text-[#5E7473] uppercase">
            <Link to="/" className="text-[#5E7473] hover:text-teal">Início</Link>
            <span className="mx-2">/</span>
            <span className="font-semibold text-teal">Perguntas frequentes</span>
          </nav>
          <span className="grid h-[62px] w-[62px] place-items-center rounded-full bg-white text-teal">
            <HelpCircle size={28} strokeWidth={1.6} />
          </span>
          <h1 className="m-0 font-serif text-[clamp(38px,4.4vw,60px)] leading-[1.05] font-normal text-teal-dark">Como podemos ajudar?</h1>
          <label className="mt-2 flex w-full max-w-[560px] items-center gap-3 rounded-full bg-white px-5 py-3.5 shadow-[0_12px_30px_rgba(11,74,77,0.08)]">
            <Search size={19} strokeWidth={1.8} className="text-teal" />
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setAberta(0);
              }}
              placeholder="Busque por prazo, troca, tamanho..."
              className="min-w-0 flex-1 border-none bg-transparent text-[15px] text-text outline-none placeholder:text-[#8A9A9B]"
            />
          </label>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-[clamp(16px,3vw,40px)] pt-10 lg:grid-cols-[minmax(220px,280px)_1fr]">
        <nav className="flex h-fit gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:sticky lg:top-[146px] lg:grid">
          {FAQ_CATEGORIAS.map((c) => {
            const Icon = ICONE[c.key];
            const ativa = !termo && c.key === categoria;
            const n = FAQ.filter((f) => f.cat === c.key).length;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => escolher(c.key)}
                className={`flex shrink-0 cursor-pointer items-center gap-3 rounded-2xl border-none px-4 py-[13px] text-left text-[14.5px] font-semibold transition-colors ${
                  ativa ? "bg-teal text-white" : "bg-fog text-text hover:bg-mist"
                }`}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span className="flex-1">{c.label}</span>
                <span className="text-[12.5px] opacity-70">{n}</span>
              </button>
            );
          })}
        </nav>

        <div className="grid content-start gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-mist text-teal">
              <IconeAtual size={20} strokeWidth={1.8} />
            </span>
            <h2 className="m-0 font-serif text-[32px] font-normal text-teal-dark">
              {termo ? `Resultados para “${busca.trim()}”` : atual.label}
            </h2>
          </div>

          {lista.length === 0 ? (
            <div className="rounded-[22px] bg-[#F7FAFA] px-6 py-10 text-center text-[14.5px] text-text-2">
              Nenhuma pergunta encontrada. Tente “prazo”, “troca” ou “anel”, ou fale com a gente.
            </div>
          ) : (
            lista.map((item, i) => {
              const ativa = aberta === i;
              return (
                <div key={item.q} className={`rounded-[22px] border border-line transition-colors ${ativa ? "bg-[#F7FAFA]" : "bg-white"}`}>
                  <button
                    type="button"
                    onClick={() => setAberta(ativa ? -1 : i)}
                    aria-expanded={ativa}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 border-none bg-transparent px-[22px] py-5 text-left text-[15.5px] font-semibold text-text"
                  >
                    {item.q}
                    <span className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-mist text-teal transition-transform duration-300 ${ativa ? "rotate-45" : ""}`}>
                      <Plus size={15} strokeWidth={2} />
                    </span>
                  </button>
                  {ativa && <p className="animate-fade-in m-0 px-[22px] pb-5 text-[14.5px] leading-[1.7] text-text-2">{item.a}</p>}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-[clamp(16px,3vw,40px)] pt-14">
        <div className="grid grid-cols-1 items-center gap-6 rounded-[32px] bg-teal-dark p-[clamp(24px,3vw,40px)] text-white md:grid-cols-[1.2fr_1fr_1fr]">
          <div className="grid gap-1">
            <span className="font-serif text-[28px]">Ainda com dúvidas?</span>
            <span className="text-[14.5px] text-[#BFE3DF]">A gente responde rapidinho.</span>
          </div>
          <a href={`mailto:${LOJA.email}`} className="flex items-center gap-3 rounded-[20px] bg-white/8 px-5 py-4 text-white hover:bg-white/12 hover:text-white">
            <Mail size={20} strokeWidth={1.7} className="text-teal-pale" />
            <span className="grid">
              <span className="text-[14.5px] font-semibold">E-mail</span>
              <span className="text-[13px] text-[#BFE3DF]">{LOJA.email}</span>
            </span>
          </a>
          <span className="flex items-center gap-3 rounded-[20px] bg-white/8 px-5 py-4">
            <AtSign size={20} strokeWidth={1.7} className="text-teal-pale" />
            <span className="grid">
              <span className="text-[14.5px] font-semibold">Instagram</span>
              <span className="text-[13px] text-[#BFE3DF]">@miravajoias</span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
