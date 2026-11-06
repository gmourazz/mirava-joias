// Cadastro de novidades (decisão 34): seção da home e pop-up de boas-vindas.
// Guarda e-mail (e WhatsApp, se a cliente quiser) e mostra o cupom
// BEMVINDA10 — 10% só na primeira compra, regra que o servidor confere.

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { Check, Copy, Sparkles, Ticket, X } from "lucide-react";
import { ApiError } from "../lib/api";
import { subscribe } from "../lib/extras";
import { useAuth } from "../context/AuthContext";

function useCadastro(source: "popup" | "rodape") {
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cupom, setCupom] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await subscribe(email.trim(), whatsapp, source);
      setCupom(r.coupon);
      marcarVisto();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não consegui cadastrar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }
  return { email, setEmail, whatsapp, setWhatsapp, cupom, erro, enviando, enviar };
}

function CupomPronto({ cupom }: { cupom: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="grid justify-items-center gap-3 text-center">
      <span className="flex items-center gap-2 text-[14px] font-semibold text-teal">
        <Check size={17} strokeWidth={2.2} /> Prontinho! Use na finalização da compra:
      </span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(cupom);
          setCopiado(true);
        }}
        className="flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-dashed border-teal bg-white px-6 py-3 font-mono text-[18px] font-bold tracking-[0.12em] text-teal-dark"
      >
        {cupom} <Copy size={16} />
      </button>
      <span className="text-[12.5px] text-muted">{copiado ? "Copiado!" : "10% nas peças da sua primeira compra."}</span>
    </div>
  );
}

const CHAVE = "mirava.boasvindas";
function jaViu() {
  try {
    return localStorage.getItem(CHAVE) !== null;
  } catch {
    return true;
  }
}
function marcarVisto() {
  try {
    localStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    // aba anônima: o pop-up pode voltar, não é grave
  }
}

/** Seção "Ganhe 10% off na primeira compra" no fim da home. */
export function NovidadesSecao() {
  const c = useCadastro("rodape");
  return (
    <section className="mx-auto max-w-[1360px] px-[clamp(16px,3vw,40px)] pt-20">
      <div className="grid items-center gap-6 rounded-[36px] bg-teal px-[clamp(24px,5vw,64px)] py-[clamp(36px,5vw,56px)] text-white md:grid-cols-[1.1fr_1fr]">
        <div className="grid gap-2">
          <span className="text-[12px] font-semibold tracking-[0.22em] text-teal-pale uppercase">Novidades</span>
          <h2 className="m-0 font-serif text-[clamp(30px,3.4vw,44px)] leading-[1.08] font-normal">
            Ganhe <em className="text-teal-pale">10% off</em> na primeira compra
          </h2>
          <p className="m-0 text-[15px] leading-relaxed text-[#D6EEEB]">Receba lançamentos e cupons antes de todo mundo.</p>
        </div>
        {c.cupom ? (
          <div className="rounded-3xl bg-white p-6">
            <CupomPronto cupom={c.cupom} />
          </div>
        ) : (
          <form onSubmit={c.enviar} className="grid gap-2.5">
            <div className="flex flex-wrap gap-2.5">
              <input
                type="email"
                required
                value={c.email}
                onChange={(e) => c.setEmail(e.target.value)}
                placeholder="Seu e-mail"
                className="min-w-[200px] flex-1 rounded-full border-none bg-white px-5 py-4 text-[14.5px] text-text outline-none"
              />
              <button type="submit" disabled={c.enviando} className="flex cursor-pointer items-center justify-center gap-2 rounded-full border-none bg-teal-dark px-7 py-4 text-[14px] font-semibold text-white hover:bg-[#08393C] disabled:opacity-60">
                {!c.enviando && <Ticket size={17} strokeWidth={1.8} />}
                {c.enviando ? "Enviando…" : "Quero meu cupom"}
              </button>
            </div>
            {c.erro && <span className="text-[13px] text-[#FFE1DE]">{c.erro}</span>}
            <span className="text-[12px] text-teal-pale">Ao se cadastrar, você aceita receber e-mails da Mirava. Dá para sair quando quiser.</span>
          </form>
        )}
      </div>
    </section>
  );
}

/** Pop-up de boas-vindas: aparece uma vez por navegador, depois de alguns
 *  segundos, só nas páginas da vitrine e só para quem não está logada. */
export function PopupBoasVindas() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [aberto, setAberto] = useState(false);
  const c = useCadastro("popup");
  const vitrine = !/^\/(checkout|conta|admin|pedido|redefinir-senha)/.test(pathname);

  useEffect(() => {
    if (user || !vitrine || jaViu()) return;
    const t = setTimeout(() => setAberto(true), 9000);
    return () => clearTimeout(t);
  }, [user, vitrine]);

  if (!aberto) return null;
  const fechar = () => {
    marcarVisto();
    setAberto(false);
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[rgba(11,74,77,0.35)] p-4" onClick={fechar}>
      <div role="dialog" aria-label="Boas-vindas" onClick={(e) => e.stopPropagation()} className="animate-fade-in relative grid w-full max-w-[440px] gap-4 rounded-[28px] bg-white p-7 text-center">
        <button type="button" aria-label="Fechar" onClick={fechar} className="absolute top-4 right-4 grid h-9 w-9 cursor-pointer place-items-center rounded-full border-none bg-chip text-text">
          <X size={16} />
        </button>
        <span className="flex items-center justify-center gap-1.5 text-[11.5px] font-semibold tracking-[0.2em] text-teal uppercase">
          <Sparkles size={14} /> Bem-vinda à Mirava
        </span>
        <h2 className="m-0 font-serif text-[34px] leading-[1.05] font-normal text-teal-dark">
          Ganhe <em className="text-teal">10% off</em> na primeira compra
        </h2>
        {c.cupom ? (
          <CupomPronto cupom={c.cupom} />
        ) : (
          <form onSubmit={c.enviar} className="grid gap-2.5">
            <p className="m-0 text-[14px] leading-relaxed text-text-2">Deixe seu e-mail e receba o cupom agora, além dos lançamentos antes de todo mundo.</p>
            <input
              type="email"
              required
              value={c.email}
              onChange={(e) => c.setEmail(e.target.value)}
              placeholder="Seu e-mail"
              className="rounded-full border-[1.5px] border-line px-5 py-3.5 text-[14.5px] outline-none focus:border-teal"
            />
            <input
              type="tel"
              value={c.whatsapp}
              onChange={(e) => c.setWhatsapp(e.target.value)}
              placeholder="WhatsApp (opcional)"
              className="rounded-full border-[1.5px] border-line px-5 py-3.5 text-[14.5px] outline-none focus:border-teal"
            />
            {c.erro && <span className="text-[13px] text-[#B4443C]">{c.erro}</span>}
            <button type="submit" disabled={c.enviando} className="flex cursor-pointer items-center justify-center gap-2 rounded-full border-none bg-teal px-6 py-4 text-[14px] font-semibold text-white hover:bg-teal-dark disabled:opacity-60">
              {!c.enviando && <Ticket size={17} strokeWidth={1.8} />}
              {c.enviando ? "Enviando…" : "Quero meu cupom"}
            </button>
            <button type="button" onClick={fechar} className="cursor-pointer border-none bg-transparent text-[13px] text-muted hover:text-teal">
              Agora não
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
