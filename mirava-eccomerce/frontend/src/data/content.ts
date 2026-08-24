export const ANNOUNCEMENTS = [
  { text: "Frete grátis acima de R$ 350", delay: "0s" },
  { text: "Até 3x sem juros no cartão", delay: "4s" },
  { text: "Pagamento 100% seguro", delay: "8s" },
];

export const HERO_SLIDES = [
  {
    kicker: "Feito sob encomenda",
    script: "Enlace",
    title: "Uma peça desenhada para a sua história",
    text: "Prata 925 e banho de ouro: você compra aqui no site e a peça começa a ser feita só depois do seu pedido.",
    cta: "Fazer minha encomenda",
    cta2: "Conhecer coleção",
    seed: "hero-a",
  },
  {
    kicker: "Agenda de agosto aberta",
    script: "Gravação",
    title: "Inicial, data ou frase gravada à mão",
    text: "Escolha o que fica marcado na sua joia — a gravação é feita peça por peça, sem custo extra.",
    cta: "Quero gravar",
    cta2: "Ver exemplos",
    seed: "hero-b",
  },
  {
    kicker: "Prata 925 maciça",
    script: "Raiz",
    title: "A coleção Raiz agora em prata e ouro",
    text: "Mesmo desenho, dois acabamentos: prata polida ou banho de ouro 18k.",
    cta: "Ver a coleção",
    cta2: "Ver acabamentos",
    seed: "hero-c",
  },
];

export const ORDER_FACTS = [
  { icon: "gem", text: "Materiais de qualidade" },
  { icon: "shield", text: "Garantia em todas as peças" },
  { icon: "truck", text: "Entrega acompanhada de perto" },
];

export const STEPS = [
  { n: "01", icon: "gem", title: "Escolha sua peça", desc: "Navegue pelas coleções e veja fotos reais de cada peça, com tamanho e acabamento disponíveis.", meta: "catálogo atualizado" },
  { n: "02", icon: "card", title: "Compra segura no site", desc: "Pague por Pix ou cartão, do jeito que for melhor pra você, em poucos cliques.", meta: "até 3x sem juros" },
  { n: "03", icon: "truck", title: "Envio com rastreio", desc: "Com o pagamento aprovado, sua peça é preparada com cuidado e enviada para o seu endereço.", meta: "10 a 20 dias úteis" },
  { n: "04", icon: "package", title: "Acompanhamento", desc: "Você recebe o código de rastreio por e-mail e acompanha o status do pedido até a entrega.", meta: "frete grátis acima de R$ 350" },
];

export const LINES = [
  { kicker: "Linha prata", title: "Prata 925 maciça", text: "Peso, brilho frio e acabamento polido ou fosco. Envelhece bem e volta ao brilho com um pano.", cta: "Ver a linha prata", seed: "banner-prata", menuKey: "prata" as const },
  { kicker: "Linha banhada", title: "Banho de ouro 18k", text: "Camada grossa sobre prata, tom quente e garantia de 12 meses no acabamento.", cta: "Ver a linha ouro", seed: "banner-ouro", menuKey: "ouro" as const },
];

export const ENGRAVE_STYLES = [
  { label: "Serifada", fontFamily: "var(--font-serif)", fontSize: "38px", letterSpacing: "0.04em" },
  { label: "Manuscrita", fontFamily: "var(--font-script)", fontSize: "40px", letterSpacing: "normal" },
  { label: "Bastão", fontFamily: "var(--font-sans)", fontSize: "26px", letterSpacing: "0.14em", uppercase: true },
];

// TESTIMONIALS foi removido: os 6 depoimentos e as notas de avaliação eram
// inventados, e depoimento falso é publicidade enganosa (CDC, art. 37).
// Quando houver avaliação real de cliente, ela vem do banco — não daqui.

export const TRUST = [
  { icon: "truck", title: "Frete para todo o Brasil", desc: "Grátis acima de R$ 350" },
  { icon: "card", title: "Até 3x sem juros", desc: "No cartão de crédito" },
  { icon: "shield", title: "Entrega segura", desc: "Compra e pagamento no site" },
  { icon: "message", title: "Atendimento por e-mail", desc: "Dúvidas antes e depois da compra" },
];

export const FOOTER_COLS = [
  { title: "A marca", links: ["Sobre a Mirava", "Como comprar", "Prazos de entrega"] },
  { title: "Ajuda", links: ["Fale conosco", "Guia de tamanhos", "Cuidados com a peça"] },
  { title: "Contato", links: ["miravajoias@gmail.com", "@miravajoias"] },
];

// Perguntas que a cliente realmente faz antes de comprar. Nada de resposta
// que a loja não possa cumprir: prazo, troca e garantia aqui precisam bater
// com o que está no domínio (api/internal/dominio) e na política real.
//
// As regras de troca e devolução seguem a política da fornecedora (prazo de
// 7 dias, peça intacta na embalagem original, vale-troca de 30 dias, estorno
// na forma de pagamento original). Mudou lá, muda aqui.
export const FAQ = [
  {
    q: "Em quantos dias eu recebo?",
    a: "De 10 a 20 dias úteis depois do pagamento confirmado. Assim que a peça é enviada, você recebe o código de rastreio por e-mail e acompanha a entrega direto na sua conta.",
  },
  {
    q: "Quanto custa o frete?",
    a: "Depende da sua região e aparece antes de você pagar, sem surpresa no final. Acima de R$ 350 o frete sai grátis, e existe também uma opção expressa para quem deseja receber mais rápido.",
  },
  {
    q: "Quais as formas de pagamento?",
    a: "Pix ou cartão de crédito, com parcelamento sem juros. Você escolhe na hora de finalizar a compra.",
  },
  {
    q: "Como descubro meu tamanho de anel?",
    a: "Na página de cada anel você escolhe entre os tamanhos disponíveis. Se ficar na dúvida, entre em contato com a nossa equipe que ajudamos você a medir antes de fechar o pedido.",
  },
  {
    q: "Posso trocar ou devolver?",
    a: "Pode. Você tem até 7 dias corridos a partir do recebimento para solicitar a troca ou a devolução, conforme o Código de Defesa do Consumidor. É só entrar em contato com a nossa equipe informando o número do pedido e a peça, que enviamos todas as orientações. Na devolução por arrependimento o frete fica por nossa conta e o reembolso é feito na mesma forma de pagamento da compra. Na troca, você recebe um vale no valor da peça para usar em um novo pedido, válido por 30 dias.",
  },
  {
    q: "A peça precisa voltar de algum jeito específico?",
    a: "Sim. Ela deve estar sem sinais de uso, sem manchas ou odores, na embalagem original e com tudo que veio junto, como tags e cartão de garantia. Envie sempre dentro de uma caixa, nunca em envelope, para a peça não se danificar no caminho. Peças em promoção e danos por mau uso não entram na política de troca.",
  },
  {
    q: "Como cuido das minhas peças?",
    a: "Guarde separadas e sequinhas, e tire para dormir, tomar banho ou entrar no mar. Perfume, hidratante e produto de limpeza são os grandes vilões: aplique tudo antes de colocar a joia.",
  },
];

export const INSTAGRAM_SEEDS = ["jw2", "jw6", "jw3", "jw5", "jw7", "jw4"];
