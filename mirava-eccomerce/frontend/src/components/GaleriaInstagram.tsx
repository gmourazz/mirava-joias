// "Inspire-se no Instagram" (design v5). As fotos são as que a dona envia no
// painel (Banners e avisos → galeria) — foto real da loja, não banco de
// imagem. Sem foto cadastrada, a seção some.

import { useEffect, useState } from "react";
import { AtSign } from "lucide-react";
import { imageUrl } from "../catalogo/consultas";
import { gallery, type GalleryImage } from "../lib/extras";
import { LOJA } from "../config/loja";
import SectionHeading from "./SectionHeading";

export default function GaleriaInstagram() {
  const [fotos, setFotos] = useState<GalleryImage[]>([]);
  useEffect(() => {
    gallery().then(setFotos).catch(() => {});
  }, []);
  if (fotos.length === 0) return null;

  const perfil = `https://www.instagram.com/${LOJA.instagram.replace("@", "")}`;
  return (
    <section className="mx-auto max-w-[1360px] px-[clamp(16px,3vw,40px)] pt-20">
      <SectionHeading
        eyebrow={LOJA.instagram}
        title={<>Inspire-se no <em>Instagram</em></>}
        align="center"
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {fotos.map((f, i) => {
          const src = imageUrl(f.image);
          const link = f.link || perfil;
          const externo = link.startsWith("http");
          return (
            <a
              key={f.id ?? i}
              href={link}
              {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="group relative block aspect-square overflow-hidden rounded-[20px] bg-mist-3"
            >
              {src && <img src={src} alt={f.caption ?? ""} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
              <span className="absolute inset-0 grid place-items-center bg-teal-dark/0 text-white opacity-0 transition-[opacity,background] group-hover:bg-teal-dark/40 group-hover:opacity-100">
                <AtSign size={22} />
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
