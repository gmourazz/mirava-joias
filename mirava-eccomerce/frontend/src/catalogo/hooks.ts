// Hooks de catálogo.
//
// Três estados sempre, nunca dois: carregando, erro e dado. Tratar erro como
// "lista vazia" faz a cliente ver "nenhuma peça encontrada" quando na verdade
// a internet dela caiu — e ela vai embora achando que a loja está vazia.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listarProdutos, produtoPorSlug, relacionados,
  type FiltroProdutos,
} from "./consultas";
import type { Produto } from "./tipos";

interface Estado<T> {
  dado: T;
  carregando: boolean;
  erro: string | null;
}

export function useProdutos(filtro: FiltroProdutos = {}) {
  const [estado, setEstado] = useState<Estado<Produto[]>>({
    dado: [], carregando: true, erro: null,
  });

  // Serializa o filtro para comparar por valor. Sem isto, um objeto novo a
  // cada render dispararia busca infinita.
  const chave = JSON.stringify(filtro);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    setEstado((e) => ({ ...e, carregando: true, erro: null }));

    listarProdutos(JSON.parse(chave) as FiltroProdutos)
      .then((dado) => ativo && setEstado({ dado, carregando: false, erro: null }))
      .catch((e: Error) =>
        ativo && setEstado({ dado: [], carregando: false, erro: e.message }),
      );

    // Evita gravar resposta de uma busca antiga por cima da nova quando a
    // cliente troca de categoria rápido.
    return () => { ativo = false; };
  }, [chave, tentativa]);

  const tentarDeNovo = useCallback(() => setTentativa((n) => n + 1), []);
  return { ...estado, tentarDeNovo };
}

export function useProduto(slug: string | undefined) {
  const [estado, setEstado] = useState<Estado<Produto | null>>({
    dado: null, carregando: true, erro: null,
  });
  const [similares, setSimilares] = useState<Produto[]>([]);
  const ultimoSlug = useRef<string>();

  useEffect(() => {
    if (!slug) {
      setEstado({ dado: null, carregando: false, erro: null });
      return;
    }
    let ativo = true;
    ultimoSlug.current = slug;
    setEstado({ dado: null, carregando: true, erro: null });
    setSimilares([]);

    produtoPorSlug(slug)
      .then(async (dado) => {
        if (!ativo) return;
        setEstado({ dado, carregando: false, erro: null });
        if (dado) {
          const s = await relacionados(dado);
          if (ativo && ultimoSlug.current === slug) setSimilares(s);
        }
      })
      .catch((e: Error) =>
        ativo && setEstado({ dado: null, carregando: false, erro: e.message }),
      );

    return () => { ativo = false; };
  }, [slug]);

  return { ...estado, similares };
}
