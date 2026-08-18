import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Loader2,
  Mail,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { subscribeNewsletter } from "../lib/newsletter";
import { ApiError } from "../lib/api";
import Reveal from "./Reveal";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setError(null);
    try {
      await subscribeNewsletter(email.trim());
      setStatus("done");
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Não consegui enviar. Tente de novo.",
      );
      setStatus("error");
    }
  }

  return (
    <section className="relative overflow-hidden border-t border-blush-2 bg-[linear-gradient(135deg,#FFF9FC_0%,#FFE5F0_55%,#FDCAE1_100%)] px-6 py-[84px] sm:px-16 lg:px-24">
      {/* Elementos decorativos — mesma linguagem visual das outras seções
          "de destaque" do site (círculos borrados com a paleta da marca). */}
      <span className="pointer-events-none absolute -top-32 -left-20 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(212,106,159,0.16),transparent_70%)] blur-2xl" />
      <span className="pointer-events-none absolute -right-24 -bottom-32 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(142,59,107,0.14),transparent_70%)] blur-2xl" />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 rounded-[28px] border border-white/60 bg-white/55 p-8 shadow-[0_30px_70px_-30px_rgba(142,59,107,0.35)] backdrop-blur-sm sm:p-12 md:grid-cols-[1fr_auto]">
        <Reveal>
          <div className="flex flex-col gap-3.5">
            <span className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.3em] text-wine uppercase">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
              Oferta de boas-vindas
            </span>
            <h2 className="m-0 font-serif text-[clamp(30px,3.6vw,46px)] leading-[1.08] font-normal text-ink">
              10% na sua primeira encomenda
            </h2>
            <span className="block h-px w-14 bg-rose" />
            <p className="m-0 max-w-[440px] text-[14.5px] leading-relaxed text-ink-soft">
              Receba o cupom de primeira compra por e-mail e seja a primeira a
              saber das novidades. É só criar sua conta depois e usar o código
              no checkout.
            </p>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="w-full md:w-[380px]">
            {status === "done" ? (
              <div className="flex items-start gap-3 rounded-[20px] border border-rose/50 bg-white/80 p-5">
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-wine"
                  strokeWidth={1.8}
                />
                <p className="m-0 text-[13.5px] leading-relaxed text-ink">
                  Cupom enviado! Confira seu e-mail e crie sua conta para usá-lo
                  na primeira compra.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-2.5">
                <label className="relative block w-full">
                  <Mail
                    className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-mauve"
                    strokeWidth={1.6}
                  />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(ev) => setEmail(ev.target.value)}
                    placeholder="Seu melhor e-mail"
                    className="w-full rounded-full border border-rose bg-white/90 py-3.5 pr-5 pl-11 font-sans text-[13.5px] text-ink outline-none transition-colors focus:border-wine"
                  />
                </label>
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border-none bg-wine px-7 py-3.5 font-serif text-sm font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-wine-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  ) : (
                    <>
                      Quero meu cupom
                      <ArrowRight
                        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                        strokeWidth={1.8}
                      />
                    </>
                  )}
                </button>
                {status === "error" && error && (
                  <p className="m-0 pl-1 text-[12px] leading-relaxed text-wine-dark">
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
