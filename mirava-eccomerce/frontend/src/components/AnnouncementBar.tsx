// Faixa de avisos do design v5: esteira contínua em teal, texto branco,
// avisos separados por ✦. A lista vai duas vezes e o trilho anda -50%, então
// o loop nunca "pula". Pausa no hover. Não é sticky: quem gruda no topo é o
// header.

import { Fragment } from "react";
import { ANNOUNCEMENTS } from "../data/content";

export default function AnnouncementBar() {
  const track = [...ANNOUNCEMENTS, ...ANNOUNCEMENTS, ...ANNOUNCEMENTS, ...ANNOUNCEMENTS];

  return (
    <div className="esteira flex h-[38px] items-center overflow-hidden bg-teal text-[13px] font-medium text-white">
      <div className="esteira-trilho flex w-max items-center gap-7 whitespace-nowrap" style={{ animationDuration: "38s" }}>
        {track.map((msg, i) => (
          <Fragment key={i}>
            <span className="px-7">{msg.text}</span>
            <span aria-hidden className="text-[#CFEAE7]">✦</span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
