import heroA from "../assets/images/hero-a.webp";
import heroArgolas from "../assets/images/hero-argolas.webp";
import heroBerloques from "../assets/images/hero-berloques.webp";
import catAneis from "../assets/images/cat-aneis.webp";
import catColares from "../assets/images/cat-colares.webp";
import catPulseiras from "../assets/images/cat-pulseiras.webp";
import catBerloques from "../assets/images/cat-berloques.webp";
import jw1 from "../assets/images/jw1.webp";
import cartItem from "../assets/images/cart-item.webp";

const POOL: Record<string, string> = {
  "hero-a": heroA,
  "hero-argolas": heroArgolas,
  "hero-berloques": heroBerloques,
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
