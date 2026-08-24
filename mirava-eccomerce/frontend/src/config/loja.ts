// As decisões da loja que você vai querer mudar sem caçar pelo código.
//
// Regra: se é algo que a dona muda de ideia (prazo, parcelas, se exige conta),
// mora aqui. Se é regra de negócio que mexe com dinheiro (markup, quando o
// lote fecha), mora no backend — o front não pode ser fonte da verdade disso.

export const LOJA = {
  /**
   * Exigir login antes de finalizar a compra.
   *
   * Hoje true, por escolha da dona. Exigir cadastro antes de pagar costuma
   * custar conversão, e o custo cai na primeira compra — a mais difícil de
   * conseguir. Por isso é uma flag: `pedidos.user_id` é anulável no banco e o
   * checkout consulta este valor, então voltar atrás é uma linha, não uma
   * migração.
   */
  contaObrigatoriaParaComprar: true,

  /**
   * Parcelas sem juros absorvidas pela Mirava.
   *
   * Numa peça de R$69 com R$37 de lucro: 3x custa +R$1,05 (3% do lucro),
   * mas 12x custaria +R$5,18 (14%). Três é o ponto onde ainda vale a pena.
   */
  parcelasSemJuros: 3,

  /** Prazo prometido, contado a partir da confirmação do pagamento. */
  prazo: { minDiasUteis: 10, maxDiasUteis: 20 },

  // Frete NÃO mora aqui. Preço de entrega é dinheiro, e dinheiro é decidido no
  // servidor: a tabela está em api/internal/dominio/frete.go e o front pergunta
  // por GET /frete. Ver lib/frete.ts.

  /** URL da API Go. Em produção, aponta para o Cloud Run. */
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8080",

  /** Canal de atendimento. É o único contato publicado no site. */
  email: "miravajoias@gmail.com",
} as const;
