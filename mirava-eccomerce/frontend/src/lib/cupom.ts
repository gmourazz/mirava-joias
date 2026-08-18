// Cupom de boas-vindas (10%, código único, uma vez por conta).
//
// Esta chamada é só uma prévia para o resumo do carrinho — o desconto que
// realmente vale é recalculado dentro de /checkout, a partir do banco. Nunca
// confie no discount_cents daqui para nada além de mostrar na tela.

import { api } from "./api";

export interface CouponResult {
  valid: boolean;
  discount_cents?: number;
  error?: string;
}

export function validateCoupon(code: string, subtotalCents: number): Promise<CouponResult> {
  return api<CouponResult>("/cupom/validar", {
    method: "POST",
    authenticated: true,
    body: { code, subtotal_cents: subtotalCents },
  });
}
