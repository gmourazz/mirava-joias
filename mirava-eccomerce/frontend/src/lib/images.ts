import av1 from "../assets/images/av1.webp";
import av2 from "../assets/images/av2.webp";
import av3 from "../assets/images/av3.webp";
import av4 from "../assets/images/av4.webp";
import av5 from "../assets/images/av5.webp";
import av6 from "../assets/images/av6.webp";
import heroA from "../assets/images/hero-a.webp";
import heroB from "../assets/images/hero-b.webp";
import heroC from "../assets/images/hero-c.webp";
import catAneis from "../assets/images/cat-aneis.webp";
import catColares from "../assets/images/cat-colares.webp";
import catPulseiras from "../assets/images/cat-pulseiras.webp";
import catBerloques from "../assets/images/cat-berloques.webp";
import jw1 from "../assets/images/jw1.webp";
import jw2 from "../assets/images/jw2.webp";
import jw3 from "../assets/images/jw3.webp";
import jw4 from "../assets/images/jw4.webp";
import jw5 from "../assets/images/jw5.webp";
import jw6 from "../assets/images/jw6.webp";
import jw7 from "../assets/images/jw7.webp";
import jw8 from "../assets/images/jw8.webp";
import menuPrata from "../assets/images/menu-prata.webp";
import menuOuro from "../assets/images/menu-ouro.webp";
import menuColecoes from "../assets/images/menu-colecoes.webp";
import bannerPrata from "../assets/images/banner-prata.webp";
import bannerOuro from "../assets/images/banner-ouro.webp";
import bannerColecoes from "../assets/images/banner-colecoes.webp";
import cartItem from "../assets/images/cart-item.webp";
import cartSuggest from "../assets/images/cart-suggest.webp";

const POOL: Record<string, string> = {
  av1,
  av2,
  av3,
  av4,
  av5,
  av6,
  "hero-a": heroA,
  "hero-b": heroB,
  "hero-c": heroC,
  "cat-aneis": catAneis,
  "cat-colares": catColares,
  "cat-pulseiras": catPulseiras,
  "cat-berloques": catBerloques,
  jw1,
  jw2,
  jw3,
  jw4,
  jw5,
  jw6,
  jw7,
  jw8,
  "menu-prata": menuPrata,
  "menu-ouro": menuOuro,
  "menu-colecoes": menuColecoes,
  "banner-prata": bannerPrata,
  "banner-ouro": bannerOuro,
  "banner-colecoes": bannerColecoes,
  "cart-item": cartItem,
  "cart-suggest": cartSuggest,
};

export function img(seed: string): string {
  return POOL[seed] || POOL["jw1"];
}
