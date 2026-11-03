// Faixa de benefícios logo abaixo do hero (v5): cinco cartões com ícone num
// círculo teal-claro. Só promessas que a loja cumpre.

import { CreditCard, Mail, Percent, QrCode, ShieldCheck, Truck } from "lucide-react";
import { LOJA } from "../config/loja";

const ITENS = [
  LOJA.descontoPixPct > 0
    ? { Icon: Percent, title: `${LOJA.descontoPixPct}% de desconto`, desc: "no Pix" }
    : { Icon: QrCode, title: "Pix", desc: "aprovação na hora" },
  { Icon: CreditCard, title: "Parcelamento", desc: `${LOJA.parcelasSemJuros}x sem juros` },
  { Icon: ShieldCheck, title: "Entrega rastreada", desc: "código por e-mail" },
  { Icon: Truck, title: "Frete grátis", desc: "acima de R$ 300" },
  { Icon: Mail, title: "Atendimento", desc: "por e-mail" },
];

export default function Beneficios() {
  return (
    <section className="mx-auto max-w-[1360px] px-[clamp(16px,3vw,40px)] pt-7">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ITENS.map(({ Icon, title, desc }) => (
          <div key={title} className="flex flex-col items-center gap-2.5 rounded-3xl border border-line-soft px-2.5 py-[22px] text-center">
            <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-mist-2 text-teal">
              <Icon size={24} strokeWidth={1.6} />
            </span>
            <span className="text-[14.5px] font-semibold text-text">{title}</span>
            <span className="-mt-1.5 text-[13px] text-muted">{desc}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
