import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Hero from "../components/Hero";
import OrderBand from "../components/OrderBand";
import CategoryGrid from "../components/CategoryGrid";
import LinesSection from "../components/LinesSection";
import HowItWorks from "../components/HowItWorks";
import ProductCarousel from "../components/ProductCarousel";
import Testimonials from "../components/Testimonials";
import Faq from "../components/Faq";
import MaisVendidos from "../components/MaisVendidos";
import TrustBar from "../components/TrustBar";

export default function Home() {
  const location = useLocation();

  // Chegando de outra página com "/#feedbacks" (ver Header.tsx): a seção só
  // renderiza depois que /avaliacoes responde, então tenta rolar por um
  // tempo em vez de uma vez só — sem isso, quem vem de fora do site nunca
  // rola de verdade porque o elemento ainda não existe no primeiro frame.
  useEffect(() => {
    if (location.hash !== "#feedbacks") return;
    const id = location.hash.slice(1);
    let tentativas = 0;
    const intervalo = setInterval(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        clearInterval(intervalo);
      } else if (++tentativas > 20) {
        clearInterval(intervalo);
      }
    }, 100);
    return () => clearInterval(intervalo);
  }, [location]);

  return (
    <div>
      <Hero />
      <OrderBand />
      <CategoryGrid />
      <LinesSection />
      <HowItWorks />
      <ProductCarousel />
      {/* Seção de gravação removida da vitrine: prometia "grave o que você
          não quer esquecer, sem custo extra", e a Lilly não faz gravação por
          texto livre — o que ela oferece é escolha de letra pronta. O
          componente continua em components/EngravingSection.tsx para o dia em
          que existir alguém que grave de verdade. */}
      <Testimonials />
      <MaisVendidos />
      <Faq />
      <TrustBar />
    </div>
  );
}
