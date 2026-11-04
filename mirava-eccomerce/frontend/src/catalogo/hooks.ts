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
import type { Product } from "./tipos";

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
