// Formatação de dinheiro para exibição.
//
// O front NUNCA calcula preço de venda — isso é decisão do servidor (a API Go
// e o banco). O que existe aqui é só apresentação: pegar os centavos que
// vieram do banco e transformar em texto para a cliente ler.
//
// Por isso tudo aqui recebe `centavos: number` inteiro. Se você se pegar
// escrevendo lógica de markup ou desconto neste arquivo, ela está no lugar
// errado — o lugar é `api/internal/dominio/precificacao.go`.

import { LOJA } from "../config/loja";

export function formatarBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** "3x de R$ 23,00 sem juros" */
export function textoParcelas(centavos: number): string {
  const n = LOJA.parcelasSemJuros;
  if (centavos <= 0 || n <= 1) return "";
  return `${n}x de ${formatarBRL(Math.round(centavos / n))} sem juros`;
}

/** Se existe desconto no Pix. Com 0 na config, as telas não mencionam. */
export const temDescontoPix = LOJA.descontoPixPct > 0;

/** Valor com o desconto do Pix aplicado. */
export function precoPix(centavos: number): number {
  return Math.round(centavos * (1 - LOJA.descontoPixPct / 100));
}

/** "5% off no PIX · R$ 65,55" */
export function textoPix(centavos: number): string {
  return `${LOJA.descontoPixPct}% off no PIX · ${formatarBRL(precoPix(centavos))}`;
}

/** "até 20 dias úteis" — o prazo prometido, num lugar só. */
export function textoPrazo(): string {
  return `até ${LOJA.prazo.maxDiasUteis} dias úteis`;
}
