import Hero from "../components/Hero";
import OrderBand from "../components/OrderBand";
import CategoryGrid from "../components/CategoryGrid";
import LinesSection from "../components/LinesSection";
import HowItWorks from "../components/HowItWorks";
import ProductCarousel from "../components/ProductCarousel";
import EngravingSection from "../components/EngravingSection";
import Faq from "../components/Faq";
import InstagramGrid from "../components/InstagramGrid";
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
      <EngravingSection />
      {/* Seção de depoimentos removida até existirem avaliações reais.
          O componente segue em components/Testimonials.tsx para quando
          vierem do banco. */}
      <Faq />
      <InstagramGrid />
      <TrustBar />
    </div>
  );
}
