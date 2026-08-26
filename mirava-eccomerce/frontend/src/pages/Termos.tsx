// Termos de uso e política de troca/devolução — formaliza numa página só o
// que já estava espalhado no FAQ (data/content.ts) e nas páginas
// institucionais (prazo, parcelas, garantia). Não inventa regra nova: só
// organiza o que a loja já promete em outro lugar. Mudou a regra real, muda
// aqui e no FAQ junto.
//
// PENDENTE: falta CNPJ e razão social da empresa — ver docs/PENDENCIAS.md.

import { useEffect } from "react";
import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import Reveal from "../components/Reveal";
import { LOJA } from "../config/loja";

export default function Termos() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div>
      <div className="border-b border-blush-2 bg-[linear-gradient(160deg,#FFF9FC_0%,#FFEDF5_55%,#FBD9E7_100%)] px-6 pt-[84px] pb-14 text-center sm:px-16 lg:px-24">
        <Reveal className="mx-auto flex max-w-[680px] flex-col items-center gap-4">
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white/70 text-wine shadow-[0_14px_30px_-16px_rgba(142,59,107,0.4)] ring-1 ring-rose/50">
            <FileText className="h-[21px] w-[21px]" strokeWidth={1.5} />
          </span>
          <span className="font-script text-[24px] tracking-[0.06em] text-wine">Regras claras</span>
          <h1 className="m-0 font-serif text-[clamp(30px,3.6vw,44px)] leading-[1.1] font-normal text-ink">
            Termos de uso e compra
          </h1>
          <p className="m-0 max-w-[520px] text-[13px] text-mauve">Última atualização: agosto de 2026</p>
        </Reveal>
      </div>

      <section className="px-6 py-16 sm:px-16 lg:px-24">
        <div className="mx-auto flex max-w-[720px] flex-col gap-9">
          <Bloco titulo="Quem vende">
            <p className="m-0 text-[14.5px] leading-relaxed text-ink-soft">
              Mirava Joias — <span className="rounded bg-blush px-1.5 py-0.5 text-[12.5px] font-medium text-wine-dark">razão social e CNPJ a preencher</span>.
              Contato: <a href={`mailto:${LOJA.email}`} className="text-wine underline">{LOJA.email}</a>. Ao
              comprar no site, você concorda com os termos descritos aqui.
            </p>
          </Bloco>

          <Bloco titulo="As peças">
            <p className="m-0 text-[14.5px] leading-relaxed text-ink-soft">
              Todas as joias são feitas sob encomenda: a peça só começa a ser preparada depois que o
              pagamento é confirmado, o que significa que não existe estoque pronto pra envio imediato.
              Peças em prata 925 e banhadas a ouro 18k têm garantia de 12 meses no acabamento contra
              descascamento ou oxidação prematura em uso normal.
            </p>
          </Bloco>

          <Bloco titulo="Prazo e frete">
            <p className="m-0 text-[14.5px] leading-relaxed text-ink-soft">
              O prazo de entrega é de {LOJA.prazo.minDiasUteis} a {LOJA.prazo.maxDiasUteis} dias úteis,
              contados a partir da confirmação do pagamento. O frete é calculado no checkout de acordo
              com o CEP e sai grátis em compras acima de R$ 350.
            </p>
          </Bloco>

          <Bloco titulo="Pagamento">
            <p className="m-0 text-[14.5px] leading-relaxed text-ink-soft">
              Aceitamos Pix e cartão de crédito, em até {LOJA.parcelasSemJuros}x sem juros (mais parcelas
              ficam sujeitas aos juros da operadora). Todo pagamento é processado pelo Mercado Pago; a
              Mirava não vê nem guarda o número do seu cartão.
            </p>
          </Bloco>

          <Bloco titulo="Troca e devolução">
            <div className="flex flex-col gap-3 text-[14.5px] leading-relaxed text-ink-soft">
              <p className="m-0">
                Você tem até <strong className="text-ink">7 dias corridos</strong> a partir do recebimento
                pra solicitar troca ou devolução, conforme o Código de Defesa do Consumidor — é só escrever
                pra <a href={`mailto:${LOJA.email}`} className="text-wine underline">{LOJA.email}</a> com o
                número do pedido e a peça.
              </p>
              <p className="m-0">
                Na <strong className="text-ink">devolução por arrependimento</strong>, o frete de volta fica
                por nossa conta e o reembolso é feito na mesma forma de pagamento da compra. Na{" "}
                <strong className="text-ink">troca</strong>, você recebe um vale no valor da peça, válido
                por 30 dias para um novo pedido.
              </p>
              <p className="m-0">
                A peça precisa voltar sem sinais de uso, sem manchas ou odores, na embalagem original e com
                tudo que veio junto (tags, cartão de garantia), enviada dentro de uma caixa — nunca em
                envelope. Peças em promoção e danos por mau uso não entram nesta política.
              </p>
            </div>
          </Bloco>

          <Bloco titulo="Sua conta">
            <p className="m-0 text-[14.5px] leading-relaxed text-ink-soft">
              É preciso ter uma conta pra finalizar a compra. Você é responsável por manter sua senha em
              segurança; se desconfiar de acesso indevido, troque a senha e nos avise.
            </p>
          </Bloco>

          <Bloco titulo="Conteúdo do site">
            <p className="m-0 text-[14.5px] leading-relaxed text-ink-soft">
              Fotos, textos e a marca Mirava são de uso exclusivo da loja — reprodução sem autorização não
              é permitida.
            </p>
          </Bloco>

          <p className="m-0 text-[13px] leading-relaxed text-mauve">
            Dúvidas sobre estes termos? Escreva pra{" "}
            <a href={`mailto:${LOJA.email}`} className="text-wine underline">{LOJA.email}</a>. Veja também
            a nossa <a href="/privacidade" className="text-wine underline">política de privacidade</a>.
          </p>
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
