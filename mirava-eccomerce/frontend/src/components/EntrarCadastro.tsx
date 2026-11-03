// Entrar e cadastro (v5): tela cheia em dois painéis — à esquerda o painel
// teal com o que a conta oferece, à direita o formulário com o seletor
// ENTRAR | CRIAR CONTA.
//
// Ficam de fora do protótipo o que ainda não existe no backend: "Continuar
// com Google", "Esqueci minha senha", cupom de boas-vindas e Mirava Club.
// Prometer na tela de cadastro o que a conta não entrega é o pior lugar para
// errar.

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Lock, MapPin, Package, Truck, type LucideIcon } from "lucide-react";
import { useAuth, ApiError } from "../context/AuthContext";
import { LOJA } from "../config/loja";

const VANTAGENS: { Icon: LucideIcon; t: string }[] = [
  { Icon: Truck, t: "Acompanhe seus pedidos até a entrega" },
  { Icon: MapPin, t: "Endereços salvos para comprar mais rápido" },
  { Icon: Package, t: "Histórico de tudo o que você encomendou" },
];

export default function EntrarCadastro() {
  const { login, signup } = useAuth();
  const [modo, setModo] = useState<"login" | "signup">("login");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      if (modo === "login") await login(email, senha);
      else await signup(nome, email, senha);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Algo deu errado. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] bg-white">
      <div className="flex flex-col justify-between gap-10 bg-teal p-[clamp(32px,5vw,64px)] text-white">
        <Link to="/" className="grid w-fit gap-1.5 text-white hover:text-white">
          <span className="font-logo text-[28px] leading-none tracking-[0.28em]">MIRAVA</span>
          <span className="text-[9px] tracking-[0.42em] text-teal-pale">SEMIJOIAS · PRATA &amp; OURO</span>
        </Link>

        <div className="grid gap-6">
          <h1 className="m-0 font-serif text-[clamp(36px,4vw,54px)] leading-[1.05] font-normal">
            Sua conta Mirava, <em className="text-teal-pale">do seu jeito</em>
          </h1>
          <p className="m-0 max-w-[40ch] text-[15.5px] leading-[1.7] text-[#D6EEEB]">
            Entre para acompanhar suas encomendas e finalizar a compra em poucos cliques.
          </p>
          <div className="grid gap-2.5">
            {VANTAGENS.map(({ Icon, t }) => (
              <div key={t} className="flex items-center gap-3 rounded-[18px] bg-white/8 px-4 py-3.5 text-[14.5px]">
                <Icon size={18} strokeWidth={1.7} className="text-teal-pale" />
                {t}
              </div>
            ))}
          </div>
        </div>

        <span className="flex items-center gap-2 text-[13px] text-[#BFE3DF]">
          <Lock size={14} strokeWidth={1.8} />
          Seus dados protegidos e nunca compartilhados
        </span>
      </div>

      <div className="relative flex items-center justify-center p-[clamp(24px,5vw,64px)]">
        <Link
          to="/"
          className="absolute top-6 right-6 flex items-center gap-2 text-[11.5px] font-semibold tracking-[0.14em] text-[#5E7473] uppercase hover:text-teal"
        >
          <ArrowLeft size={14} strokeWidth={1.8} />
          Voltar para a loja
        </Link>

        <form key={modo} onSubmit={enviar} className="animate-pop grid w-full max-w-[420px] gap-5 pt-10">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-fog p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setModo(m);
                  setErro(null);
                }}
                className={`cursor-pointer rounded-full border-none py-3 text-[12px] font-bold tracking-[0.14em] uppercase transition-colors ${
                  modo === m ? "bg-white text-teal shadow-[0_4px_14px_rgba(11,74,77,0.08)]" : "bg-transparent text-muted"
                }`}
              >
                {m === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <div className="grid gap-1.5">
            <h2 className="m-0 font-serif text-[32px] font-normal text-teal-dark">
              {modo === "login" ? "Que bom te ver de novo" : "Crie sua conta"}
            </h2>
            <p className="m-0 text-[14.5px] text-text-2">
              {modo === "login" ? "Entre com seu e-mail e senha." : "Leva menos de 1 minuto."}
            </p>
          </div>

          {modo === "signup" && (
            <Campo label="Nome completo" value={nome} onChange={setNome} placeholder="Como podemos te chamar?" autoComplete="name" />
          )}
          <Campo label="E-mail" type="email" value={email} onChange={setEmail} placeholder="voce@email.com" autoComplete="email" />
          <Campo
            label="Senha"
            type="password"
            value={senha}
            onChange={setSenha}
            placeholder="Mínimo de 8 caracteres"
            minLength={8}
            autoComplete={modo === "login" ? "current-password" : "new-password"}
          />

          {erro && <p className="m-0 rounded-[14px] bg-[#FDECEC] px-3.5 py-2.5 text-[13.5px] text-[#B4443C]">{erro}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="cursor-pointer rounded-full border-none bg-teal p-4 text-[12.5px] font-bold tracking-[0.14em] text-white uppercase hover:bg-teal-dark disabled:opacity-60"
          >
            {enviando ? "Enviando…" : modo === "login" ? "Entrar" : "Criar minha conta"}
          </button>

          <p className="m-0 text-center text-[12.5px] leading-relaxed text-muted">
            Esqueceu a senha? Escreva para{" "}
            <a href={`mailto:${LOJA.email}`} className="font-semibold text-teal">
              {LOJA.email}
            </a>{" "}
            que a gente ajuda.
          </p>
        </form>
      </div>
    </div>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  minLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12.5px] font-semibold text-text-2">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="rounded-[14px] border-[1.5px] border-line bg-white px-4 py-3.5 text-[15px] text-text outline-none placeholder:text-[#8A9A9B] focus:border-teal"
      />
    </label>
  );
}
