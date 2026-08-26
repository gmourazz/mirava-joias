import { useEffect, useState } from "react";
import { CheckCircle2, PackageCheck, Sparkles, Truck } from "lucide-react";
import PageHero from "../components/PageHero";
import Reveal from "../components/Reveal";
import { imageUrl } from "../catalogo/consultas";
import { useShowcaseProducts } from "../catalogo/hooks";
import { img } from "../lib/images";
import { LOJA } from "../config/loja";
import { freeShippingAbove } from "../lib/frete";
import { formatarBRL } from "../lib/dinheiro";

const ETAPAS = [
  {
    icon: CheckCircle2,
    title: "Pagamento confirmado",
    desc: "Assim que o Pix ou o cartão são aprovados, seu pedido já entra na fila de produção.",
  },
  {
    icon: Sparkles,
    title: "Peça preparada",
    desc: "Cada peça é conferida e preparada com cuidado, é sob encomenda, não sai de prateleira.",
  },
  {
    icon: PackageCheck,
    title: "Envio com rastreio",
    desc: "Assim que despachamos, você recebe o código de rastreio por e-mail.",
  },
  {
    icon: Truck,
    title: "Entrega na sua porta",
    desc: "Acompanhe o status a qualquer momento direto na sua conta, em Meus Pedidos.",
  },
];

export default function PrazosEntrega() {
  const [freteGratisCents, setFreteGratisCents] = useState<number | null>(null);
  const showcase = useShowcaseProducts(2);
  const fotoFaixa = (imageUrl(showcase[0]?.images[0]) ?? undefined) || img("hero-b");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    freeShippingAbove().then(setFreteGratisCents);
  }, []);

  return (
    <div>
      <PageHero icon={Truck} kicker="Do pedido até você" title="Prazos de entrega">
        Da confirmação do pagamento até a sua porta, em{" "}
        {LOJA.prazo.minDiasUteis} a {LOJA.prazo.maxDiasUteis} dias úteis.
      </PageHero>

      {/* Faixa fotográfica com o prazo total */}
      <section className="relative overflow-hidden">
        <div className="relative h-[280px] sm:h-[320px]">
          <img src={fotoFaixa} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(92,42,70,0.72)_0%,rgba(92,42,70,0.58)_100%)]" />
          <div className="relative flex h-full flex-col items-center justify-center gap-2.5 px-6 text-center">
            <span className="font-script text-[20px] text-blush-2">Prazo total</span>
            <span className="font-serif text-[clamp(38px,5.5vw,64px)] leading-none text-white">
              {LOJA.prazo.minDiasUteis} a {LOJA.prazo.maxDiasUteis} dias úteis
            </span>
            {freteGratisCents !== null && freteGratisCents > 0 && (
              <span className="mt-2 rounded-full border border-white/40 px-4 py-1.5 text-[11px] tracking-[0.16em] text-white/90 uppercase">
                Frete grátis acima de {formatarBRL(freteGratisCents)}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Timeline vertical */}
      <section className="px-6 py-[92px] sm:px-16 lg:px-24">
        <div className="relative mx-auto max-w-[640px]">
          <span className="absolute top-2 bottom-2 left-[26px] w-px bg-[linear-gradient(180deg,#F0BFD3_0%,#D46A9F_50%,#F0BFD3_100%)]" />
          <div className="flex flex-col gap-12">
            {ETAPAS.map((e, i) => (
              <Reveal key={e.title} delay={i * 110} className="relative flex gap-6">
                <span className="relative z-10 flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full bg-paper text-wine ring-2 ring-rose/60">
                  <e.icon className="h-[21px] w-[21px]" strokeWidth={1.6} />
                </span>
                <div className="pt-2.5">
                  <span className="block text-[10px] tracking-[0.18em] text-mauve uppercase">
                    Etapa {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="m-0 mt-1 font-serif text-[18px] leading-tight font-normal text-ink">
                    {e.title}
                  </h3>
                  <p className="m-0 mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-ink-soft">
                    {e.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
