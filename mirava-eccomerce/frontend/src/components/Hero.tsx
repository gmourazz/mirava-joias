import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, ChevronLeft, ChevronRight, CreditCard, Cherry, Flame, Gem, Gift, Link2, Moon, Percent, ShieldCheck, Sparkles, Sun,
  type LucideIcon,
} from "lucide-react";
import { HERO_SLIDES } from "../data/content";
import { img } from "../lib/images";
import { LOJA } from "../config/loja";
import { imageUrl } from "../catalogo/consultas";
import { banners } from "../lib/extras";

interface Slide {
  eyebrow: string;
  title: string;
  em: string;
  text: string;
  cta: { label: string; to: string };
  cta2: { label: string; to: string } | null;
  seed: string;
  foto: string;
  posicao: string; // object-position da foto
  fundo: string; // tom claro da foto, atrás do texto (#rrggbb)
  zoom?: boolean; // false = foto parada, sem o zoom lento
  dark: boolean;
}

// "#rrggbb" + transparência, para o degradê que funde a foto ao fundo.
function comAlfa(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Os slides de fábrica (data/content.ts) valem até a dona cadastrar banners
// no painel (Banners e avisos). Banner sem foto usa a arte de fábrica.
const FABRICA: Slide[] = HERO_SLIDES.map((s) => ({ ...s, foto: img(s.seed) }));

// Hero do design v5: três slides em crossfade, foto ocupando a largura toda
// e o texto sobre um degradê que some para a direita. A foto ativa dá um zoom
// lento; o texto sobe ao entrar. Autoplay a cada 6,5 s — mexer na mão
// reinicia o relógio, para o slide não trocar logo depois do clique.

const ADVANCE_MS = 6500;

// Ícone do botão pelo texto dele: os botões dos banners são editáveis no
// painel, então o ícone acompanha o assunto em vez de ficar fixo por slide.
const ICONES_BOTAO: [RegExp, LucideIcon][] = [
  [/lan[cç]amento|novidade|novo/i, Sparkles],
  [/mais vendid|queridinha/i, Flame],
  [/ouro/i, Sun],
  [/prata/i, Moon],
  [/berloque|montar/i, Cherry],
  [/pulseira/i, Link2],
  [/presente/i, Gift],
];
const iconeDoBotao = (t: string): LucideIcon => ICONES_BOTAO.find(([re]) => re.test(t))?.[1] ?? Gem;

const SELOS = [
  { Icon: Gem, label: "Feito sob encomenda" },
  LOJA.descontoPixPct > 0
    ? { Icon: Percent, label: `${LOJA.descontoPixPct}% off no Pix` }
    : { Icon: ShieldCheck, label: "Pagamento seguro" },
  { Icon: CreditCard, label: `${LOJA.parcelasSemJuros}x sem juros` },
];

export default function Hero() {
  const [slides, setSlides] = useState<Slide[]>(FABRICA);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let atual = true;
    banners()
      .then((list) => {
        if (!atual || list.length === 0) return;
        setSlides(
          list.map((b, i) => ({
            eyebrow: b.eyebrow,
            title: b.title,
            em: "",
            text: b.subtitle,
            cta: { label: b.cta_label, to: b.cta_url },
            cta2: null,
            seed: b.id ?? String(i),
            foto: imageUrl(b.image ?? undefined) ?? FABRICA[i % FABRICA.length].foto,
            posicao: b.image ? "50% 50%" : FABRICA[i % FABRICA.length].posicao,
            fundo: b.image ? "#EEF2F1" : FABRICA[i % FABRICA.length].fundo,
            dark: false,
          })),
        );
        setIndex(0);
      })
      .catch(() => {});
    return () => {
      atual = false;
    };
  }, []);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const restart = useCallback(() => {
    clearInterval(timer.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer.current = setInterval(() => setIndex((i) => (i + 1) % slides.length), ADVANCE_MS);
  }, [slides.length]);

  useEffect(() => {
    restart();
    return () => clearInterval(timer.current);
  }, [restart]);

  const go = (i: number) => {
    setIndex((i + slides.length) % slides.length);
    restart();
  };

  const dark = slides[index].dark;

  return (
    <section className="relative h-[clamp(440px,calc(100svh-170px),700px)] overflow-hidden bg-hero">
      {slides.map((s, i) => {
        const active = i === index;
        const Icone1 = iconeDoBotao(s.cta.label);
        const Icone2 = s.cta2 ? iconeDoBotao(s.cta2.label) : null;
        return (
          <div
            key={s.seed}
            aria-hidden={!active}
            className="absolute inset-0 transition-opacity duration-[1100ms]"
            style={{ opacity: active ? 1 : 0, pointerEvents: active ? "auto" : "none" }}
          >
            {/* Fotos quadradas: no computador ficam na metade direita e se
                fundem ao fundo, que é o tom da própria foto bem claro;
                recortar a foto quadrada na largura toda perderia a peça. */}
            <div className="absolute inset-0" style={{ background: s.dark ? "#0B4A4D" : s.fundo }} />
            <div className="absolute inset-y-0 right-0 w-full overflow-hidden sm:w-[60%]">
              <img
                src={s.foto}
                alt=""
                className="h-full w-full object-cover ease-out"
                style={{ objectPosition: s.posicao, transform: active && s.zoom !== false ? "scale(1.05)" : "scale(1)", transition: "transform 8s ease-out" }}
              />
              <div
                className="absolute inset-0 hidden sm:block"
                style={{
                  background: `linear-gradient(90deg, ${[
                    [1, 0], [1, 6], [0.92, 14], [0.75, 22], [0.5, 31], [0.25, 40], [0.08, 48], [0, 56],
                  ]
                    .map(([a, p]) => `${comAlfa(s.dark ? "#0B4A4D" : s.fundo, a)} ${p}%`)
                    .join(", ")})`,
                }}
              />
            </div>
            {/* No celular a foto fica atrás do texto inteiro: o degradê lateral
                não basta, então um véu cobre tudo. */}
            <div className={`absolute inset-0 sm:hidden ${s.dark ? "bg-teal-dark/75" : "bg-[#EAF5F4]/80"}`} />
            <div className="relative mx-auto flex h-full max-w-[1440px] items-center px-[clamp(20px,5vw,80px)]">
              <div
                className="grid max-w-[600px] gap-[clamp(12px,2.2vh,22px)] pb-16 sm:pb-14 transition-[opacity,transform] duration-[1100ms] ease-[cubic-bezier(.2,.7,.2,1)]"
                style={{ opacity: active ? 1 : 0, transform: active ? "none" : "translateY(22px)" }}
              >
                <span className={`flex items-center gap-2 text-[12px] font-semibold tracking-[0.22em] uppercase ${s.dark ? "text-teal-pale" : "text-teal-mid"}`}>
                  {s.eyebrow}
                </span>
                <h1 className={`m-0 font-serif text-[clamp(36px,min(4.6vw,8.2vh),72px)] leading-[1.02] font-normal ${s.dark ? "text-white" : "text-teal-dark"}`}>
                  {s.title} <em className={s.dark ? "text-teal-pale" : "text-teal"}>{s.em}</em>
                </h1>
                <p className={`m-0 max-w-[44ch] text-[16px] leading-[1.7] ${s.dark ? "text-[#D6EEEB]" : "text-text-2"}`}>{s.text}</p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to={s.cta.to}
                    tabIndex={active ? 0 : -1}
                    className={`flex items-center gap-2.5 rounded-full px-[30px] py-[17px] text-[13px] font-semibold tracking-[0.14em] uppercase transition-transform hover:-translate-y-0.5 ${
                      s.dark ? "bg-white text-teal-dark hover:text-teal-dark" : "bg-teal text-white hover:bg-teal-dark hover:text-white"
                    }`}
                  >
                    <Icone1 size={16} strokeWidth={1.8} aria-hidden />
                    {s.cta.label}
                    <ArrowRight size={15} strokeWidth={1.8} />
                  </Link>
                  {s.cta2 && (
                    <Link
                      to={s.cta2.to}
                      tabIndex={active ? 0 : -1}
                      className="flex items-center gap-2.5 rounded-full border-[1.5px] border-teal px-7 py-4 text-[13px] font-semibold tracking-[0.14em] text-teal uppercase transition-transform hover:-translate-y-0.5"
                    >
                      {Icone2 && <Icone2 size={16} strokeWidth={1.8} aria-hidden />}
                      {s.cta2.label}
                    </Link>
                  )}
                </div>
                <div className={`hidden flex-wrap gap-x-5 gap-y-2 text-[13px] sm:flex [@media(max-height:780px)]:sm:hidden ${s.dark ? "text-[#D6EEEB]" : "text-text-2"}`}>
                  {SELOS.map(({ Icon, label }) => (
                    <span key={label} className="flex items-center gap-1.5">
                      <Icon size={16} strokeWidth={1.6} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="absolute right-[clamp(20px,5vw,80px)] bottom-3 left-[clamp(20px,5vw,80px)] mx-auto flex max-w-[1280px] items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className={`text-[12px] tracking-[0.16em] whitespace-nowrap ${dark ? "text-white" : "text-teal-dark"}`}>
            {String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
          </span>
          <div className="flex gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.seed}
                type="button"
                onClick={() => go(i)}
                aria-label={`Ir para o slide ${i + 1}`}
                aria-current={i === index}
                className={`h-[3px] w-7 cursor-pointer overflow-hidden rounded-full border-none p-0 sm:w-11 ${dark ? "bg-white/30" : "bg-teal/20"}`}
              >
                <span
                  className={`block h-full transition-[width] duration-500 ${dark ? "bg-white" : "bg-teal"}`}
                  style={{ width: i <= index ? "100%" : "0%" }}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Slide anterior"
            className="grid h-12 w-12 cursor-pointer place-items-center rounded-full border-none bg-white text-teal shadow-[0_8px_24px_rgba(8,57,60,0.14)] transition-transform hover:scale-[1.08]"
          >
            <ChevronLeft size={20} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Próximo slide"
            className="grid h-12 w-12 cursor-pointer place-items-center rounded-full border-none bg-teal text-white shadow-[0_8px_24px_rgba(8,57,60,0.14)] transition-transform hover:scale-[1.08]"
          >
            <ChevronRight size={20} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </section>
  );
}
