import bannerColarCoracao from "../assets/banner/banner-colar-coracao.webp";
import bannerColarVerde from "../assets/banner/banner-colar-verde.webp";
import bannerTrevo from "../assets/banner/banner-trevo.webp";
import bannerAneis from "../assets/banner/banner-aneis.webp";
import catAneis from "../assets/images/cat-aneis.webp";
import catColares from "../assets/images/cat-colares.webp";
import catPulseiras from "../assets/images/cat-pulseiras.webp";
import catBerloques from "../assets/images/cat-berloques.webp";
import jw1 from "../assets/images/jw1.webp";
import cartItem from "../assets/images/cart-item.webp";

const POOL: Record<string, string> = {
  "banner-colar-coracao": bannerColarCoracao,
  "banner-colar-verde": bannerColarVerde,
  "banner-trevo": bannerTrevo,
  "banner-aneis": bannerAneis,
  "cat-aneis": catAneis,
  "cat-colares": catColares,
  "cat-pulseiras": catPulseiras,
  "cat-berloques": catBerloques,
  jw1,
  "cart-item": cartItem,
};

export function img(seed: string): string {
  return POOL[seed] || POOL["jw1"];
}
