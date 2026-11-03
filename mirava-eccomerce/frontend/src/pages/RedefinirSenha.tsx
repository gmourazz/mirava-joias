// Criar senha nova a partir do link do e-mail "Esqueci minha senha". O token
// vai na URL (?t=...); o servidor guarda só o hash e aceita uma vez, por 1 hora.

import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import { ApiError } from "../lib/api";
import { resetPassword } from "../lib/extras";

export default function RedefinirSenha() {
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (senha !== confirma) {
      setErro("As duas senhas não são iguais.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await resetPassword(token, senha);
      setPronto(true);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não consegui trocar a senha.");
    } finally {
      setEnviando(false);
    }
  }

  const input = "rounded-[14px] border-[1.5px] border-line bg-white px-4 py-3.5 text-[15px] outline-none focus:border-teal";
  return (
    <div className="grid min-h-screen place-items-center bg-snow p-6">
      <div className="grid w-full max-w-[420px] gap-5 rounded-3xl border border-line bg-white p-8">
        <Link to="/" className="font-logo text-[24px] tracking-[0.28em] text-teal-dark">MIRAVA</Link>
        {pronto ? (
          <>
            <h1 className="m-0 flex items-center gap-2 font-serif text-[30px] font-normal text-teal-dark">
              <Check className="text-teal" /> Senha nova criada
            </h1>
            <Link to="/conta" className="rounded-full bg-teal px-6 py-3.5 text-center text-[14px] font-semibold text-white hover:bg-teal-dark hover:text-white">
              Entrar na minha conta
            </Link>
          </>
        ) : !token ? (
          <p className="m-0 text-[14.5px] text-text-2">
            Link incompleto. Peça um novo em <Link to="/conta" className="font-semibold text-teal">Entrar → Esqueci minha senha</Link>.
          </p>
        ) : (
          <form onSubmit={enviar} className="grid gap-4">
            <h1 className="m-0 font-serif text-[30px] font-normal text-teal-dark">Crie uma senha nova</h1>
            <input type="password" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha nova (mínimo 8 caracteres)" autoComplete="new-password" className={input} />
            <input type="password" required minLength={8} value={confirma} onChange={(e) => setConfirma(e.target.value)} placeholder="Repita a senha" autoComplete="new-password" className={input} />
            {erro && <p className="m-0 rounded-[14px] bg-[#FDECEC] px-3.5 py-2.5 text-[13.5px] text-[#B4443C]">{erro}</p>}
            <button type="submit" disabled={enviando} className="cursor-pointer rounded-full border-none bg-teal p-4 text-[14px] font-semibold text-white hover:bg-teal-dark disabled:opacity-60">
              {enviando ? "Salvando…" : "Salvar senha nova"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
