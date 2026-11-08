// Janela de entrar e criar conta: abre por cima da página em que a cliente
// está, sem tirar ela dali. Quem abre é `abrirLogin` (context/LoginContext).
//
// "Continuar com Google" fica de fora: o login é próprio (decisão 15) e o
// Google entra só quando houver a credencial OAuth. "Esqueci minha senha"
// manda um link por e-mail (vale 1 hora); o cadastro pode já assinar as
// novidades com o BEMVINDA10 (decisão 34).

import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { forgotPassword, subscribe } from "../lib/extras";
import { useAuth, ApiError } from "../context/AuthContext";
import SenhaInput from "./SenhaInput";

type Modo = "login" | "signup" | "esqueci";

const TITULO: Record<Modo, string> = {
  login: "Entrar na sua conta",
  signup: "Criar conta",
  esqueci: "Esqueceu a senha?",
};

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { login, signup } = useAuth();
  const [modo, setModo] = useState<Modo>("login");
  const [whatsapp, setWhatsapp] = useState("");
  const [novidades, setNovidades] = useState(true);
  const [lembrar, setLembrar] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", tecla);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener("keydown", tecla);
    };
  }, [onClose]);

  const trocar = (m: Modo) => {
    setModo(m);
    setErro(null);
    setAviso(null);
  };

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      if (modo === "esqueci") {
        const r = await forgotPassword(email.trim());
        setAviso(r.nota);
      } else if (modo === "login") await login(email, senha, lembrar);
      else {
        await signup(nome, email, senha);
        // Novidades com consentimento explícito (caixa marcada pela cliente).
        if (novidades) await subscribe(email.trim(), whatsapp, "cadastro").catch(() => {});
      }
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Algo deu errado. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[900] grid place-items-center overflow-y-auto bg-teal-dark/55 p-4 font-sans"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={TITULO[modo]} className="animate-pop w-full max-w-[430px] rounded-[24px] bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <h2 className="m-0 font-serif text-[23px] font-normal text-teal-dark">{TITULO[modo]}</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border-none bg-transparent text-text transition-colors hover:bg-mist hover:text-teal"
          >
            <X size={20} strokeWidth={1.6} />
          </button>
        </div>

        <form onSubmit={enviar} className="grid gap-4 p-6">
          {modo === "esqueci" && (
            <p className="m-0 text-[14px] leading-relaxed text-text-2">
              Digite o e-mail da conta: mandamos um link para você criar uma senha nova.
            </p>
          )}
          {modo === "signup" && (
            <Campo label="Nome completo" value={nome} onChange={setNome} placeholder="Como podemos te chamar?" autoComplete="name" />
          )}
          <Campo label="E-mail" type="email" value={email} onChange={setEmail} placeholder="voce@email.com" autoComplete="email" />
          {modo !== "esqueci" && (
            <Campo
              label="Senha"
              type="password"
              value={senha}
              onChange={setSenha}
              placeholder="Mínimo de 8 caracteres"
              minLength={8}
              autoComplete={modo === "login" ? "current-password" : "new-password"}
              aside={
                modo === "login" && (
                  <button type="button" onClick={() => trocar("esqueci")} className="cursor-pointer border-none bg-transparent p-0 text-[13px] text-text-2 underline hover:text-teal">
                    Esqueceu sua senha?
                  </button>
                )
              }
            />
          )}
          {modo === "signup" && (
            <>
              <Campo label="Celular / WhatsApp (opcional)" type="tel" value={whatsapp} onChange={setWhatsapp} placeholder="(00) 00000-0000" autoComplete="tel" required={false} />
              <label className="flex cursor-pointer items-start gap-2.5 text-[13.5px] leading-snug text-text-2">
                <input type="checkbox" checked={novidades} onChange={(e) => setNovidades(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal" />
                Quero receber novidades e ganhar 10% off na primeira compra
              </label>
            </>
          )}
          {modo === "login" && (
            <label className="flex w-fit cursor-pointer items-center gap-2 text-[13.5px] text-text-2">
              <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} className="h-4 w-4 accent-teal" />
              Lembrar de mim
            </label>
          )}

          {aviso && <p className="m-0 rounded-[14px] bg-mist px-3.5 py-2.5 text-[13.5px] text-teal-dark">{aviso}</p>}
          {erro && <p className="m-0 rounded-[14px] bg-[#FDECEC] px-3.5 py-2.5 text-[13.5px] text-[#B4443C]">{erro}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="cursor-pointer rounded-full border-none bg-teal p-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-teal-dark disabled:opacity-60"
          >
            {enviando ? "Enviando…" : modo === "login" ? "Entrar" : modo === "signup" ? "Criar minha conta" : "Mandar o link"}
          </button>

          {modo === "login" ? (
            <button type="button" onClick={() => trocar("signup")} className="cursor-pointer rounded-full border-[1.5px] border-line bg-white p-3.5 text-[15px] font-medium text-text transition-colors hover:border-teal hover:text-teal">
              Novo por aqui? Cadastre-se
            </button>
          ) : (
            <button type="button" onClick={() => trocar("login")} className="cursor-pointer border-none bg-transparent p-0 text-[14px] text-text-2 underline hover:text-teal">
              {modo === "signup" ? "Já tenho conta" : "Voltar para entrar"}
            </button>
          )}

          {modo !== "esqueci" && (
            <p className="m-0 text-center text-[12px] leading-relaxed text-muted">
              Ao continuar, você concorda com os{" "}
              <Link to="/politicas/termos" onClick={onClose} className="font-semibold text-teal">Termos de uso</Link> e a{" "}
              <Link to="/politicas/privacidade" onClick={onClose} className="font-semibold text-teal">Política de privacidade</Link>.
            </p>
          )}
        </form>
      </div>
    </div>,
    document.body,
  );
}

function Campo({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  minLength,
  autoComplete,
  required = true,
  aside,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  minLength?: number;
  autoComplete?: string;
  required?: boolean;
  aside?: ReactNode;
}) {
  const attrs = {
    id: `campo-${label}`,
    value,
    onChange: (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    required,
    minLength,
    placeholder,
    autoComplete,
    className: "w-full rounded-[14px] border-[1.5px] border-line bg-white px-4 py-3 text-[15px] text-text outline-none placeholder:text-[#8A9A9B] focus:border-teal",
  };
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={attrs.id} className="text-[14px] text-text">{label}</label>
        {aside}
      </div>
      {type === "password" ? <SenhaInput {...attrs} /> : <input {...attrs} type={type} />}
    </div>
  );
}
