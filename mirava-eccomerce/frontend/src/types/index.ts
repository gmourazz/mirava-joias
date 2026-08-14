export type Metal = "Prata" | "Ouro";
export type CategoryKey = "aneis" | "colares" | "pulseiras" | "berloques";
export type MenuKey = "prata" | "ouro" | "colecoes";
export type FilterKey = "todos" | CategoryKey;

export interface Product {
  name: string;
  metal: Metal;
  price: string;
  installments: string;
  pix: string;
  reviews: number;
  sizes: string[];
  cat: CategoryKey;
  seed: string;
}

export interface Category {
  key: CategoryKey;
  label: string;
}

export interface MenuInfo {
  label: string;
  title: string;
  script: string;
  text: string;
  asideTitle: string;
  aside: string[];
}
