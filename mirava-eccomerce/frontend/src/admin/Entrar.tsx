// Entrada do painel (decisão 46): tela própria, por nome de usuário e senha,
// sem relação com a conta da loja.

import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Lock } from "lucide-react";
import { ApiError, currentPainelToken, savePainelToken } from "../lib/api";
import SenhaInput from "../components/SenhaInput";
import { adminApi } from "./api";
import logoBranco from "../assets/logos/2 - Logo sem SEMIJOIAS/mirava-logo-branco.svg";

const campo =
  "w-full rounded-[14px] border-[1.5px] border-line bg-white px-4 py-3 text-[15px] text-text outline-none placeholder:text-[#8A9A9B] focus:border-teal";

export default function Entrar() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Só caminho dentro do painel: o destino vem da URL.
  const voltar = params.get("voltar");
  const destino = voltar?.startsWith("/admin") && !voltar.startsWith("/admin/entrar") ? voltar : "/admin";

  if (currentPainelToken()) return <Navigate to={destino} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await adminApi.login(usuario.trim(), senha);
      savePainelToken(r.token);
      navigate(destino, { replace: true });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não consegui entrar agora. Tente de novo.");
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-teal-dark px-4 py-10 font-sans">
      <div className="grid w-full max-w-[400px] gap-7">
        <img src={logoBranco} alt="Mirava" className="h-14 w-auto justify-self-center" />
        <form onSubmit={enviar} className="grid gap-4 rounded-[24px] bg-white p-7">
          <div className="grid gap-1">
            <h1 className="m-0 font-serif text-[26px] font-normal text-teal-dark">Painel da loja</h1>
            <p className="m-0 text-[14px] text-text-2">Entre com seu usuário e senha.</p>
          </div>
          <label className="grid gap-1.5">
            <span className="text-[14px] text-text">Usuário</span>
            <input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              className={campo}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[14px] text-text">Senha</span>
            <SenhaInput value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete="current-password" className={campo} />
          </label>
          {erro && <p className="m-0 rounded-[14px] bg-[#FDECEC] px-3.5 py-2.5 text-[13.5px] text-[#B4443C]">{erro}</p>}
          <button
            type="submit"
            disabled={enviando}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-full border-none bg-teal p-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-teal-dark disabled:opacity-60"
          >
            <Lock size={16} strokeWidth={1.9} />
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <p className="m-0 text-center text-[12.5px] text-teal-pale">Acesso restrito à equipe da Mirava.</p>
      </div>
    </div>
  );
}
