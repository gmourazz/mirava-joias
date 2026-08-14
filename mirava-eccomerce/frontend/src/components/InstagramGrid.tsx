import { AtSign } from "lucide-react";
import { INSTAGRAM_SEEDS } from "../data/content";
import { img } from "../lib/images";

export default function InstagramGrid() {
  return (
    <section className="bg-cream px-6 py-20 sm:px-16 lg:px-24">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-2">
          <span className="font-script text-[26px] tracking-[0.06em] text-wine">@miravajoias</span>
          <h2 className="m-0 font-serif text-[32px] font-normal">Peças que já saíram daqui</h2>
        </div>
        <button type="button" className="flex items-center gap-2.5 rounded-full border border-rose bg-none px-6 py-3 font-serif text-[13px] font-semibold tracking-[0.2em] text-ink uppercase cursor-pointer hover:bg-paper">
          <AtSign className="flex h-[15px] w-[15px]" strokeWidth={1.6} />
          Seguir
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {INSTAGRAM_SEEDS.map((seed, i) => (
          <div key={`${seed}-${i}`} className="zoom-on-hover relative aspect-square overflow-hidden rounded-xl">
            <img src={img(seed)} alt="" className="block h-full w-full object-cover" />
          </div>
        ))}
      </div>
    </section>
  );
}
