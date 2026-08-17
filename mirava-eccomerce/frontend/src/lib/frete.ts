// Frete — sempre perguntado à API Go, nunca calculado aqui.
//
// A tentação é óbvia: a tabela é pequena, daria pra copiar num objeto TypeScript
// e evitar uma requisição. Não faça. O checkout recalcula o frete no servidor
// antes de cobrar; uma cópia no front só criaria um segundo número para
// divergir do primeiro — que é exatamente o problema que a auditoria encontrou
// com as parcelas e o desconto do PIX.

import { api } from "./api";

export type ShippingService = "economico" | "sedex";

export interface ShippingOption {
  service: ShippingService;
  label: string;
  cents: number;
  free: boolean;
  min_days: number;
  max_days: number;
}

export interface ShippingQuote {
  free_above_cents: number;
  options: ShippingOption[] | null;
}

/** Cotação para um estado e um subtotal. Sem `uf`, devolve só a regra do
 *  frete grátis — que é o que a barra do carrinho precisa. */
export function quoteShipping(uf: string, subtotalCents: number): Promise<ShippingQuote> {
  const params = new URLSearchParams();
  if (uf) params.set("uf", uf);
  params.set("subtotal_cents", String(subtotalCents));
  return api<ShippingQuote>(`/frete?${params}`);
}

/** O limite do frete grátis, buscado uma vez só por sessão.
 *
 *  A barra do carrinho pergunta isso a cada abertura; sem o cache seria uma
 *  requisição por clique, para um número que não muda. */
let regrasCache: Promise<number> | null = null;

export function freeShippingAbove(): Promise<number> {
  if (!regrasCache) {
    regrasCache = quoteShipping("", 0)
      .then((q) => q.free_above_cents)
      .catch(() => {
        // API fora do ar: devolve 0 e a barra some. Melhor não mostrar meta
        // nenhuma do que mostrar uma inventada.
        regrasCache = null;
        return 0;
      });
  }
  return regrasCache;
}

/** "Grátis" ou "R$ 26,90" — o texto que vai na opção. */
export function shippingPrazo(o: ShippingOption): string {
  return o.min_days === o.max_days
    ? `${o.max_days} dias úteis`
    : `${o.min_days} a ${o.max_days} dias úteis`;
}
