// "Monte a sua pulseira em 3 passos" (v5): foto à esquerda, passos em
// cartões brancos à direita.

import { Link } from "react-router-dom";
import { ArrowRight, Heart, Link2, Truck } from "lucide-react";
import { img } from "../lib/images";
import SectionHeading from "./SectionHeading";

const PASSOS = [
  { Icon: Link2, t: "Escolha a pulseira base", d: "Elos delicados, banhados a prata ou ouro" },
  { Icon: Heart, t: "Adicione seus berloques", d: "Letras, corações e pingentes" },
  { Icon: Truck, t: "Receba em casa", d: "Com código de rastreio por e-mail" },
];

export default function BerloquesSection() {
  return (
    <section className="mx-auto max-w-[1360px] px-[clamp(16px,3vw,40px)] pt-20">
      <div className="grid grid-cols-1 items-center gap-[clamp(24px,4vw,56px)] rounded-[36px] bg-mist-3 p-[clamp(16px,2.5vw,32px)] lg:grid-cols-2">
        <img
          src={img("cat-berloques")}
          alt=""
          loading="lazy"
          className="h-[clamp(340px,36vw,480px)] w-full rounded-[26px] object-cover"
        />
        <div className="grid gap-5 lg:pr-8">
          <SectionHeading eyebrow="Berloques" title={<>Monte a sua pulseira em <em>3 passos</em></>} />
          <div className="-mt-3 grid gap-3">
            {PASSOS.map(({ Icon, t, d }, i) => (
              <div key={t} className="flex items-center gap-4 rounded-[20px] bg-white px-[18px] py-4">
                <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-[#CFEAE7] text-teal-dark">
                  <Icon size={21} strokeWidth={1.6} />
                </span>
                <span className="grid gap-0.5">
                  <span className="text-[15.5px] font-semibold text-text">
                    {i + 1}. {t}
                  </span>
                  <span className="text-[13.5px] text-muted">{d}</span>
                </span>
              </div>
            ))}
          </div>
          <Link
            to="/categoria/colecoes/berloques"
            className="flex w-fit items-center gap-2.5 rounded-full bg-teal px-7 py-4 text-[14px] font-semibold text-white hover:bg-teal-dark hover:text-white"
          >
            Ver berloques
            <ArrowRight size={15} strokeWidth={1.8} />
          </Link>
        </div>
      </div>
    </section>
  );
}
