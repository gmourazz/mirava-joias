// "Avise-me quando voltar": guarda o e-mail e a automação manda o aviso
// quando a sincronização marcar a peça como disponível de novo.

import { useState, type FormEvent } from "react";
import { Bell, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { stockAlert } from "../lib/extras";

export default function AviseMe({ productId }: { productId: string }) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    try {
      await stockAlert(productId, user ? "" : email.trim());
      setState("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não consegui salvar. Tente de novo.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="flex items-center gap-2.5 rounded-[18px] bg-mist px-4 py-3.5 text-[14px] text-text-2">
        <Check size={17} strokeWidth={2} className="text-teal" />
        Combinado! Avisamos por e-mail assim que ela voltar.
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="grid gap-3 rounded-[18px] bg-mist px-4 py-4">
      <span className="flex items-center gap-2 text-[14px] text-text-2">
        <Bell size={16} strokeWidth={1.8} className="text-teal" />
        Esta peça está indisponível no momento. Quer saber quando voltar?
      </span>
      <div className="flex flex-wrap gap-2">
        {!user && (
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Seu e-mail"
            className="min-w-[200px] flex-1 rounded-full border-[1.5px] border-line bg-white px-4 py-3 text-[14px] text-text outline-none focus:border-teal"
          />
        )}
        <button
          type="submit"
          disabled={state === "sending"}
          className="cursor-pointer rounded-full border-none bg-teal px-6 py-3 text-[14px] font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
        >
          {state === "sending" ? "Salvando…" : user ? "Me avise por e-mail" : "Avise-me"}
        </button>
      </div>
      {error && <span className="text-[13px] text-[#B4443C]">{error}</span>}
    </form>
  );
}
