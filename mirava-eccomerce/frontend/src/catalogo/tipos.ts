// Tipos do catálogo, espelhando as tabelas `produtos` e `produto_variantes`.
//
// Convenções que vêm do banco e não devem ser "melhoradas" aqui:
//   • preço é SEMPRE integer em centavos, nunca float
//   • categoria e metal são minúsculos, iguais aos CHECK constraints do SQL
//   • imagens são caminhos no Supabase Storage, não URLs da fornecedora

export type Categoria =
  | "aneis" | "colares" | "pulseiras" | "berloques"
  | "brincos" | "conjuntos" | "outros";

export type Metal = "prata" | "ouro";

export interface Variante {
  id: string;
  tamanho: string;
  ajustePrecoCentavos: number;
  disponivel: boolean;
}

export interface Produto {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  precoCentavos: number;
  categoria: Categoria;
  metal: Metal;
  imagens: string[];
  destaque: boolean;
  /** Disponibilidade na fornecedora. A Lilly não publica quantidade,
   *  só se dá ou não para comprar — por isso booleano, não número. */
  disponivel: boolean;
  variantes: Variante[];
}

export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  aneis: "Anéis",
  colares: "Colares",
  pulseiras: "Pulseiras",
  berloques: "Berloques",
  brincos: "Brincos",
  conjuntos: "Conjuntos",
  outros: "Outros",
};

export const ROTULO_METAL: Record<Metal, string> = {
  prata: "Prata",
  ouro: "Banhado a ouro",
};

/** As categorias que aparecem na navegação, na ordem desejada. */
export const CATEGORIAS_MENU: Categoria[] = [
  "aneis", "colares", "pulseiras", "berloques", "brincos",
];
