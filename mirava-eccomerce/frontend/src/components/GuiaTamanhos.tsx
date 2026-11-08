// Guia de tamanhos (design v5: link ao lado do seletor de tamanho). A tabela
// é a numeração brasileira de aro, em que o número é a circunferência do dedo
// em milímetros menos 40. A medida de cada peça da Lilly está na descrição.

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Ruler, X } from "lucide-react";

const AROS = Array.from({ length: 15 }, (_, i) => 10 + i);

export default function GuiaTamanhos({ fechar }: { fechar: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fechar]);

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[rgba(11,74,77,0.35)] p-4" onClick={fechar}>
      <div
        role="dialog"
        aria-label="Guia de tamanhos"
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-in grid max-h-[90vh] w-full max-w-[560px] gap-5 overflow-y-auto rounded-3xl bg-white p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="m-0 flex items-center gap-2 font-serif text-[28px] font-normal text-teal-dark">
            <Ruler size={22} strokeWidth={1.6} className="text-teal" /> Guia de tamanhos
          </h2>
          <button type="button" aria-label="Fechar" onClick={fechar} className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-none bg-chip text-text">
            <X size={18} />
          </button>
        </div>

        <section className="grid gap-2 text-[14px] leading-[1.7] text-text-2">
          <h3 className="m-0 text-[15px] font-semibold text-text">Anéis</h3>
          <p className="m-0">
            Passe uma fita métrica (ou um barbante) em volta do dedo, na base, sem apertar. Marque onde a ponta encontra
            e meça em milímetros. Outra forma: meça por dentro, de lado a lado, um anel que já sirva em você: esse é o
            diâmetro.
          </p>
          <p className="m-0">
            Entre dois números, escolha o maior. Os anéis reguláveis indicam na descrição a faixa de aros que cobrem.
          </p>
          <div className="overflow-hidden rounded-[18px] border border-line">
            <table className="w-full border-collapse text-center text-[13.5px]">
              <thead className="bg-mist text-[12px] tracking-[0.06em] text-teal-dark uppercase">
                <tr>
                  <th className="py-2 font-semibold">Aro</th>
                  <th className="py-2 font-semibold">Circunferência</th>
                  <th className="py-2 font-semibold">Diâmetro</th>
                </tr>
              </thead>
              <tbody>
                {AROS.map((a) => (
                  <tr key={a} className="border-t border-line">
                    <td className="py-1.5 font-semibold text-text">{a}</td>
                    <td className="py-1.5">{a + 40} mm</td>
                    <td className="py-1.5">{((a + 40) / Math.PI).toFixed(1).replace(".", ",")} mm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-2 text-[14px] leading-[1.7] text-text-2">
          <h3 className="m-0 text-[15px] font-semibold text-text">Colares e pulseiras</h3>
          <p className="m-0">
            A maioria acompanha extensor. As medidas mais comuns são 45 + 5 cm e 60 + 5 cm nos colares; a medida exata de
            cada peça está na descrição.
          </p>
        </section>
      </div>
    </div>,
    document.body,
  );
}
