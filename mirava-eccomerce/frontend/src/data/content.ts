export const ANNOUNCEMENTS = [
  { text: "Frete grátis acima de R$ 350", delay: "0s" },
  { text: "Até 6x sem juros · 5% off no PIX", delay: "4s" },
  { text: "Peças feitas sob encomenda em 7 a 15 dias", delay: "8s" },
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
  { icon: "clock", text: "Produção em 7 a 15 dias úteis após a confirmação" },
  { icon: "ruler", text: "Tamanho, metal e gravação definidos com você" },
  { icon: "sparkles", text: "Vagas limitadas de produção por mês" },
];

export const STEPS = [
  { n: "01", icon: "gem", title: "Escolha seu estilo", desc: "Navegue pelas coleções ou traga uma referência sua — foto, desenho, ideia solta.", meta: "sem compromisso" },
  { n: "02", icon: "pen", title: "Consulta e personalização", desc: "Escolha metal, tamanho e gravação na página da peça — dúvidas, é só chamar no WhatsApp.", meta: "resposta no mesmo dia" },
  { n: "03", icon: "hammer", title: "Produção da sua peça", desc: "Depois do pedido confirmado no site, sua joia é feita à mão, uma só.", meta: "7 a 15 dias úteis" },
  { n: "04", icon: "package", title: "Entrega", desc: "Embalagem Mirava, certificado da peça e rastreio até a sua porta.", meta: "frete grátis acima de R$ 350" },
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
  { icon: "card", title: "Até 6x sem juros", desc: "5% de desconto no PIX" },
  { icon: "shield", title: "Entrega segura", desc: "Compra e pagamento no site" },
  { icon: "message", title: "Suporte no WhatsApp", desc: "Dúvidas antes e depois da compra" },
];

export const FOOTER_COLS = [
  { title: "A marca", links: ["Sobre a Mirava", "Como funciona a encomenda", "Prazos de produção"] },
  { title: "Ajuda", links: ["Fale conosco", "Guia de tamanhos", "Cuidados com a peça"] },
  { title: "Contato", links: ["contato@miravajoias.com.br", "WhatsApp (11) 98888-0000", "@miravajoias"] },
];

export const FAQ = [
  { q: "Quanto tempo leva para a peça ficar pronta?", a: "De 7 a 15 dias úteis depois da compra confirmada. Peças com gravação ou pedra específica podem levar alguns dias a mais — avisamos antes de começar." },
  { q: "Posso escolher o tamanho do anel?", a: "Sim, todos os anéis são feitos no seu tamanho. Se você não souber, mandamos um medidor junto de um pedido anterior ou orientamos pelo WhatsApp." },
  { q: "A gravação tem custo extra?", a: "Não. Até 14 caracteres estão inclusos no preço, em qualquer um dos três estilos de traço." },
  { q: "Como funciona a troca?", a: "Peças personalizadas não têm troca por desistência, mas ajustamos tamanho sem custo em até 30 dias e cobrimos qualquer defeito de fabricação." },
  { q: "O banho de ouro descasca?", a: "O banho é aplicado em camada grossa sobre prata 925 e tem 12 meses de garantia. Evite perfume e água do mar direto na peça." },
];

export const INSTAGRAM_SEEDS = ["jw2", "jw6", "jw3", "jw5", "jw7", "jw4"];
