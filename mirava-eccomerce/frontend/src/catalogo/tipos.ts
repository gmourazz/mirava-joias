// Tipos do catálogo, espelhando a tabela `products` do banco.
//
// Convenções que vêm do banco e não devem ser "melhoradas" aqui:
//   • preço é SEMPRE integer em centavos, nunca float
//   • category e metal são os valores do CHECK constraint em português —
//     são slugs de conteúdo/URL/asset (rota, chave de imagem em
//     lib/images.ts), não identificadores de código. Trocar para inglês
//     quebraria as imagens do catálogo sem trazer benefício real.

export type Category =
  | "aneis" | "colares" | "pulseiras" | "berloques"
  | "brincos" | "conjuntos" | "outros";

export type Metal = "prata" | "ouro";

export interface Variant {
  id: string;
  size: string;
  priceAdjustCents: number;
  available: boolean;
}

/** Avaliação copiada da própria página da Lilly — nome, data e comentário
 *  (quando a cliente escreveu; muita gente só dá a nota, sem comentar). */
export interface Review {
  author: string;
  date: string;
  text: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  category: Category;
  metal: Metal;
  images: string[];
  featured: boolean;
  /** Disponibilidade na fornecedora. A Lilly não publica quantidade,
   *  só se dá ou não para comprar — por isso booleano, não número. */
  available: boolean;
  variants: Variant[];
  /** Como chamar o grupo de opção desta peça: "Tamanho", "Letras". Null
   *  quando a peça não tem escolha nenhuma. */
  variantLabel: string | null;
  rating: number | null;
  ratingCount: number;
  reviews: Review[];
}

export const CATEGORY_LABEL: Record<Category, string> = {
  aneis: "Anéis",
  colares: "Colares",
  pulseiras: "Pulseiras",
  berloques: "Berloques",
  brincos: "Brincos",
  conjuntos: "Conjuntos",
  outros: "Outros",
};

export const METAL_LABEL: Record<Metal, string> = {
  prata: "Prata",
  ouro: "Banhado a ouro",
};

/** As categorias que aparecem na navegação, na ordem desejada. */
export const MENU_CATEGORIES: Category[] = [
  "aneis", "colares", "pulseiras", "berloques", "brincos",
];
