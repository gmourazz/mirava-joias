// Consultas de catálogo no Supabase.
//
// Só LEITURA. Nada aqui escreve — pedido e pagamento passam pela API Go, que
// é quem decide preço. O RLS já restringe a `publicado = true`, mas o filtro
// vai explícito na query também: contar só com a policy é frágil, e ver o
// filtro no código deixa a intenção clara para quem ler depois.

import { supabase } from "../lib/supabase";
import type { Categoria, Metal, Produto, Variante } from "./tipos";

/** Colunas pedidas em toda consulta de produto. Uma constante evita que as
 *  telas divirjam sobre o que buscam. */
const CAMPOS = `
  id, slug, nome, descricao, preco_centavos, categoria, metal,
  imagens, destaque,
  fornecedor_produtos ( disponivel ),
  produto_variantes ( id, tamanho, ajuste_preco_centavos, disponivel )
`;

interface LinhaProduto {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  preco_centavos: number;
  categoria: Categoria;
  metal: Metal;
  imagens: string[] | null;
  destaque: boolean;
  fornecedor_produtos: { disponivel: boolean } | null;
  produto_variantes: Array<{
    id: string;
    tamanho: string;
    ajuste_preco_centavos: number;
    disponivel: boolean;
  }> | null;
}

function paraProduto(linha: LinhaProduto): Produto {
  const variantes: Variante[] = (linha.produto_variantes ?? [])
    .map((v) => ({
      id: v.id,
      tamanho: v.tamanho,
      ajustePrecoCentavos: v.ajuste_preco_centavos,
      disponivel: v.disponivel,
    }))
    // ordem natural de tamanho: "14" antes de "16", "40cm" antes de "45cm"
    .sort((a, b) =>
      a.tamanho.localeCompare(b.tamanho, "pt-BR", { numeric: true }),
    );

  return {
    id: linha.id,
    slug: linha.slug,
    nome: linha.nome,
    descricao: linha.descricao,
    precoCentavos: linha.preco_centavos,
    categoria: linha.categoria,
    metal: linha.metal,
    imagens: linha.imagens ?? [],
    destaque: linha.destaque,
    // Sem vínculo com a fornecedora, assume disponível: é produto que a dona
    // cadastrou à mão, então a disponibilidade é decisão dela.
    disponivel: linha.fornecedor_produtos?.disponivel ?? true,
    variantes,
  };
}

export interface FiltroProdutos {
  categoria?: Categoria;
  metal?: Metal;
  destaque?: boolean;
  busca?: string;
  limite?: number;
}

export async function listarProdutos(filtro: FiltroProdutos = {}): Promise<Produto[]> {
  let q = supabase
    .from("produtos")
    .select(CAMPOS)
    .eq("publicado", true);

  if (filtro.categoria) q = q.eq("categoria", filtro.categoria);
  if (filtro.metal) q = q.eq("metal", filtro.metal);
  if (filtro.destaque) q = q.eq("destaque", true);
  if (filtro.busca?.trim()) q = q.ilike("nome", `%${filtro.busca.trim()}%`);

  // Teto sempre presente: sem limite, uma categoria grande arrastaria o
  // catálogo inteiro para o navegador da cliente.
  q = q.order("criado_em", { ascending: false }).limit(filtro.limite ?? 48);

  const { data, error } = await q;
  if (error) throw new Error(`Não consegui carregar as peças: ${error.message}`);

  return (data as unknown as LinhaProduto[]).map(paraProduto);
}

export async function produtoPorSlug(slug: string): Promise<Produto | null> {
  const { data, error } = await supabase
    .from("produtos")
    .select(CAMPOS)
    .eq("slug", slug)
    .eq("publicado", true)
    .maybeSingle();

  if (error) throw new Error(`Não consegui carregar a peça: ${error.message}`);
  if (!data) return null;

  return paraProduto(data as unknown as LinhaProduto);
}

/** Peças relacionadas para o fim da página de produto. */
export async function relacionados(p: Produto, quantidade = 4): Promise<Produto[]> {
  const { data, error } = await supabase
    .from("produtos")
    .select(CAMPOS)
    .eq("publicado", true)
    .eq("categoria", p.categoria)
    .neq("id", p.id)
    .limit(quantidade);

  if (error) return []; // seção secundária: falhar calado é melhor que quebrar a página
  return (data as unknown as LinhaProduto[]).map(paraProduto);
}

/** Quantas peças publicadas existem por categoria — alimenta os contadores. */
export async function contarPorCategoria(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("produtos")
    .select("categoria")
    .eq("publicado", true);

  if (error || !data) return {};

  return data.reduce<Record<string, number>>((acc, { categoria }) => {
    acc[categoria as string] = (acc[categoria as string] ?? 0) + 1;
    return acc;
  }, {});
}

/**
 * URL pública de uma imagem no Storage.
 *
 * O banco guarda o caminho (`produtos/PL46/1.webp`), não a URL completa —
 * assim, trocar de bucket ou de CDN não exige reescrever o catálogo inteiro.
 */
export function urlImagem(caminho: string | undefined): string | null {
  if (!caminho) return null;
  if (caminho.startsWith("http")) return caminho; // já é URL completa
  return supabase.storage.from("produtos").getPublicUrl(caminho).data.publicUrl;
}
