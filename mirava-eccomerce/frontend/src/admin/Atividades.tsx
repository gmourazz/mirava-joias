// Atividades (v5): o histórico de todas as mudanças de status dos pedidos,
// lido de order_events — o gatilho do banco grava cada mudança com a origem
// ('admin' quando foi pelo painel; 'system' quando foi o webhook ou uma
// tarefa agendada).

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, User } from "lucide-react";
import { extraApi, STATUS_LABEL, type Activity } from "./api";

const FILTROS = [
  { key: "", label: "Tudo" },
  { key: "admin", label: "Pelo painel" },
  { key: "system", label: "Automático" },
];

export default function Atividades() {
  const [origem, setOrigem] = useState("");
  const [lista, setLista] = useState<Activity[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setLista(null);
    extraApi.activities(origem).then(setLista).catch((e: Error) => setErro(e.message));
  }, [origem]);

  return (
    <>
      <div className="flex gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setOrigem(f.key)}
            className={`cursor-pointer rounded-full border-none px-4 py-2 text-[13px] font-semibold ${origem === f.key ? "bg-teal text-white" : "bg-white text-text hover:bg-mist"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {erro && <p className="m-0 rounded-[20px] bg-[#FDECEC] p-4 text-[#B4443C]">{erro}</p>}

      <section className="rounded-[20px] border border-line bg-white">
        {!lista ? (
          <p className="m-0 px-5 py-10 text-center text-muted">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="m-0 px-5 py-10 text-center text-muted">Nenhuma atividade ainda.</p>
        ) : (
          lista.map((a, i) => {
            const painel = a.origin === "admin";
            return (
              <div key={i} className="flex items-center gap-3 border-b border-[#EEF3F2] px-5 py-3 text-[13.5px] last:border-b-0">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${painel ? "bg-teal text-white" : "bg-mist text-teal"}`}>
                  {painel ? <User size={16} strokeWidth={1.8} /> : <Bot size={16} strokeWidth={1.8} />}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="text-text">{painel ? "Você" : "Sistema"}</strong>{" "}
                  <span className="text-text-2">
                    {a.from_status ? <>moveu </> : <>criou </>}
                    <Link to={`/admin/pedidos?abrir=${a.order_id}`} className="font-semibold text-teal">
                      #{a.order_number}
                    </Link>{" "}
                    ({a.customer_name}){a.from_status && <> de {STATUS_LABEL[a.from_status]}</>} para <strong className="text-text">{STATUS_LABEL[a.to_status]}</strong>
                  </span>
                  {a.detail && <span className="block text-[12px] text-muted">{a.detail}</span>}
                </span>
                <span className="shrink-0 text-[12.5px] text-muted">
                  {new Date(a.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
