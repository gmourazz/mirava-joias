// "Teste do brilho" (v5): três perguntas para sugerir prata, ouro ou os dois.
// À direita, dois orbes que crescem conforme as respostas puxam para um lado.
// No fim, o resultado com duas peças reais do banho escolhido.

import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { useProducts } from "../catalogo/hooks";
import { imageUrl } from "../catalogo/consultas";
import ProductCard from "./ProductCard";

type Voto = "p" | "o" | "n";

const SW_PRATA = "linear-gradient(135deg,#F1F3F4,#AEB5B9)";
const SW_OURO = "linear-gradient(135deg,#F6E3AE,#C9A253)";
const SW_MISTO = "linear-gradient(135deg,#E3E7EA 0%,#E3E7EA 50%,#F2D98E 50%,#C9A253 100%)";

const PERGUNTAS: { q: string; opcoes: { t: string; d: string; v: Voto; sw: string }[] }[] = [
  {
    q: "Olhe as veias do seu pulso na luz natural. Elas parecem…",
    opcoes: [
      { t: "Azuladas ou arroxeadas", d: "Subtom frio", v: "p", sw: "#9DB4D6" },
      { t: "Esverdeadas", d: "Subtom quente", v: "o", sw: "#9DBF8C" },
      { t: "Um pouco de cada", d: "Subtom neutro", v: "n", sw: "linear-gradient(135deg,#9DB4D6 50%,#9DBF8C 50%)" },
    ],
  },
  {
    q: "Qual estilo é mais a sua cara no dia a dia?",
    opcoes: [
      { t: "Clean e moderno", d: "Básicos, linhas retas, minimalismo", v: "p", sw: SW_PRATA },
      { t: "Romântico e quentinho", d: "Delicado, feminino, aconchegante", v: "o", sw: SW_OURO },
      { t: "Misturo tudo", d: "Depende do dia e do humor", v: "n", sw: SW_MISTO },
    ],
  },
  {
    q: "Quais cores mais aparecem no seu guarda-roupa?",
    opcoes: [
      { t: "Azul, cinza, preto e branco", d: "Tons frios", v: "p", sw: "linear-gradient(135deg,#3D5A80 50%,#C9D1D9 50%)" },
      { t: "Bege, marrom, verde e terracota", d: "Tons terrosos", v: "o", sw: "linear-gradient(135deg,#C8A27A 50%,#7C8B5A 50%)" },
      { t: "De tudo um pouco", d: "Sem regra", v: "n", sw: SW_MISTO },
    ],
  },
];

const RESULTADO = {
  p: { titulo: "Banhados a prata", texto: "Seu brilho é frio e luminoso. As peças banhadas a prata realçam o seu tom e combinam com o seu estilo clean.", sw: SW_PRATA, rota: "/categoria/prata/todos", metal: "prata" as const },
  o: { titulo: "Banhados a ouro", texto: "Seu brilho é quente e iluminado. As peças banhadas a ouro 18k valorizam o seu tom e trazem um toque romântico.", sw: SW_OURO, rota: "/categoria/ouro/todos", metal: "ouro" as const },
  n: { titulo: "Prata e ouro", texto: "Sorte a sua: os dois banhos combinam com você. Misture prata e ouro sem medo, é tendência!", sw: SW_MISTO, rota: "/categoria/colecoes/todos", metal: undefined },
};

export default function QuizBrilho() {
  const [votos, setVotos] = useState<Voto[]>([]);
  const n = votos.length;
  const fim = n >= PERGUNTAS.length;
  const prata = votos.filter((v) => v === "p").length;
  const ouro = votos.filter((v) => v === "o").length;
  const res = RESULTADO[prata > ouro ? "p" : ouro > prata ? "o" : "n"];

  const { data } = useProducts(fim ? { metal: res.metal, bestSellers: true, limit: 8 } : { limit: 0 });
  const sugestoes = data.filter((p) => imageUrl(p.images[0])).slice(0, 2);

  return (
    <section className="mx-auto max-w-[1360px] px-[clamp(16px,3vw,40px)] pt-20">
      <div className="grid grid-cols-1 overflow-hidden rounded-[36px] bg-mist lg:grid-cols-2">
        <div className="grid content-center gap-6 p-[clamp(24px,4vw,56px)]">
          <span className="flex items-center gap-2 text-[12px] font-bold tracking-[0.18em] text-teal-mid uppercase">
            Teste do brilho · 30 segundos
          </span>
          <h2 className="m-0 font-serif text-[clamp(30px,3.2vw,42px)] leading-[1.08] font-normal text-teal-dark">
            Prata ou ouro: qual combina com você?
          </h2>

          {!fim ? (
            <div key={n} className="animate-pop grid gap-4">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {PERGUNTAS.map((_, i) => (
                    <span key={i} className={`h-1 w-8 rounded-full ${i <= n ? "bg-teal" : "bg-teal/18"}`} />
                  ))}
                </div>
                <span className="text-[11.5px] font-semibold tracking-[0.14em] text-teal">PERGUNTA {n + 1} DE 3</span>
              </div>
              <p className="m-0 text-[19px] font-semibold text-text">{PERGUNTAS[n].q}</p>
              <div className="grid gap-2.5">
                {PERGUNTAS[n].opcoes.map((o) => (
                  <button
                    key={o.t}
                    type="button"
                    onClick={() => setVotos((v) => [...v, o.v])}
                    className="flex cursor-pointer items-center gap-4 rounded-[20px] border-[1.5px] border-transparent bg-white px-[18px] py-3.5 text-left transition-[border-color,transform] duration-300 hover:translate-x-1.5 hover:border-teal"
                  >
                    <span className="h-10 w-10 shrink-0 rounded-full" style={{ background: o.sw }} />
                    <span className="grid flex-1 gap-0.5">
                      <span className="text-[15.5px] font-semibold text-text">{o.t}</span>
                      <span className="text-[13px] text-muted">{o.d}</span>
                    </span>
                    <ArrowRight size={16} strokeWidth={1.8} className="text-teal" />
                  </button>
                ))}
              </div>
              {n > 0 && (
                <button
                  type="button"
                  onClick={() => setVotos((v) => v.slice(0, -1))}
                  className="flex w-fit cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-[12px] font-semibold tracking-[0.14em] text-[#5E7473] uppercase"
                >
                  <ArrowLeft size={14} strokeWidth={1.8} />
                  Voltar
                </button>
              )}
            </div>
          ) : (
            <div className="animate-pop grid gap-5">
              <div className="flex items-center gap-3.5 rounded-[22px] bg-white px-[18px] py-4">
                <span className="h-[46px] w-[46px] shrink-0 rounded-full" style={{ background: res.sw }} />
                <span className="grid gap-0.5">
                  <span className="text-[12px] font-bold tracking-[0.16em] text-teal-mid">SEU BRILHO É</span>
                  <span className="font-serif text-[28px] leading-[1.05] text-teal-dark">{res.titulo}</span>
                </span>
              </div>
              <p className="m-0 max-w-[460px] text-[15.5px] leading-[1.7] text-text-2">{res.texto}</p>
              <div className="flex flex-wrap items-center gap-5">
                <Link
                  to={res.rota}
                  className="flex items-center gap-2.5 rounded-full bg-teal px-7 py-4 text-[13px] font-semibold tracking-[0.14em] text-white uppercase hover:bg-teal-dark hover:text-white"
                >
                  Ver minha seleção
                  <ArrowRight size={15} strokeWidth={1.8} />
                </Link>
                <button
                  type="button"
                  onClick={() => setVotos([])}
                  className="flex cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-[12px] font-semibold tracking-[0.14em] text-teal uppercase"
                >
                  <RefreshCw size={15} strokeWidth={1.8} />
                  Refazer teste
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="relative min-h-[460px] bg-hero p-6">
          {!fim || sugestoes.length === 0 ? (
            <>
              <Orbe label="PRATA" largura={46 + (prata - ouro) * 7} fundo="radial-gradient(circle at 32% 28%,#FFFFFF 0%,#E3E7EA 30%,#AEB5B9 70%,#8E979C 100%)" className="top-[16%] left-[4%]" />
              <Orbe label="OURO" largura={46 + (ouro - prata) * 7} fundo="radial-gradient(circle at 32% 28%,#FFF6D8 0%,#F2D98E 32%,#C9A253 72%,#A8853D 100%)" className="right-[4%] bottom-[12%]" />
            </>
          ) : (
            <div className="animate-pop grid h-full grid-cols-2 content-center gap-4">
              {sugestoes.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Orbe({ label, largura, fundo, className }: { label: string; largura: number; fundo: string; className: string }) {
  return (
    <div
      className={`absolute aspect-square transition-[width] duration-[800ms] ease-[cubic-bezier(.3,1.4,.5,1)] ${className}`}
      style={{ width: `${largura}%` }}
    >
      <span className="block h-full w-full rounded-full shadow-[0_30px_60px_rgba(8,57,60,0.18)]" style={{ background: fundo }} />
      <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-bold tracking-[0.16em] whitespace-nowrap text-teal-dark">
        {label}
      </span>
    </div>
  );
}
