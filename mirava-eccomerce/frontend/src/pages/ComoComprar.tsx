import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Banknote, CreditCard, QrCode } from "lucide-react";
import HowItWorks from "../components/HowItWorks";
import TrustBar from "../components/TrustBar";
import Reveal from "../components/Reveal";
import { imageUrl } from "../catalogo/consultas";
import { useShowcaseProducts } from "../catalogo/hooks";
import { img } from "../lib/images";
import { LOJA } from "../config/loja";

const PAGAMENTOS = [
  {
    icon: QrCode,
    title: "Pix",
    desc: "Confirmação na hora, a forma mais rápida de garantir sua peça.",
    destaque: true,
  },
  {
    icon: CreditCard,
    title: "Cartão de crédito",
    desc: `Em até ${LOJA.parcelasSemJuros}x sem juros, ou mais parcelas com juros da operadora.`,
    destaque: false,
  },
  {
    icon: Banknote,
    title: "Pagamento 100% seguro",
    desc: "Processado por um gateway certificado, a Mirava nunca vê nem guarda o número do seu cartão.",
    destaque: false,
  },
];

export default function ComoComprar() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const showcase = useShowcaseProducts(4);
  const fotoCTA = (imageUrl(showcase[0]?.images[0]) ?? undefined) || img("hero-c");

  // HowItWorks já é uma seção completa, com o próprio título "Como comprar" —
  // por isso esta página não repete outro cabeçalho por cima.
  return (
    <div>
      <HowItWorks />

      {/* Formas de pagamento */}
      <section className="border-t border-blush-2 bg-cream/40 px-6 py-[88px] sm:px-16 lg:px-24">
        <Reveal className="mx-auto mb-12 max-w-[560px] text-center">
          <span className="font-script text-[22px] text-wine">Na hora de pagar</span>
          <h2 className="m-0 mt-1.5 font-serif text-[clamp(26px,2.8vw,36px)] leading-[1.15] font-normal text-ink">
            Do jeito que for melhor pra você
          </h2>
        </Reveal>
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-3">
          {PAGAMENTOS.map((p, i) => (
            <Reveal
              key={p.title}
              delay={i * 100}
              className={
                p.destaque
                  ? "flex flex-col gap-3.5 rounded-[20px] bg-[linear-gradient(160deg,#8E3B6B,#6b2c50)] p-7 text-white"
                  : "flex flex-col gap-3.5 rounded-[20px] border border-blush-2 bg-white p-7"
              }
            >
              <span
                className={
                  p.destaque
                    ? "flex h-11 w-11 items-center justify-center rounded-full bg-white/16"
                    : "flex h-11 w-11 items-center justify-center rounded-full bg-blush text-wine"
                }
              >
                <p.icon className="h-[19px] w-[19px]" strokeWidth={1.6} />
              </span>
              <h3 className={`m-0 font-serif text-[17px] font-normal ${p.destaque ? "text-white" : "text-ink"}`}>
                {p.title}
              </h3>
              <p className={`m-0 text-[13px] leading-relaxed ${p.destaque ? "text-white/85" : "text-ink-soft"}`}>
                {p.desc}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      <TrustBar />

      {/* Banner fotográfico de fechamento */}
      <section className="relative overflow-hidden">
        <div className="relative h-[340px]">
          <img src={fotoCTA} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(92,42,70,0.82)_0%,rgba(92,42,70,0.5)_55%,rgba(92,42,70,0.15)_100%)]" />
          <div className="relative flex h-full max-w-[560px] flex-col justify-center gap-4 px-6 sm:px-16 lg:px-24">
            <span className="font-script text-[24px] text-blush-2">Pronta pra começar?</span>
            <h2 className="m-0 font-serif text-[clamp(26px,3vw,38px)] leading-[1.1] font-normal text-white">
              Sua peça começa no clique de comprar
            </h2>
            <Link
              to="/categoria/colecoes/todos"
              className="group mt-1.5 flex w-fit items-center gap-2.5 rounded-full bg-white px-7 py-3.5 font-serif text-[13.5px] font-semibold tracking-[0.16em] text-wine-dark uppercase transition-colors hover:bg-blush-2"
            >
              Ver coleções
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
