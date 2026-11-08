// Textos das políticas da loja (página /politicas/:aba).
//
// Trocas e Entrega repetem regras que já valem no código e no FAQ — prazo,
// frete grátis, 7 dias de arrependimento. Mudou uma regra, mude aqui também.
//
// Privacidade e Termos são RASCUNHOS escritos sem revisão jurídica
// (`revisado: false`). O PLANO.md pede revisão de advogado antes de publicar:
// enquanto não houver, a página mostra o aviso de versão preliminar. Depois da
// revisão, troque o texto se preciso e marque `revisado: true`.

import { LOJA } from "../config/loja";

export type PoliticaKey = "trocas" | "entrega" | "privacidade" | "termos";

export interface Politica {
  key: PoliticaKey;
  label: string;
  atualizada: string;
  revisado: boolean;
  secoes: { t: string; d: string }[];
}

const prazo = `até ${LOJA.prazo.maxDiasUteis} dias úteis`;

export const POLITICAS: Politica[] = [
  {
    key: "trocas",
    label: "Trocas e devoluções",
    atualizada: "03/11/2026",
    revisado: false,
    secoes: [
      {
        t: "Direito de arrependimento",
        d: "Você tem até 7 dias corridos a partir do recebimento para desistir da compra, sem precisar justificar, conforme o art. 49 do Código de Defesa do Consumidor. Na devolução por arrependimento, o frete fica por nossa conta e o reembolso é feito na mesma forma de pagamento da compra.",
      },
      {
        t: "Cancelamento antes do envio",
        d: "Você pode cancelar o pedido na sua conta até ele ser despachado. Se o pagamento já foi feito, o valor é estornado automaticamente pelo Mercado Pago, e o prazo para aparecer depende do seu banco ou da operadora do cartão.",
      },
      {
        t: "Troca",
        d: "Dentro do mesmo prazo de 7 dias, você pode pedir a troca da peça. Você recebe um vale no valor da peça para usar em um novo pedido, válido por 30 dias.",
      },
      {
        t: "Como a peça deve voltar",
        d: "Sem sinais de uso, sem manchas ou odores, na embalagem original e com tudo que veio junto. Envie sempre dentro de uma caixa, nunca em envelope, para a peça não se danificar no caminho. Danos por mau uso não entram na política de troca.",
      },
      {
        t: "Como solicitar",
        d: `Escreva para ${LOJA.email} com o número do pedido e fotos da peça. A gente responde com as orientações de envio.`,
      },
    ],
  },
  {
    key: "entrega",
    label: "Entrega e prazos",
    atualizada: "03/11/2026",
    revisado: false,
    secoes: [
      {
        t: "Peças sob encomenda",
        d: `Cada peça é encomendada depois que o pagamento é confirmado. Por isso o prazo de entrega é de ${prazo}, contados a partir da confirmação do pagamento, já somando a encomenda e o transporte.`,
      },
      {
        t: "Formas de envio",
        d: "Enviamos pelos Correios, na modalidade econômica (PAC) ou expressa (SEDEX). O valor e o prazo de transporte aparecem antes do pagamento, calculados pelo seu CEP.",
      },
      {
        t: "Frete grátis",
        d: "Pedidos acima de R$ 300 têm frete grátis na modalidade econômica. O SEDEX é sempre cobrado.",
      },
      {
        t: "Rastreio",
        d: "Assim que a peça é despachada, você recebe o código de rastreio por e-mail e consegue acompanhar em Minha conta.",
      },
      {
        t: "Se a peça não estiver disponível",
        d: "Como a encomenda acontece depois do pagamento, pode ser que uma peça acabe no meio do caminho. Se isso acontecer, falamos com você antes de qualquer coisa e oferecemos uma peça parecida ou o estorno integral.",
      },
    ],
  },
  {
    key: "privacidade",
    label: "Privacidade",
    atualizada: "03/11/2026",
    revisado: false,
    secoes: [
      {
        t: "Quais dados coletamos",
        d: "Nome, e-mail, telefone, CPF e endereço de entrega, informados por você no cadastro e na compra, além do histórico dos seus pedidos.",
      },
      {
        t: "Para que usamos",
        d: "Para processar e entregar seus pedidos, falar com você sobre eles e cumprir obrigações legais. Não vendemos nem alugamos seus dados.",
      },
      {
        t: "Com quem compartilhamos",
        d: "Só com quem precisa deles para a compra acontecer: o Mercado Pago, que processa o pagamento (os dados do seu cartão ficam com ele, nunca passam pelo nosso site), e os Correios, que fazem a entrega.",
      },
      {
        t: "Seus direitos",
        d: `Pela Lei Geral de Proteção de Dados (LGPD), você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento, escrevendo para ${LOJA.email}.`,
      },
      {
        t: "Segurança",
        d: "Sua senha é guardada de forma criptografada e o acesso aos dados de clientes é restrito.",
      },
    ],
  },
  {
    key: "termos",
    label: "Termos de uso",
    atualizada: "03/11/2026",
    revisado: false,
    secoes: [
      {
        t: "Sobre a loja",
        d: "A Mirava vende semijoias sob encomenda pela internet. Ao comprar no site, você concorda com estes termos e com as políticas de trocas, entrega e privacidade.",
      },
      {
        t: "Preços e pagamento",
        d: "Os preços valem no momento da compra e são confirmados pelo sistema antes do pagamento. O pagamento é feito pelo Mercado Pago, por Pix ou cartão de crédito.",
      },
      {
        t: "Conta",
        d: "Para comprar é preciso ter uma conta. Você é responsável por manter a sua senha em segredo e pelas informações cadastradas.",
      },
      {
        t: "Imagens das peças",
        d: "As fotos mostram as peças da forma mais fiel possível, mas cor e tamanho podem variar um pouco conforme a tela de cada aparelho.",
      },
      {
        t: "Contato",
        d: `Dúvidas sobre estes termos: ${LOJA.email}.`,
      },
    ],
  },
];
