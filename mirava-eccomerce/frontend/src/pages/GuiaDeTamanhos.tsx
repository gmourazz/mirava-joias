import { useEffect } from "react";
import { Mail, Ruler } from "lucide-react";
import PageHero from "../components/PageHero";
import Reveal from "../components/Reveal";
import { imageUrl } from "../catalogo/consultas";
import { useShowcaseProducts } from "../catalogo/hooks";
import { img } from "../lib/images";
import { LOJA } from "../config/loja";

const AROS = [
  { aro: "14", mm: "44,2" },
  { aro: "15", mm: "45,5" },
  { aro: "16", mm: "46,8" },
  { aro: "17", mm: "48,0" },
  { aro: "18", mm: "49,3" },
  { aro: "19", mm: "50,6" },
  { aro: "20", mm: "51,9" },
  { aro: "22", mm: "54,4" },
  { aro: "24", mm: "56,9" },
];

const COLARES = [
  { nome: "Choker", cm: "35 a 40 cm", desc: "roça no pescoço, bem justinho" },
  { nome: "Princesa", cm: "42 a 48 cm", desc: "cai na base do colo — o comprimento mais usado" },
  { nome: "Matinê", cm: "50 a 60 cm", desc: "desce um pouco abaixo do colo" },
  { nome: "Longo", cm: "70 cm ou mais", desc: "para usar solto ou dobrado em volta" },
];

const PULSEIRAS = [
  { tam: "P", cm: "15 a 16 cm" },
  { tam: "M", cm: "17 a 18 cm" },
  { tam: "G", cm: "19 a 20 cm" },
];

export default function GuiaDeTamanhos() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const showcase = useShowcaseProducts(1);
  const foto = (imageUrl(showcase[0]?.images[0]) ?? undefined) || img("jw5");

  return (
    <div>
      <PageHero icon={Ruler} kicker="Para acertar de primeira" title="Guia de tamanhos">
        Cada página de produto mostra os tamanhos disponíveis daquela peça —
        este guia é pra você descobrir qual é o seu.
      </PageHero>

      <section className="px-6 py-[92px] sm:px-16 lg:px-24">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-16 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-16">
            {/* Anéis */}
            <Reveal>
              <span className="font-sans text-[10.5px] font-semibold tracking-[0.26em] text-wine uppercase">
                Anéis
              </span>
              <h2 className="m-0 mt-2 font-serif text-[24px] font-normal text-ink">Descubra seu aro</h2>
              <p className="m-0 mt-2.5 max-w-[520px] text-[13.5px] leading-relaxed text-ink-soft">
                Meça um anel que já fica bom no dedo (a circunferência
                interna, não o diâmetro) com uma fita métrica ou um
                barbante — depois é só comparar com a numeração de aro
                abaixo, padrão usado por joalherias no Brasil.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
                {AROS.map((a) => (
                  <div
                    key={a.aro}
                    className="flex flex-col items-center gap-1 rounded-[14px] border border-blush-2 bg-white py-4 transition-colors hover:border-rose"
                  >
                    <span className="font-serif text-[22px] leading-none text-wine">{a.aro}</span>
                    <span className="text-[10.5px] text-ink-soft">{a.mm} mm</span>
                  </div>
                ))}
              </div>
            </Reveal>

            {/* Colares */}
            <Reveal delay={100}>
              <span className="font-sans text-[10.5px] font-semibold tracking-[0.26em] text-wine uppercase">
                Colares e correntes
              </span>
              <h2 className="m-0 mt-2 font-serif text-[24px] font-normal text-ink">Onde a peça cai no colo</h2>
              <div className="mt-6 flex flex-col gap-2.5">
                {COLARES.map((c) => (
                  <div
                    key={c.nome}
                    className="flex items-center justify-between gap-4 rounded-[14px] border border-blush-2 bg-white px-5 py-4"
                  >
                    <div>
                      <span className="block font-serif text-[15.5px] text-ink">{c.nome}</span>
                      <span className="text-[12px] text-ink-soft">{c.desc}</span>
                    </div>
                    <span className="shrink-0 rounded-full bg-cream px-3.5 py-1.5 text-[12px] font-medium text-wine">
                      {c.cm}
                    </span>
                  </div>
                ))}
              </div>
            </Reveal>

            {/* Pulseiras */}
            <Reveal delay={180}>
              <span className="font-sans text-[10.5px] font-semibold tracking-[0.26em] text-wine uppercase">
                Pulseiras
              </span>
              <h2 className="m-0 mt-2 font-serif text-[24px] font-normal text-ink">Com folga de 1 a 2 cm</h2>
              <p className="m-0 mt-2.5 max-w-[480px] text-[13.5px] leading-relaxed text-ink-soft">
                Meça o pulso com fita métrica e some a folga — é essa medida
                final que indica o tamanho:
              </p>
              <div className="mt-6 flex flex-wrap gap-3.5">
                {PULSEIRAS.map((p) => (
                  <div key={p.tam} className="flex items-center gap-3 rounded-full border border-blush-2 bg-white py-2.5 pr-5 pl-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-wine font-serif text-[14px] text-white">
                      {p.tam}
                    </span>
                    <span className="text-[13px] text-ink-soft">{p.cm}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Coluna lateral: foto + ajuda */}
          <div className="flex flex-col gap-6">
            <Reveal delay={80} className="relative overflow-hidden rounded-[20px]">
              <img src={foto} alt="" className="aspect-[4/5] w-full object-cover" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(92,42,70,0.55)_100%)]" />
              <span className="absolute right-4 bottom-4 left-4 font-serif text-[15px] leading-tight text-white">
                Sem régua? Um barbante e uma fita métrica resolvem.
              </span>
            </Reveal>

            <Reveal
              delay={160}
              className="flex flex-col items-center gap-3 rounded-[20px] border border-blush-2 bg-cream/50 p-7 text-center"
            >
              <p className="m-0 text-[13.5px] leading-relaxed text-ink-soft">
                Ainda ficou com dúvida do seu tamanho?
              </p>
              <a
                href={`mailto:${LOJA.email}?subject=${encodeURIComponent("Dúvida sobre tamanho")}`}
                className="flex items-center gap-2.5 rounded-full bg-wine px-6 py-3 font-serif text-[12.5px] font-semibold tracking-[0.12em] text-white uppercase transition-colors hover:bg-wine-dark"
              >
                <Mail className="h-3.5 w-3.5" strokeWidth={1.7} />
                Pedir ajuda
              </a>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
