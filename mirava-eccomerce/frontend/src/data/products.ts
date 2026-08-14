import type { Category, MenuInfo, MenuKey, Product } from "../types";

export const CATEGORIES: Category[] = [
  { key: "aneis", label: "Anéis" },
  { key: "colares", label: "Colares" },
  { key: "pulseiras", label: "Pulseiras" },
  { key: "berloques", label: "Berloques" },
];

export const MENUS: Record<MenuKey, MenuInfo> = {
  prata: {
    label: "Prata 925",
    title: "Prata 925 sob encomenda",
    script: "Prata viva",
    text: "Peças em prata 925 maciça, produzidas uma a uma depois do seu pedido.",
    asideTitle: "Por estilo",
    aside: ["Minimalistas", "Com gravação", "Pedras naturais", "Pares e alianças"],
  },
  ouro: {
    label: "Banhado a Ouro",
    title: "Banhado a ouro sob encomenda",
    script: "Dourado",
    text: "Banho de ouro 18k sobre prata, com garantia de 12 meses no acabamento.",
    asideTitle: "Por acabamento",
    aside: ["Ouro polido", "Ouro fosco", "Ouro + zircônias", "Banho grosso 5μ"],
  },
  colecoes: {
    label: "Coleções",
    title: "Coleções autorais",
    script: "Enlace",
    text: "Três famílias de desenho que servem de ponto de partida para a sua peça.",
    asideTitle: "Coleções",
    aside: ["Enlace", "Raiz", "Ponto de luz", "Peças únicas"],
  },
};

export const PRODUCTS: Product[] = [
  { name: "Anel Enlace fino", metal: "Prata", price: "R$ 289,00", installments: "6x de R$ 48,17 sem juros", pix: "5% off no PIX · R$ 274,55", reviews: 42, sizes: ["14", "16", "18"], cat: "aneis", seed: "jw1" },
  { name: "Colar Raiz gravado", metal: "Ouro", price: "R$ 459,00", installments: "6x de R$ 76,50 sem juros", pix: "5% off no PIX · R$ 436,05", reviews: 31, sizes: ["40cm", "45cm"], cat: "colares", seed: "jw2" },
  { name: "Pulseira Elo duplo", metal: "Prata", price: "R$ 329,00", installments: "6x de R$ 54,83 sem juros", pix: "5% off no PIX · R$ 312,55", reviews: 27, sizes: ["16cm", "18cm"], cat: "pulseiras", seed: "jw3" },
  { name: "Berloque Inicial", metal: "Ouro", price: "R$ 159,00", installments: "3x de R$ 53,00 sem juros", pix: "5% off no PIX · R$ 151,05", reviews: 58, sizes: ["Único"], cat: "berloques", seed: "jw4" },
  { name: "Anel Enlace duplo", metal: "Ouro", price: "R$ 379,00", installments: "6x de R$ 63,17 sem juros", pix: "5% off no PIX · R$ 360,05", reviews: 19, sizes: ["14", "16", "18"], cat: "aneis", seed: "jw5" },
  { name: "Colar Ponto de luz", metal: "Prata", price: "R$ 249,00", installments: "6x de R$ 41,50 sem juros", pix: "5% off no PIX · R$ 236,55", reviews: 36, sizes: ["40cm", "45cm"], cat: "colares", seed: "jw6" },
  { name: "Pulseira Riacho", metal: "Prata", price: "R$ 289,00", installments: "6x de R$ 48,17 sem juros", pix: "5% off no PIX · R$ 274,55", reviews: 22, sizes: ["16cm", "18cm"], cat: "pulseiras", seed: "jw7" },
  { name: "Berloque Coração", metal: "Ouro", price: "R$ 179,00", installments: "3x de R$ 59,67 sem juros", pix: "5% off no PIX · R$ 170,05", reviews: 44, sizes: ["Único"], cat: "berloques", seed: "jw8" },
];
