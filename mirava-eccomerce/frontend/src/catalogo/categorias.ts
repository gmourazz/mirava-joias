// Categorias da loja, editáveis no painel (rótulo, ordem e markup). A lista
// vem de GET /categorias uma vez por visita; enquanto não chega, valem as de
// fábrica de tipos.ts — o menu nunca aparece vazio.

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { CATEGORY_LABEL, MENU_CATEGORIES } from "./tipos";

export interface CategoriaLoja {
  slug: string;
  label: string;
  count: number;
}

const RESERVA: CategoriaLoja[] = MENU_CATEGORIES.map((slug) => ({ slug, label: CATEGORY_LABEL[slug] ?? slug, count: 1 }));

let cache: CategoriaLoja[] | null = null;
let pedido: Promise<CategoriaLoja[]> | null = null;

function carregar(): Promise<CategoriaLoja[]> {
  pedido ??= api<CategoriaLoja[]>("/categorias")
    .then((list) => {
      cache = list;
      return list;
    })
    .catch(() => {
      pedido = null;
      return RESERVA;
    });
  return pedido;
}

/** Categorias com peça publicada, na ordem do menu. */
export function useCategorias(): CategoriaLoja[] {
  const [list, setList] = useState<CategoriaLoja[]>(cache ?? RESERVA);
  useEffect(() => {
    let atual = true;
    void carregar().then((l) => atual && setList(l));
    return () => {
      atual = false;
    };
  }, []);
  return list.filter((c) => c.count > 0);
}

/** Rótulo de uma categoria pelo slug (banco, senão o de fábrica). */
export function rotuloCategoria(slug: string): string {
  return cache?.find((c) => c.slug === slug)?.label ?? CATEGORY_LABEL[slug] ?? slug;
}
