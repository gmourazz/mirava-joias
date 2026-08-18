// Hooks de catálogo.
//
// Três estados sempre, nunca dois: carregando, erro e dado. Tratar erro como
// "lista vazia" faz a cliente ver "nenhuma peça encontrada" quando na verdade
// a internet dela caiu — e ela vai embora achando que a loja está vazia.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listProducts, productBySlug, relatedProducts,
  type ProductFilter,
} from "./consultas";
import type { Metal, Product } from "./tipos";

interface State<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

export function useProducts(filter: ProductFilter = {}) {
  const [state, setState] = useState<State<Product[]>>({
    data: [], loading: true, error: null,
  });

  // Serializa o filtro para comparar por valor. Sem isto, um objeto novo a
  // cada render dispararia busca infinita.
  const key = JSON.stringify(filter);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    listProducts(JSON.parse(key) as ProductFilter)
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((e: Error) =>
        active && setState({ data: [], loading: false, error: e.message }),
      );

    // Evita gravar resposta de uma busca antiga por cima da nova quando a
    // cliente troca de categoria rápido.
    return () => { active = false; };
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

// Cache simples em módulo: o menu abre e fecha várias vezes na mesma
// sessão, e a lista de peças por metal não muda a ponto de justificar
// buscar de novo toda hora — só na primeira vez que cada aba é aberta.
const menuPreviewCache = new Map<string, Product[]>();

/**
 * Peças reais pra enriquecer o dropdown do menu (prata/ouro) com foto de
 * categoria de verdade, em vez de arte estática — mais rico e sempre
 * atualizado com o catálogo. Só busca quando o menu está aberto.
 */
export function useMenuPreview(metal: Metal | "all" | null) {
  const cacheKey = metal ?? "";
  const [products, setProducts] = useState<Product[]>(() =>
    metal ? (menuPreviewCache.get(cacheKey) ?? []) : [],
  );

  useEffect(() => {
    if (!metal) return;
    const cached = menuPreviewCache.get(cacheKey);
    if (cached) {
      setProducts(cached);
      return;
    }
    let active = true;
    listProducts({ metal: metal === "all" ? undefined : metal, limit: 60 })
      .then((data) => {
        menuPreviewCache.set(cacheKey, data);
        if (active) setProducts(data);
      })
      .catch(() => {
        // dropdown cai pro visual estático — não é motivo pra quebrar o menu
      });
    return () => { active = false; };
  }, [metal, cacheKey]);

  return products;
}

// Cache em módulo — as páginas institucionais (Sobre, Cuidados...) usam foto
// real de peça como pano de fundo editorial; não precisa buscar de novo toda
// vez que a pessoa navega entre elas na mesma sessão.
let showcaseCache: Product[] | null = null;

/** Peças reais para compor páginas editoriais com foto de verdade em vez de
 *  arte estática — mesma ideia do useMenuPreview, para fora do menu. */
export function useShowcaseProducts(count = 8) {
  const [products, setProducts] = useState<Product[]>(showcaseCache ?? []);

  useEffect(() => {
    if (showcaseCache) return;
    let active = true;
    listProducts({ limit: count })
      .then((data) => {
        showcaseCache = data;
        if (active) setProducts(data);
      })
      .catch(() => {
        // página cai no visual estático — não é motivo pra quebrar nada
      });
    return () => { active = false; };
  }, [count]);

  return products;
}

export function useProduct(slug: string | undefined) {
  const [state, setState] = useState<State<Product | null>>({
    data: null, loading: true, error: null,
  });
  const [related, setRelated] = useState<Product[]>([]);
  const lastSlug = useRef<string>(undefined);

  useEffect(() => {
    if (!slug) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let active = true;
    lastSlug.current = slug;
    setState({ data: null, loading: true, error: null });
    setRelated([]);

    productBySlug(slug)
      .then(async (data) => {
        if (!active) return;
        setState({ data, loading: false, error: null });
        if (data) {
          const r = await relatedProducts(data);
          if (active && lastSlug.current === slug) setRelated(r);
        }
      })
      .catch((e: Error) =>
        active && setState({ data: null, loading: false, error: e.message }),
      );

    return () => { active = false; };
  }, [slug]);

  return { ...state, related };
}
