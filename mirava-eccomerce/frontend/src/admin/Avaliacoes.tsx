// Avaliações e avise-me. Avaliação só existe de quem recebeu a peça, e só vai
// para a loja depois de aprovada aqui (decisão 28: nada inventado no site).

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Star, X } from "lucide-react";
import { imageUrl } from "../catalogo/consultas";
import { growthApi, lojaApi, type AdminReview, type AdminStockAlert } from "./api";

const FILTROS = [
  { key: "pending", label: "Para aprovar" },
  { key: "approved", label: "Aprovadas" },
  { key: "rejected", label: "Recusadas" },
];

export default function Avaliacoes({ parte = "tudo" }: { parte?: "tudo" | "avaliacoes" | "aviseme" }) {
  const [status, setStatus] = useState("pending");
  const [lista, setLista] = useState<AdminReview[] | null>(null);
  const [alertas, setAlertas] = useState<AdminStockAlert[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [avisou, setAvisou] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setLista(null);
    growthApi.reviews(status).then(setLista).catch((e: Error) => setErro(e.message));
  }, [status]);
  useEffect(carregar, [carregar]);
  useEffect(() => {
    growthApi.stockAlerts().then(setAlertas).catch((e: Error) => setErro(e.message));
  }, []);

  async function decidir(id: string, s: "approved" | "rejected") {
    try {
      await growthApi.decideReview(id, s);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <>
      {erro && <p className="m-0 rounded-[20px] bg-[#FDECEC] p-4 text-[13.5px] text-[#B4443C]">{erro}</p>}

      {parte !== "aviseme" && <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 font-serif text-[22px] font-normal text-teal-dark">Avaliações</h2>
          <div className="flex gap-2">
            {FILTROS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatus(f.key)}
                className={`cursor-pointer rounded-full border-none px-4 py-2 text-[13px] font-semibold ${status === f.key ? "bg-teal text-white" : "bg-white text-text hover:bg-mist"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[20px] border border-line bg-white">
          {!lista ? (
            <p className="m-0 px-5 py-10 text-center text-muted">Carregando…</p>
          ) : lista.length === 0 ? (
            <p className="m-0 px-5 py-10 text-center text-muted">Nada por aqui.</p>
          ) : (
            lista.map((r) => {
              const img = imageUrl(r.product_image ?? undefined);
              return (
                <div key={r.id} className="flex flex-wrap items-start gap-4 border-b border-[#EEF3F2] px-5 py-4 last:border-b-0">
                  {img ? <img src={img} alt="" className="h-12 w-12 rounded-[12px] object-cover" /> : <span className="h-12 w-12 rounded-[12px] bg-mist" />}
                  <div className="min-w-[220px] flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
                      <Link to={`/produto/${r.product_slug}`} target="_blank" className="font-semibold text-text hover:text-teal">
                        {r.product_name}
                      </Link>
                      <span className="inline-flex gap-0.5 text-teal">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star key={i} size={13} strokeWidth={1.6} fill={i <= r.rating ? "currentColor" : "none"} />
                        ))}
                      </span>
                    </div>
                    {r.text && <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-text-2">{r.text}</p>}
                    <span className="mt-1.5 block text-[12px] text-muted">
                      {r.customer} · {r.email} · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {r.status !== "approved" && (
                      <button
                        type="button"
                        onClick={() => void decidir(r.id, "approved")}
                        className="flex cursor-pointer items-center gap-1 rounded-full border-none bg-teal px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-teal-dark"
                      >
                        <Check size={14} strokeWidth={2.2} /> Publicar
                      </button>
                    )}
                    {r.status !== "rejected" && (
                      <button
                        type="button"
                        onClick={() => void decidir(r.id, "rejected")}
                        className="flex cursor-pointer items-center gap-1 rounded-full border-[1.5px] border-line bg-white px-4 py-2 text-[12.5px] font-semibold text-text-2 hover:border-[#B4443C] hover:text-[#B4443C]"
                      >
                        <X size={14} strokeWidth={2.2} /> {r.status === "approved" ? "Tirar do site" : "Recusar"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>}

      {parte !== "avaliacoes" && <section className="grid gap-4">
        <div>
          <h2 className="m-0 font-serif text-[22px] font-normal text-teal-dark">Avise-me quando voltar</h2>
          <p className="m-0 mt-1 text-[13.5px] text-text-2">
            Quem pediu aviso de peça indisponível. Quando a sincronização marcar a peça como disponível, o e-mail sai sozinho
            (se a automação estiver ligada).
          </p>
        </div>
        <div className="overflow-x-auto rounded-[20px] border border-line bg-white">
          {!alertas ? (
            <p className="m-0 px-5 py-10 text-center text-muted">Carregando…</p>
          ) : alertas.length === 0 ? (
            <p className="m-0 px-5 py-10 text-center text-muted">Ninguém esperando peça no momento.</p>
          ) : (
            <table className="w-full min-w-[520px] border-collapse text-[13.5px]">
              <thead>
                <tr className="text-left text-[11.5px] tracking-[0.08em] text-muted uppercase">
                  <th className="px-5 py-3 font-semibold">Peça</th>
                  <th className="px-3 py-3 font-semibold">Esperando</th>
                  <th className="px-3 py-3 font-semibold">Já avisadas</th>
                  <th className="px-5 py-3 font-semibold">Situação</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {alertas.map((a) => (
                  <tr key={a.product_id} className="border-t border-[#EEF3F2]">
                    <td className="px-5 py-3">
                      <Link to={`/admin/produtos?abrir=${a.product_id}`} className="font-semibold text-text hover:text-teal">
                        {a.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-semibold text-teal">{a.waiting}</td>
                    <td className="px-3 py-3 text-text-2">{a.notified}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${a.available ? "bg-mist text-teal" : "bg-[#FDF3E6] text-[#8A5A14]"}`}>
                        {a.available ? "Disponível de novo" : "Indisponível"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {a.available && a.waiting > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            void lojaApi
                              .notifyStock(a.product_id)
                              .then((r) => {
                                setAvisou(`${r.sent} ${r.sent === 1 ? "cliente avisada" : "clientes avisadas"} sobre ${a.name}.`);
                                growthApi.stockAlerts().then(setAlertas).catch(() => {});
                              })
                              .catch((e: Error) => setErro(e.message))
                          }
                          className="cursor-pointer rounded-full border-none bg-teal px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-teal-dark"
                        >
                          Avisar clientes
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {avisou && <p className="m-0 text-[13px] text-text-2">{avisou}</p>}
      </section>}
    </>
  );
}
