// Faixa de avisos do design v5: esteira contínua em teal, texto branco,
// avisos separados por ✦. A lista vai duas vezes e o trilho anda -50%, então
// o loop nunca "pula". Pausa no hover. Não é sticky: quem gruda no topo é o
// header.
//
// Os textos vêm do painel (Vitrine → avisos do topo). Enquanto a API não
// responde, ou se não houver aviso ativo, ficam os de data/content.ts.

import { Fragment, useEffect, useState } from "react";
import { CreditCard, Gem, Gift, QrCode, RefreshCw, ShieldCheck, Sparkles, Truck, type LucideIcon } from "lucide-react";
import { ANNOUNCEMENTS } from "../data/content";
import { announcements } from "../lib/extras";

// Os avisos são texto livre do painel, então o ícone sai do assunto do aviso.
// A ordem importa: "Pix ou cartão" casa com Pix antes de cartão.
const ICONES: [RegExp, LucideIcon][] = [
  [/frete|entrega|envio/i, Truck],
  [/parcel|sem juros/i, CreditCard],
  [/pix/i, QrCode],
  [/seguro|segura|protegid/i, ShieldCheck],
  [/troca|devolu/i, RefreshCw],
  [/presente|embrulho/i, Gift],
  [/encomenda|joia|banh/i, Gem],
  [/cart[aã]o|pagamento/i, CreditCard],
];
const iconeDoAviso = (t: string): LucideIcon => ICONES.find(([re]) => re.test(t))?.[1] ?? Sparkles;

export default function AnnouncementBar() {
  const [avisos, setAvisos] = useState<{ text: string }[]>([...ANNOUNCEMENTS]);
  useEffect(() => {
    announcements()
      .then((list) => {
        if (list && list.length > 0) setAvisos(list);
      })
      .catch(() => {});
  }, []);
  const track = [...avisos, ...avisos, ...avisos, ...avisos];

  return (
    <div className="esteira flex h-[38px] items-center overflow-hidden bg-teal text-[13px] font-medium text-white">
      <div className="esteira-trilho flex w-max items-center gap-7 whitespace-nowrap" style={{ animationDuration: "38s" }}>
        {track.map((msg, i) => {
          const Icone = iconeDoAviso(msg.text);
          return (
            <Fragment key={i}>
              <span className="flex items-center gap-2 px-7">
                <Icone size={15} strokeWidth={1.8} aria-hidden className="shrink-0 text-[#CFEAE7]" />
                {msg.text}
              </span>
              <span aria-hidden className="text-[#CFEAE7]">✦</span>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
