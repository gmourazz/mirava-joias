// Botão flutuante de atendimento, no formato do v5 (círculo teal com anel
// pulsando). O protótipo usa WhatsApp, mas a Mirava atende por e-mail: um
// clique abre o e-mail da pessoa já endereçado para a loja, com assunto
// preenchido.

import { Mail } from "lucide-react";
import { LOJA } from "../config/loja";

export default function BotaoContato() {
  return (
    <a
      href={`mailto:${LOJA.email}?subject=${encodeURIComponent("Dúvida sobre as peças")}`}
      aria-label="Tirar uma dúvida por e-mail"
      className="fixed right-[22px] bottom-[22px] z-50 grid h-[60px] w-[60px] place-items-center rounded-full bg-teal text-white shadow-[0_12px_30px_rgba(8,57,60,0.3)] transition-colors hover:bg-teal-dark hover:text-white"
    >
      <span aria-hidden className="animate-pulse-ring absolute inset-0 rounded-full bg-teal" />
      <Mail size={26} strokeWidth={1.6} className="relative" />
    </a>
  );
}
