// Botão flutuante de atendimento.
//
// Um clique abre o e-mail da pessoa já endereçado para a loja, com assunto
// preenchido. A Mirava não tem WhatsApp: o contato é por e-mail.

import { Mail } from "lucide-react";
import { LOJA } from "../config/loja";

export default function BotaoContato() {
  return (
    <a
      href={`mailto:${LOJA.email}?subject=${encodeURIComponent("Dúvida sobre as peças")}`}
      className="fixed right-6 bottom-6 z-50 flex items-center gap-2.5 rounded-full border-none bg-plum px-5 py-3.5 font-serif text-[15px] text-blush shadow-[0_12px_30px_-16px_rgba(92,42,70,0.45)] transition-colors hover:bg-wine-dark"
    >
      <Mail className="pointer-events-none flex h-[17px] w-[17px]" strokeWidth={1.6} />
      Tirar uma dúvida
    </a>
  );
}
