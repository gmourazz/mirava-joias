import { useNavigate } from "react-router-dom";
import { LINES } from "../data/content";
import { img } from "../lib/images";
import Reveal from "./Reveal";

export default function LinesSection() {
  const navigate = useNavigate();

  return (
    <section className="grid grid-cols-1 gap-6 px-6 pb-[92px] sm:px-16 md:grid-cols-2 lg:px-24">
      {LINES.map((ln, i) => (
        <Reveal key={ln.seed} delay={i * 120} className="zoom-on-hover relative flex min-h-[380px] items-end overflow-hidden rounded-[18px]">
          <img src={img(ln.seed)} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(92,42,70,0)_20%,rgba(92,42,70,0.5)_52%,rgba(92,42,70,0.86)_100%)]" />
          <div className="relative flex flex-col gap-3 p-[34px]">
            <span className="text-[10px] font-semibold tracking-[0.24em] text-white uppercase">{ln.kicker}</span>
            <h3 className="m-0 font-serif text-[30px] font-normal text-white">{ln.title}</h3>
            <p className="m-0 max-w-[340px] text-[13.5px] leading-relaxed text-white/95">{ln.text}</p>
            <button
              type="button"
              onClick={() => navigate(`/categoria/${ln.menuKey}/todos`)}
              className="mt-2 self-start rounded-full border border-white/50 bg-white/14 px-6 py-3 font-serif text-[13px] font-semibold tracking-[0.2em] text-white uppercase cursor-pointer hover:bg-white/22"
            >
              {ln.cta}
            </button>
          </div>
        </Reveal>
      ))}
    </section>
  );
}
