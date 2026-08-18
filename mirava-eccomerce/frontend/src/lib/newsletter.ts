// Inscrição no banner "Bem-vinda" da home.
//
// Só grava o e-mail e dispara o cupom por e-mail — o desconto de verdade só
// existe depois que a pessoa cria conta e digita o código no checkout (ver
// lib/cupom.ts). Isto aqui é captação, não é onde o desconto é validado.

import { api } from "./api";

export function subscribeNewsletter(email: string): Promise<void> {
  return api<{ ok: boolean }>("/newsletter/inscrever", {
    method: "POST",
    body: { email },
  }).then(() => undefined);
}
