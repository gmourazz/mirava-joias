import { useEffect } from "react";
import { Ban, Bath, Droplets, Moon, Sparkles, Waves } from "lucide-react";
import PageHero from "../components/PageHero";
import Reveal from "../components/Reveal";
import { imageUrl } from "../catalogo/consultas";
import { useShowcaseProducts } from "../catalogo/hooks";
import { img } from "../lib/images";

const DICAS = [
  {
    icon: Moon,
    title: "Tire antes de dormir",
    desc: "O atrito com o travesseiro e os lençóis desgasta o acabamento mais rápido do que o uso do dia a dia.",
  },
  {
    icon: Bath,
    title: "Tire para o banho",
    desc: "Sabonete, xampu e água quente opacam o brilho com o tempo — melhor guardar a peça seca antes de entrar.",
  },
  {
    icon: Waves,
    title: "Tire para o mar e a piscina",
    desc: "Sal e cloro são especialmente agressivos com banho de ouro e podem acelerar o desgaste.",
  },
  {
    icon: Droplets,
    title: "Perfume e hidratante por último",
    desc: "Aplique tudo antes de colocar a joia — o álcool e os óleos desses produtos são os maiores vilões do brilho.",
  },
  {
    icon: Ban,
    title: "Longe de produtos de limpeza",
    desc: "Álcool, cloro e outros produtos de limpeza reagem com o banho e podem manchar a peça.",
  },
  {
    icon: Sparkles,
    title: "Um pano seco de vez em quando",
    desc: "Passe um pano macio e seco (sem produto) para devolver o brilho entre um uso e outro.",
  },
];

export default function Cuidados() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const showcase = useShowcaseProducts(1);
  const foto = (imageUrl(showcase[0]?.images[0]) ?? undefined) || img("jw7");

  return (
    <div>
      <PageHero icon={Sparkles} kicker="Pra durar" title="Cuidados com a peça">
        Prata 925 e banho de ouro pedem pouco cuidado — o suficiente pra
        manter o brilho por muito mais tempo.
      </PageHero>

      <section className="px-6 py-[92px] sm:px-16 lg:px-24">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <Reveal className="lg:sticky lg:top-24 lg:self-start">
            <div className="relative overflow-hidden rounded-[22px] shadow-[0_30px_60px_-30px_rgba(142,59,107,0.4)]">
              <img src={foto} alt="" className="aspect-[4/5] w-full object-cover" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(92,42,70,0.6)_100%)]" />
              <p className="absolute right-6 bottom-6 left-6 m-0 font-serif text-[19px] leading-snug text-white">
                Seis hábitos simples que fazem o brilho durar muito mais.
              </p>
            </div>
          </Reveal>

          <div className="flex flex-col">
            {DICAS.map((d, i) => (
              <Reveal
                key={d.title}
                delay={i * 80}
                className={`flex items-start gap-5 py-6 ${i !== 0 ? "border-t border-blush-2" : ""}`}
              >
                <span
                  className="shrink-0 font-serif text-[36px] leading-none text-transparent"
                  style={{ WebkitTextStroke: "1px #E9A9C6" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-1 items-start gap-4">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream text-wine">
                    <d.icon className="h-[17px] w-[17px]" strokeWidth={1.6} />
                  </span>
                  <div>
                    <h3 className="m-0 font-serif text-[16px] leading-tight font-normal text-ink">
                      {d.title}
                    </h3>
                    <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-ink-soft">{d.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal
          delay={200}
          className="mx-auto mt-16 max-w-3xl rounded-[20px] border border-blush-2 bg-cream/50 p-7 text-center"
        >
          <p className="m-0 text-[13.5px] leading-relaxed text-ink-soft">
            Guarde separadas e sequinhas, de preferência num saquinho ou
            caixinha fechada — joias soltas juntas se arranham entre si.
          </p>
        </Reveal>
      </section>
    </div>
  );
}
