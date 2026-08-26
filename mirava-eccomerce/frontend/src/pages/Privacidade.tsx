// Política de privacidade — o que a gente coleta, pra quê, e com quem
// compartilha. O conteúdo aqui reflete o que o código realmente faz (ver
// Checkout.tsx, AuthContext.tsx, lib/api.ts, lib/newsletter.ts): nada de
// cláusula genérica descrevendo um comportamento que a loja não tem.
//
// PENDENTE: falta CNPJ e razão social da empresa (ver seção "Quem somos"
// abaixo) — não dá pra inventar, ver docs/PENDENCIAS.md.

import { useEffect } from "react";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import Reveal from "../components/Reveal";
import { LOJA } from "../config/loja";

export default function Privacidade() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div>
      <div className="border-b border-blush-2 bg-[linear-gradient(160deg,#FFF9FC_0%,#FFEDF5_55%,#FBD9E7_100%)] px-6 pt-[84px] pb-14 text-center sm:px-16 lg:px-24">
        <Reveal className="mx-auto flex max-w-[680px] flex-col items-center gap-4">
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white/70 text-wine shadow-[0_14px_30px_-16px_rgba(142,59,107,0.4)] ring-1 ring-rose/50">
            <ShieldCheck className="h-[21px] w-[21px]" strokeWidth={1.5} />
          </span>
          <span className="font-script text-[24px] tracking-[0.06em] text-wine">Seus dados</span>
          <h1 className="m-0 font-serif text-[clamp(30px,3.6vw,44px)] leading-[1.1] font-normal text-ink">
            Política de privacidade
          </h1>
          <p className="m-0 max-w-[520px] text-[13px] text-mauve">Última atualização: agosto de 2026</p>
        </Reveal>
      </div>

      <section className="px-6 py-16 sm:px-16 lg:px-24">
        <div className="mx-auto flex max-w-[720px] flex-col gap-9">
          <p className="m-0 text-[15px] leading-relaxed text-ink-soft">
            Esta política explica quais dados a Mirava coleta quando você navega ou compra no site,
            para que servem e com quem são compartilhados. Se depois de ler você tiver qualquer dúvida,
            escreva pra gente em <a href={`mailto:${LOJA.email}`} className="text-wine underline">{LOJA.email}</a>.
          </p>

          <Bloco titulo="Quem somos">
            <p className="m-0 text-[14.5px] leading-relaxed text-ink-soft">
              Mirava Joias — <span className="rounded bg-blush px-1.5 py-0.5 text-[12.5px] font-medium text-wine-dark">razão social e CNPJ a preencher</span>.
              Contato: <a href={`mailto:${LOJA.email}`} className="text-wine underline">{LOJA.email}</a>.
            </p>
          </Bloco>

          <Bloco titulo="O que coletamos">
            <ul className="m-0 flex flex-col gap-2 pl-5 text-[14.5px] leading-relaxed text-ink-soft">
              <li><strong className="text-ink">Conta:</strong> nome, e-mail e senha. A senha nunca fica salva em texto puro, só como hash criptográfico.</li>
              <li><strong className="text-ink">Entrega:</strong> CEP, endereço completo e telefone, só pra calcular o frete e endereçar a encomenda.</li>
              <li><strong className="text-ink">Pagamento:</strong> nenhum. O pagamento é processado direto pelo Mercado Pago — a Mirava nunca vê nem guarda número de cartão, e o CPF pedido na hora de pagar é informado ao Mercado Pago, não a nós.</li>
              <li><strong className="text-ink">Newsletter:</strong> se você deixar seu e-mail no banner de boas-vindas, guardamos só o e-mail, pra enviar o cupom e novidades.</li>
              <li><strong className="text-ink">Sessão:</strong> um token de acesso fica salvo no armazenamento local do seu navegador, pra você continuar logada entre visitas.</li>
            </ul>
          </Bloco>

          <Bloco titulo="Com quem compartilhamos">
            <p className="m-0 text-[14.5px] leading-relaxed text-ink-soft">
              Só com quem precisa pra sua compra acontecer: o <strong className="text-ink">Mercado Pago</strong> (processa
              o pagamento), os <strong className="text-ink">Correios</strong> (recebem nome e endereço pra postar sua
              encomenda), o <strong className="text-ink">ViaCEP</strong> (recebe só o número do CEP digitado, pra
              preencher o endereço automaticamente) e o <strong className="text-ink">Resend</strong> (envia os e-mails
              transacionais, como confirmação de pedido). Nenhum desses dados é vendido a ninguém.
            </p>
          </Bloco>

          <Bloco titulo="Cookies e rastreamento">
            <p className="m-0 text-[14.5px] leading-relaxed text-ink-soft">
              Hoje o site não usa cookies de propaganda nem ferramentas de analytics de terceiros
              (Google Analytics, Meta Pixel ou parecidos). O único dado guardado no seu navegador é o
              token de sessão, descrito acima. Se isso mudar no futuro, esta política é atualizada antes.
            </p>
          </Bloco>

          <Bloco titulo="Seus direitos">
            <p className="m-0 text-[14.5px] leading-relaxed text-ink-soft">
              Pela Lei Geral de Proteção de Dados (LGPD), você pode pedir a qualquer momento pra ver,
              corrigir ou apagar seus dados, ou pra saber com quem foram compartilhados. É só escrever
              pra <a href={`mailto:${LOJA.email}`} className="text-wine underline">{LOJA.email}</a> — respondemos
              em até 1 dia útil.
            </p>
          </Bloco>

          <Bloco titulo="Por quanto tempo guardamos">
            <p className="m-0 text-[14.5px] leading-relaxed text-ink-soft">
              Enquanto sua conta existir. Dados de pedidos já pagos são mantidos pelo prazo que a lei
              fiscal exige, mesmo que a conta seja excluída depois.
            </p>
          </Bloco>
        </div>
      </section>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="m-0 mb-3 font-serif text-[19px] font-normal text-wine-dark">{titulo}</h2>
      {children}
    </div>
  );
}
