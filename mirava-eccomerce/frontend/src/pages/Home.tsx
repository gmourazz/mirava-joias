import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Hero from "../components/Hero";
import Beneficios from "../components/Beneficios";
import CategoryGrid from "../components/CategoryGrid";
import MaisVendidos from "../components/MaisVendidos";
import SignificadoAneis from "../components/SignificadoAneis";
import QuizBrilho from "../components/QuizBrilho";
import CompraSegura from "../components/CompraSegura";
import AjudaSection from "../components/AjudaSection";
import Faq from "../components/Faq";
import Reveal from "../components/Reveal";
import QuemUsaAma from "../components/QuemUsaAma";
import GaleriaInstagram from "../components/GaleriaInstagram";
import { NovidadesSecao } from "../components/Novidades";

// Home do design v5 (Mirava Site v5.dc.html, decisão 19), na mesma
// ordem do protótipo. Avaliações e Instagram só aparecem com dado real
// (avaliação aprovada, foto enviada pelo painel — decisão 28); a seção de
// novidades dá o BEMVINDA10 (decisão 34). O FAQ aqui mostra só as primeiras
// perguntas e leva à página completa.
export default function Home() {
  const { hash, key } = useLocation();

  // Links "/#duvidas" apontam para a âncora nesta página. useNavigate não
  // rola sozinho até o #id — fazemos na mão.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [hash, key]);

  return (
    <div>
      <Hero />
      <Beneficios />
      <CategoryGrid />
      <MaisVendidos />
      <Reveal><SignificadoAneis /></Reveal>
      <Reveal><QuizBrilho /></Reveal>
      <Reveal><CompraSegura /></Reveal>
      <Reveal><QuemUsaAma /></Reveal>
      <Reveal><GaleriaInstagram /></Reveal>
      <Reveal><AjudaSection /></Reveal>
      <Faq />
      <Reveal><NovidadesSecao /></Reveal>
    </div>
  );
}
