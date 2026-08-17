import Hero from "../components/Hero";
import OrderBand from "../components/OrderBand";
import CategoryGrid from "../components/CategoryGrid";
import LinesSection from "../components/LinesSection";
import HowItWorks from "../components/HowItWorks";
import ProductCarousel from "../components/ProductCarousel";
import Faq from "../components/Faq";
import MaisVendidos from "../components/MaisVendidos";
import TrustBar from "../components/TrustBar";

export default function Home() {
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
      {/* Seção de depoimentos removida até existirem avaliações reais.
          O componente segue em components/Testimonials.tsx para quando
          vierem do banco. */}
      <MaisVendidos />
      <Faq />
      <TrustBar />
    </div>
  );
}
