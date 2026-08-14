import { AtSign, MessageCircle } from "lucide-react";
import Monogram from "./Monogram";
import { FOOTER_COLS } from "../data/content";

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
            <AtSign className="h-[18px] w-[18px] cursor-pointer text-white" strokeWidth={1.6} />
            <MessageCircle className="h-[18px] w-[18px] cursor-pointer text-white" strokeWidth={1.6} />
          </div>
        </div>
        {FOOTER_COLS.map((col) => (
          <div key={col.title} className="flex flex-col gap-2.5">
            <span className="mb-1 text-[10px] tracking-[0.18em] text-blush-2 uppercase">{col.title}</span>
            {col.links.map((l) => (
              <span key={l} className="cursor-pointer text-[13.5px] text-blush/78 transition-colors duration-300 hover:text-blush-2">
                {l}
              </span>
            ))}
          </div>
        ))}
      </footer>
      <div className="border-t border-blush/16 bg-wine-dark px-5 py-5 text-center text-[11.5px] text-blush/55">
        © 2026 Mirava · Todas as peças são feitas sob encomenda
      </div>
    </>
  );
}
