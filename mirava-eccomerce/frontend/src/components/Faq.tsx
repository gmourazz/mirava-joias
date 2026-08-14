import { useState } from "react";
import { FAQ } from "../data/content";

export default function Faq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="grid grid-cols-1 items-start gap-9 border-t border-blush-2 px-6 py-[92px] sm:px-16 md:grid-cols-[0.8fr_1.2fr] lg:px-24">
      <div className="flex flex-col gap-3.5">
        <span className="font-sans text-[10.5px] font-semibold tracking-[0.26em] text-wine uppercase">Antes de comprar</span>
        <h2 className="m-0 font-serif text-[clamp(28px,3vw,38px)] leading-[1.14] font-normal">Perguntas que sempre chegam</h2>
        <p className="m-0 max-w-[300px] text-[13.5px] leading-relaxed text-ink-soft">Se a sua não estiver aqui, o WhatsApp está sempre aberto.</p>
      </div>
      <div className="flex flex-col">
        {FAQ.map((item, i) => (
          <div key={item.q} className="border-b border-blush-2">
            <button
              type="button"
              onClick={() => setOpen((o) => (o === i ? null : i))}
              className="flex w-full cursor-pointer items-center justify-between gap-5 border-none bg-none py-[22px] text-left"
            >
              <span className="font-sans text-sm font-medium text-ink">{item.q}</span>
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-rose text-[15px] text-wine">
                {open === i ? "−" : "+"}
              </span>
            </button>
            {open === i && (
              <p className="reveal in-view m-0 mb-6 max-w-[620px] text-[13.5px] leading-loose text-ink-soft">{item.a}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
