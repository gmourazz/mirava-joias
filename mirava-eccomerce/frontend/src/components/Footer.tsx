import { AtSign, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import Monogram from "./Monogram";
import { FOOTER_COLS } from "../data/content";
import { LOJA } from "../config/loja";

// Onde cada texto do rodapé leva. Fica separado de FOOTER_COLS de propósito:
// aquele array é copy da marca, isto aqui é estrutura de rota — mexer no
// texto do link não deveria arriscar quebrar a URL, e vice-versa.
const FOOTER_ROUTES: Record<string, string> = {
  "Sobre a Mirava": "/sobre",
  "Como comprar": "/como-comprar",
  "Prazos de entrega": "/prazos-de-entrega",
  "Fale conosco": "/fale-conosco",
  "Guia de tamanhos": "/guia-de-tamanhos",
  "Cuidados com a peça": "/cuidados",
};

export default function Footer() {
  return (
    <>
      <footer className="grid grid-cols-1 gap-9 bg-wine-dark px-6 pt-[72px] pb-9 text-white sm:px-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-24">
        <div className="flex flex-col gap-3.5">
          <Monogram className="h-10 w-[54px]" color="#FDCAE1" />
          <span className="font-serif text-[23px] font-medium tracking-[0.22em] text-white uppercase">Mirava</span>
          <p className="m-0 max-w-[280px] text-[13.5px] leading-relaxed text-blush/72">
            Joias que contam histórias: prata 925 e banho de ouro, feitos sob medida pra você.
          </p>
          <div className="flex gap-3.5">
            <a href="https://instagram.com/miravajoias" target="_blank" rel="noreferrer" aria-label="Instagram">
              <AtSign className="h-[18px] w-[18px] cursor-pointer text-white transition-colors hover:text-blush-2" strokeWidth={1.6} />
            </a>
            <a href={`mailto:${LOJA.email}`} aria-label="E-mail">
              <MessageCircle className="h-[18px] w-[18px] cursor-pointer text-white transition-colors hover:text-blush-2" strokeWidth={1.6} />
            </a>
          </div>
        </div>
        {FOOTER_COLS.map((col) => (
          <div key={col.title} className="flex flex-col gap-2.5">
            <span className="mb-1 text-[10px] tracking-[0.18em] text-blush-2 uppercase">{col.title}</span>
            {col.links.map((l) => {
              const to = FOOTER_ROUTES[l];
              if (to) {
                return (
                  <Link key={l} to={to} className="text-[13.5px] text-blush/78 transition-colors duration-300 hover:text-blush-2">
                    {l}
                  </Link>
                );
              }
              // "Contato": e-mail e @instagram viram link direto em vez de rota interna.
              const href = l.includes("@") && l.includes(".")
                ? `mailto:${l}`
                : l.startsWith("@")
                  ? `https://instagram.com/${l.slice(1)}`
                  : undefined;
              return href ? (
                <a
                  key={l}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noreferrer" : undefined}
                  className="text-[13.5px] text-blush/78 transition-colors duration-300 hover:text-blush-2"
                >
                  {l}
                </a>
              ) : (
                <span key={l} className="text-[13.5px] text-blush/78">{l}</span>
              );
            })}
          </div>
        ))}
      </footer>
      <div className="border-t border-blush/16 bg-wine-dark px-5 py-5 text-center text-[11.5px] text-blush/55">
        © 2026 Mirava · Todas as peças são feitas sob encomenda
      </div>
    </>
  );
}
