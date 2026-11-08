// "Cada dedo, uma mensagem": foto da mão com um número em cada dedo e, ao lado,
// o que cada um transmite. Passar o mouse (ou tocar) num dedo ou numa linha
// destaca os dois.

import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { img } from "../lib/images";
import SectionHeading from "./SectionHeading";

// x e y: posição do número na foto, em %.
const DEDOS = [
  { nome: "Dedinho", palavras: "Saúde e conexão", frase: "Para quem cuida de si e dos seus vínculos.", x: 26, y: 31 },
  { nome: "Anelar", palavras: "Relacionamento, desejo e amor", frase: "O dedo dos afetos e dos compromissos.", x: 38.5, y: 15 },
  { nome: "Médio", palavras: "Responsabilidade e amor próprio", frase: "Equilíbrio e um lembrete de se colocar em primeiro lugar.", x: 48.5, y: 10 },
  { nome: "Indicador", palavras: "Autoestima, liderança e proteção", frase: "De quem confia em si e toma a frente.", x: 60.5, y: 14 },
  { nome: "Polegar", palavras: "Força, estilo e criatividade", frase: "O mais ousado: personalidade à primeira vista.", x: 81, y: 49 },
];

export default function SignificadoAneis() {
  const [ativo, setAtivo] = useState(2);

  return (
    <section className="mx-auto max-w-[1360px] px-[clamp(16px,3vw,40px)] pt-20">
      <div className="grid grid-cols-1 items-center gap-[clamp(24px,4vw,56px)] rounded-[36px] bg-mist-3 p-[clamp(16px,2.5vw,32px)] lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-[26px]">
          <img src={img("significado-aneis")} alt="Mão usando um anel em cada dedo" loading="lazy" className="block aspect-square w-full object-cover" />
          {DEDOS.map((d, i) => (
            <button
              key={d.nome}
              type="button"
              aria-label={`${d.nome}: ${d.palavras}`}
              aria-pressed={ativo === i}
              onMouseEnter={() => setAtivo(i)}
              onFocus={() => setAtivo(i)}
              onClick={() => setAtivo(i)}
              style={{ left: `${d.x}%`, top: `${d.y}%` }}
              className={`absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-none text-[13px] font-bold shadow-[0_4px_14px_rgba(7,40,40,0.25)] transition-[background-color,color,transform] duration-200 ${
                ativo === i ? "scale-110 bg-teal text-white" : "bg-white text-teal-dark"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:pr-8">
          <SectionHeading
            eyebrow="Significado dos anéis"
            title={<>Cada dedo, uma <em>mensagem</em></>}
            description="O dedo que você escolhe também conta um pouco de você."
          />
          <ul className="-mt-3 m-0 grid list-none gap-2 p-0">
            {DEDOS.map((d, i) => (
              <li key={d.nome}>
                <button
                  type="button"
                  aria-pressed={ativo === i}
                  onMouseEnter={() => setAtivo(i)}
                  onFocus={() => setAtivo(i)}
                  onClick={() => setAtivo(i)}
                  className={`flex w-full cursor-pointer items-center gap-4 rounded-[18px] border-[1.5px] bg-white px-4 py-3 text-left transition-colors duration-200 ${
                    ativo === i ? "border-teal" : "border-transparent"
                  }`}
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px] font-bold transition-colors duration-200 ${
                      ativo === i ? "bg-teal text-white" : "bg-[#CFEAE7] text-teal-dark"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="grid gap-0.5">
                    <span className="text-[15px] font-semibold text-text">{d.nome}</span>
                    <span className="text-[13.5px] text-text-2">{d.palavras}</span>
                    {ativo === i && <span className="text-[13px] text-muted">{d.frase}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              to="/categoria/colecoes/aneis"
              className="flex w-fit items-center gap-2.5 rounded-full bg-teal px-7 py-4 text-[14px] font-semibold text-white hover:bg-teal-dark hover:text-white"
            >
              Ver anéis
              <ArrowRight size={15} strokeWidth={1.8} />
            </Link>
            <span className="text-[13px] text-muted">Sem regra: use do jeito que combinar com você.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
