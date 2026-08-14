// Textos da navegação por linha (prata, ouro, coleções).
//
// Isto é copy da marca, não dado de produto — por isso saiu de `products.ts`,
// que foi eliminado quando o catálogo passou a vir do Supabase.

export type MenuKey = "prata" | "ouro" | "colecoes";

export interface MenuInfo {
  label: string;
  title: string;
  script: string;
  text: string;
}

export const MENUS: Record<MenuKey, MenuInfo> = {
  prata: {
    label: "Prata 925",
    title: "Banhadas a prata, sob encomenda",
    script: "Prata viva",
    text: "Peças com banho de prata e acabamento hipoalergênico, encomendadas uma a uma depois do seu pedido.",
  },
  ouro: {
    label: "Banhado a Ouro",
    title: "Banhadas a ouro, sob encomenda",
    script: "Dourado",
    text: "Banho de ouro sobre peça hipoalergênica, com verniz protetor.",
  },
  colecoes: {
    label: "Coleções",
    title: "Todas as peças",
    script: "Enlace",
    text: "O catálogo completo da Mirava, em prata e em ouro.",
  },
};
