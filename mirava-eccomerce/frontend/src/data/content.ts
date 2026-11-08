// Só o que a loja cumpre de fato. O v5 trazia também garantia de 6 meses e
// embalagem de presente, que ainda não estão confirmadas com a fornecedora.
export const ANNOUNCEMENTS = [
  { text: "Frete grátis acima de R$ 300" },
  { text: "Parcele em 3x sem juros" },
  { text: "Pix ou cartão pelo Mercado Pago" },
  { text: "Feito sob encomenda" },
  { text: "Pagamento 100% seguro" },
];

// Slides do hero do v5. `em` é a palavra que sai em itálico teal no título.
// Textos ajustados ao que a loja cumpre: o protótipo prometia garantia de 6
// meses e peças hipoalergênicas, que ainda não estão confirmadas com a Lilly.
// As fotos (assets/banner) são quadradas: ocupam a metade direita do banner,
// `posicao` diz que parte da foto fica visível quando ela é recortada, e
// `fundo` é o tom da própria foto, bem claro, atrás do texto — assim a foto
// se funde ao fundo sem a emenda de duas cores diferentes.
export const HERO_SLIDES = [
  {
    eyebrow: "Lançamentos",
    title: "Joias delicadas para complementar sua",
    em: "personalidade",
    text: "Banhadas a prata e a ouro 18k, encomendadas pra você e entregues em até 20 dias úteis.",
    cta: { label: "Ver lançamentos", to: "/categoria/colecoes/todos?ordem=novos" },
    cta2: { label: "Mais vendidos", to: "/categoria/colecoes/todos?ordem=vendidos" },
    seed: "banner-colar-coracao",
    posicao: "50% 60%",
    fundo: "#F0EDEC",
    dark: false,
  },
  {
    eyebrow: "Colares",
    title: "Um colar para cada",
    em: "momento",
    text: "Pingentes, correntes e chokers banhados a prata e ouro 18k, para usar sozinhos ou em camadas.",
    cta: { label: "Ver colares", to: "/categoria/colecoes/colares" },
    cta2: { label: "Banhados a prata", to: "/categoria/prata/todos" },
    seed: "banner-colar-verde",
    posicao: "50% 100%",
    zoom: false, // sem a animação de zoom: ela cortaria os pingentes
    fundo: "#EEEEEE",
    dark: false,
  },
  {
    eyebrow: "Pulseiras e colares",
    title: "Combine e monte o seu",
    em: "mix",
    text: "Pulseiras e colares que conversam entre si: delicados pra usar todo dia, juntos ou separados.",
    cta: { label: "Ver pulseiras", to: "/categoria/colecoes/pulseiras" },
    cta2: { label: "Banhados a ouro", to: "/categoria/ouro/todos" },
    seed: "banner-trevo",
    posicao: "40% 55%",
    fundo: "#F2EEEA",
    dark: false,
  },
  {
    eyebrow: "Anéis",
    title: "Anéis que dizem muito sobre",
    em: "você",
    text: "Lisos, cravejados e reguláveis, banhados a prata e ouro 18k. Veja o guia de tamanhos na página da peça.",
    cta: { label: "Ver anéis", to: "/categoria/colecoes/aneis" },
    cta2: null,
    seed: "banner-aneis",
    posicao: "50% 70%",
    fundo: "#EEEEEE",
    dark: false,
  },
];

// TESTIMONIALS foi removido: os 6 depoimentos e as notas de avaliação eram
// inventados, e depoimento falso é publicidade enganosa (CDC, art. 37).
// Quando houver avaliação real de cliente, ela vem do banco — não daqui.

// Perguntas que a cliente realmente faz antes de comprar. Nada de resposta
// que a loja não possa cumprir: prazo, troca e garantia aqui precisam bater
// com o que está no domínio (api/internal/dominio) e na política real.
//
// As regras de troca e devolução seguem a política da fornecedora (prazo de
// 7 dias, peça intacta na embalagem original, vale-troca de 30 dias, estorno
// na forma de pagamento original). Mudou lá, muda aqui.
export type FaqCategoria = "pedidos" | "pagamento" | "entrega" | "trocas" | "pecas";

export const FAQ_CATEGORIAS: { key: FaqCategoria; label: string }[] = [
  { key: "pedidos", label: "Pedidos" },
  { key: "pagamento", label: "Pagamento" },
  { key: "entrega", label: "Entrega e frete" },
  { key: "trocas", label: "Trocas e devoluções" },
  { key: "pecas", label: "Tamanhos e cuidados" },
];

export const FAQ: { cat: FaqCategoria; q: string; a: string }[] = [
  {
    cat: "pedidos",
    q: "Por que a peça é feita sob encomenda?",
    a: "A Mirava encomenda cada peça depois que o seu pagamento é confirmado. Assim a gente não trabalha com estoque parado, e você recebe uma peça separada especialmente para o seu pedido, conferida e embalada antes de seguir até você.",
  },
  {
    cat: "pedidos",
    q: "Preciso criar uma conta para comprar?",
    a: "Sim. A conta guarda seus endereços e o histórico dos pedidos, e é por ela que você acompanha cada etapa até a entrega. O cadastro leva menos de um minuto.",
  },
  {
    cat: "pedidos",
    q: "Como acompanho meu pedido?",
    a: "Em Minha conta, na aba Meus pedidos, você vê em que etapa o pedido está. Quando a peça é despachada, o código de rastreio aparece ali e também chega por e-mail.",
  },
  {
    cat: "pedidos",
    q: "E se a peça acabar antes de ser encomendada?",
    a: "Pode acontecer, porque a peça é encomendada depois do seu pagamento. Nesse caso a gente fala com você antes de qualquer coisa e oferece uma peça parecida ou o estorno integral do valor pago.",
  },
  {
    cat: "entrega",
    q: "Em quantos dias eu recebo?",
    a: "Em até 20 dias úteis depois do pagamento confirmado. Assim que a peça é enviada, você recebe o código de rastreio por e-mail e acompanha a entrega direto na sua conta.",
  },
  {
    cat: "entrega",
    q: "Quanto custa o frete?",
    a: "Depende da sua região e aparece antes de você pagar, sem surpresa no final. Acima de R$ 300 o frete sai grátis, e existe também uma opção expressa para quem deseja receber mais rápido.",
  },
  {
    cat: "pagamento",
    q: "Quais as formas de pagamento?",
    a: "Pix ou cartão de crédito, com parcelamento em até 3x sem juros. Você escolhe na tela segura do Mercado Pago, na hora de finalizar a compra.",
  },
  {
    cat: "pecas",
    q: "Como descubro meu tamanho de anel?",
    a: "Na página de cada anel você escolhe entre os tamanhos disponíveis. Se ficar na dúvida, entre em contato com a nossa equipe que ajudamos você a medir antes de fechar o pedido.",
  },
  {
    cat: "trocas",
    q: "Posso trocar ou devolver?",
    a: "Pode. Você tem até 7 dias corridos a partir do recebimento para solicitar a troca ou a devolução, conforme o Código de Defesa do Consumidor. É só entrar em contato com a nossa equipe informando o número do pedido e a peça, que enviamos todas as orientações. Na devolução por arrependimento o frete fica por nossa conta e o reembolso é feito na mesma forma de pagamento da compra. Na troca, você recebe um vale no valor da peça para usar em um novo pedido, válido por 30 dias.",
  },
  {
    cat: "trocas",
    q: "A peça precisa voltar de algum jeito específico?",
    a: "Sim. Ela deve estar sem sinais de uso, sem manchas ou odores, na embalagem original e com tudo que veio junto, como tags e cartão de garantia. Envie sempre dentro de uma caixa, nunca em envelope, para a peça não se danificar no caminho. Peças em promoção e danos por mau uso não entram na política de troca.",
  },
  {
    cat: "pecas",
    q: "Como cuido das minhas peças?",
    a: "Guarde separadas e sequinhas, e tire para dormir, tomar banho ou entrar no mar. Perfume, hidratante e produto de limpeza são os grandes vilões: aplique tudo antes de colocar a joia.",
  },
];

