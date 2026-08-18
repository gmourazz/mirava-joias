import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Clock, Mail, MessageCircle } from "lucide-react";
import PageHero from "../components/PageHero";
import Reveal from "../components/Reveal";
import Faq from "../components/Faq";
import { imageUrl } from "../catalogo/consultas";
import { useShowcaseProducts } from "../catalogo/hooks";
import { img } from "../lib/images";
import { LOJA } from "../config/loja";

export default function FaleConosco() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const showcase = useShowcaseProducts(2);
  const foto = (imageUrl(showcase[0]?.images[0]) ?? undefined) || img("jw4");

  return (
    <div>
      <PageHero icon={MessageCircle} kicker="Estamos por aqui" title="Fale conosco">
        Dúvida sobre uma peça, um pedido ou uma troca? A resposta sai da
        nossa equipe, sempre por e-mail.
      </PageHero>

      <section className="px-6 py-[92px] sm:px-16 lg:px-24">
        <div className="mx-auto grid max-w-5xl grid-cols-1 overflow-hidden rounded-[26px] shadow-[0_36px_70px_-36px_rgba(142,59,107,0.45)] md:grid-cols-[0.9fr_1.1fr]">
          <Reveal className="relative hidden min-h-[380px] md:block">
            <img src={foto} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(92,42,70,0.05)_0%,rgba(92,42,70,0.55)_100%)]" />
            <div className="absolute right-0 bottom-0 left-0 p-8">
              <span className="font-script text-[20px] text-blush-2">Uma dúvida rápida</span>
              <p className="m-0 mt-1 font-serif text-[19px] leading-tight text-white">
                já pode fazer toda diferença na escolha certa
              </p>
            </div>
          </Reveal>

          <Reveal delay={120} className="flex flex-col gap-6 bg-white p-8 sm:p-11">
            <div className="flex items-center gap-2 text-[11px] tracking-[0.16em] text-wine uppercase">
              <Clock className="h-3.5 w-3.5" strokeWidth={1.8} />
              Respondemos em até 1 dia útil
            </div>
            <div>
              <h2 className="m-0 font-serif text-[24px] font-normal text-ink">Escreva pra gente</h2>
              <p className="m-0 mt-2.5 text-[13.5px] leading-relaxed text-ink-soft">
                Se for sobre um pedido já feito, inclua o número dele — assim
                a gente resolve mais rápido. Pra troca ou devolução, veja
                antes o que precisamos em{" "}
                <Link to="/cuidados" className="text-wine underline">cuidados com a peça</Link>.
              </p>
            </div>
            <a
              href={`mailto:${LOJA.email}?subject=${encodeURIComponent("Dúvida sobre as peças")}`}
              className="flex w-fit items-center gap-2.5 rounded-full bg-wine px-8 py-3.5 font-serif text-[13.5px] font-semibold tracking-[0.14em] text-white uppercase transition-colors hover:bg-wine-dark"
            >
              <Mail className="h-4 w-4" strokeWidth={1.7} />
              Escrever e-mail
            </a>
            <span className="text-[12.5px] text-mauve">{LOJA.email}</span>
          </Reveal>
        </div>
      </section>

      <Faq />
    </div>
  );
}
