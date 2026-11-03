import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Hero from "../components/Hero";
import Beneficios from "../components/Beneficios";
import CategoryGrid from "../components/CategoryGrid";
import MaisVendidos from "../components/MaisVendidos";
import QuizBrilho from "../components/QuizBrilho";
import BerloquesSection from "../components/BerloquesSection";
import CompraSegura from "../components/CompraSegura";
import PresentesSection from "../components/PresentesSection";
import AjudaSection from "../components/AjudaSection";
import Faq from "../components/Faq";
import Reveal from "../components/Reveal";

// Home do design v5 (mirava-novo-design/Mirava Site v5.dc.html), na mesma
// ordem do protótipo. Ficam de fora as seções que dependem de algo que ainda
// não existe: avaliações de clientes e a grade do Instagram (decisão 28) e a
// newsletter, que prometia cupom sem haver cadastro nem cupom no backend.
// O FAQ aqui mostra só as primeiras perguntas e leva à página completa.
export default function Home() {
  const { hash } = useLocation();

  // Links "/#duvidas" apontam para a âncora nesta página. useNavigate não
  // rola sozinho até o #id — fazemos na mão.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  return (
    <div>
      <Hero />
      <Beneficios />
      <CategoryGrid />
      <MaisVendidos />
      <Reveal><QuizBrilho /></Reveal>
      <Reveal><BerloquesSection /></Reveal>
      <Reveal><CompraSegura /></Reveal>
      <Reveal><PresentesSection /></Reveal>
      <Reveal><AjudaSection /></Reveal>
      <Faq />
    </div>
  );
}
