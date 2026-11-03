// Bloco escuro "Qualidade" do v5, com os pilares trocados pelo que a loja
// garante de fato: o protótipo prometia garantia de 6 meses, peças
// hipoalergênicas e verniz protetor, ainda não confirmados com a Lilly.
// "Cuidados com a sua joia" segue o que já está no FAQ.

import { Box, Droplet, Gem, RefreshCw, ShieldCheck, Sparkles, Truck, Waves } from "lucide-react";
import { textoPrazo } from "../lib/dinheiro";
import SectionHeading from "./SectionHeading";

const PILARES = [
  { Icon: Gem, t: "Feita sob encomenda", d: `Encomendada depois do seu pedido e entregue em ${textoPrazo()}` },
  { Icon: RefreshCw, t: "Troca em 7 dias", d: "Direito de arrependimento garantido pelo Código de Defesa do Consumidor" },
  { Icon: ShieldCheck, t: "Pagamento seguro", d: "Pix ou cartão pelo Mercado Pago, sem dado de cartão no nosso site" },
  { Icon: Truck, t: "Entrega rastreada", d: "Código de rastreio por e-mail assim que a peça é enviada" },
];

const CUIDADOS = [
  { Icon: Droplet, t: "Aplique perfume e cremes antes de colocar a joia" },
  { Icon: Waves, t: "Retire para piscina, mar e banho" },
  { Icon: Box, t: "Guarde separada e sequinha" },
  { Icon: Sparkles, t: "Limpe só com flanela macia e seca" },
];

export default function CompraSegura() {
  return (
    <section className="mx-auto max-w-[1360px] px-[clamp(16px,3vw,40px)] pt-20">
      <div className="grid gap-10 rounded-[36px] bg-teal-dark p-[clamp(24px,4vw,56px)] text-white">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <SectionHeading
            tone="light"
            eyebrow="Compra tranquila"
            title="Do pedido à entrega, você acompanha tudo"
            description="A Mirava encomenda a sua peça na hora em que o pagamento é confirmado e te avisa a cada etapa."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PILARES.map(({ Icon, t, d }) => (
              <div key={t} className="grid content-start gap-3 rounded-[22px] bg-white/7 p-5">
                <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-teal">
                  <Icon size={20} strokeWidth={1.6} />
                </span>
                <span className="text-[16px] font-semibold">{t}</span>
                <span className="text-[13.5px] leading-[1.6] text-[#A9CFCB]">{d}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 border-t border-white/12 pt-8">
          <span className="font-serif text-[24px]">Cuidados com a sua joia</span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CUIDADOS.map(({ Icon, t }) => (
              <div key={t} className="flex items-center gap-3 text-[14px] text-[#D6EEEB]">
                <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full border border-white/25">
                  <Icon size={17} strokeWidth={1.6} />
                </span>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
