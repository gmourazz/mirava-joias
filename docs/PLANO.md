# Plano Mirava Joias — do site atual à loja operando

**Data:** 11 de agosto de 2026
**Escopo:** `mirava-eccomerce/` — backend (`api/`), banco (`supabase/`) e front (`frontend/`)
**Perfil:** desenvolvedora júnior, orçamento inicial zero, investir só depois do primeiro lucro

---

## 1. O modelo de negócio (e o que ele exige do sistema)

Você é **revenda sob encomenda**, não estoquista. O ciclo é:

```
Cliente compra e paga no site
        ↓
Você recebe o dinheiro (Mercado Pago)
        ↓
Você compra a peça na fornecedora
        ↓
A peça chega até você
        ↓
Você reembala na embalagem Mirava e envia para a cliente
```

Três consequências que definem toda a arquitetura:

**a) Você nunca fica com capital parado.** Ótimo para o caixa. Mas significa que **o pagamento tem que ser confirmado de verdade antes de você gastar** — um bug no webhook que marque pedido como pago sem ter recebido é prejuízo direto do seu bolso.

**b) Seu estoque é uma cópia atrasada do estoque dela.** Você nunca terá certeza absoluta de disponibilidade no momento da venda. O sistema precisa assumir isso desde o começo, com um estado de pedido "aguardando confirmação da fornecedora" e um caminho de estorno. Não é detalhe: é o cenário que mais vai acontecer.

**c) O prazo é a soma de três tempos, não dois.** Espera do lote → Lilly produz e posta → chega em você → você reembala e envia. Seu site hoje promete "7 a 15 dias úteis", o que é impossível nesse modelo. Você falou em **10 a 20 dias úteis**, que é bem mais realista — mas só se o lote tiver teto de tempo. A seção 5 é inteira sobre isso, porque é o ponto onde o modelo pode furar.

---

## 2. Diagnóstico do que existe hoje

O site é bonito e a identidade está fiel ao briefing da marca. Mas ele é **uma vitrine estática** — não tem nada por trás.

| Área | Situação hoje |
|---|---|
| Catálogo | 8 produtos fictícios escritos à mão em `src/data/products.ts` |
| Carrinho | `CartContext` só abre e fecha o drawer. Não existe item, quantidade nem total |
| Página de produto | **Não existe.** Só card e grid |
| Checkout | Não existe |
| Banco de dados | Não existe |
| Admin | Não existe |
| Backend | Não existe — é um Vite estático puro |
| Deploy | Não está no ar |
| Versionamento | **A pasta não é um repositório git** |

O que dá pra aproveitar: **quase todo o front-end visual.** Componentes, paleta, tipografia, animações, estrutura de páginas. O trabalho é ligar isso a dados reais, não redesenhar.

> ⚠️ **Faça isso hoje, antes de qualquer outra coisa:** `git init` + primeiro commit + repositório privado no GitHub. Você já perdeu o protótipo `.dc.html` uma vez por não ter versionamento. São 5 minutos e protege meses de trabalho.

---

## 3. Arquitetura recomendada

### Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Front-end (`frontend/`) | React + Vite (o que já existe) | Não jogue fora, está pronto |
| Hospedagem do site | **Cloudflare Pages** | Grátis, banda ilimitada, **permite uso comercial** |
| Banco + Auth + Storage (`supabase/`) | **Supabase** | Postgres de verdade, autenticação e storage inclusos, uso comercial permitido no plano grátis |
| **Backend (`api/`)** | **Go** | Escolha da dona. Tipagem estática e erro explícito ajudam justamente onde erro custa dinheiro |
| **Hospedagem da API** | **Google Cloud Run** | 2 milhões de requisições/mês grátis, escala a zero, roda container Go |
| Agendamento | **Cloud Scheduler** | 3 jobs no free tier: sincronização e avaliação de lote |
| Pagamento | **Mercado Pago Checkout Pro** | Redirect — você nunca toca em dado de cartão |
| Admin | Rota `/admin` no mesmo app React | Um projeto só pra manter |

> **Mudança registrada (11/08/2026):** o backend era Supabase Edge Functions em TypeScript e passou a ser um serviço Go. As migrations não foram afetadas — são Postgres puro. O Supabase continua sendo banco, autenticação e storage; só a camada de aplicação mudou.

### ⚠️ Não use Vercel

O plano Hobby da Vercel (o grátis) **proíbe uso comercial** nos termos de serviço. No dia em que você liga o pagamento, está tecnicamente em violação. Cloudflare Pages e Netlify permitem uso comercial no plano grátis. **Cloudflare Pages** é a minha recomendação: banda ilimitada, o que importa num site cheio de fotos de joia.

### Por que Supabase e não outra coisa

Pra uma júnior, Supabase resolve quatro problemas de uma vez (banco, login, upload de imagem, funções serverless) com uma documentação decente e um painel visual onde você **enxerga** as tabelas. Isso vale muito mais do que a elegância teórica de montar cada peça separada.

**Duas pegadinhas do plano grátis que você precisa saber agora:**

1. **O projeto pausa depois de 7 dias sem nenhuma requisição.** Enquanto você estiver desenvolvendo sozinha e sumir uma semana, ele dorme e você tem que religar na mão. Com a loja no ar e recebendo visita isso não acontece. Durante o desenvolvimento, um monitor gratuito (UptimeRobot) pingando o projeto resolve.
2. **Limites:** 500 MB de banco, 1 GB de storage, 5 GB de saída/mês, 2 projetos ativos. O banco de 500 MB é folgadíssimo pra pedidos — isso é dezenas de milhares de linhas. **O gargalo vai ser o storage de imagem:** 1 GB dá pra mais ou menos 3 a 5 mil fotos de joia bem comprimidas em `.webp`. Comprima tudo antes de subir e você não encosta nesse teto tão cedo.

### Por que Checkout Pro e não Checkout Transparente

O Transparente (Bricks) é mais bonito — a cliente não sai do seu site. Mas você passa a lidar com dados de cartão no seu front-end, o que traz responsabilidade de PCI e muito mais superfície de erro.

**Comece com o Checkout Pro.** A cliente é redirecionada pro Mercado Pago, paga, e volta. Menos bonito, muito mais seguro, e é a diferença entre lançar em 3 semanas ou em 3 meses. Você migra pro Transparente depois, quando estiver vendendo e souber que o resto funciona.

### Desenho geral

```
┌──────────────────────────────────────────────────┐
│  Cloudflare Pages  ·  frontend/  (público)       │
│  vitrine · carrinho · conta · /admin             │
└──────┬───────────────────────────┬───────────────┘
       │ chave anon (protegida     │ fetch + JWT
       │ por RLS) · só leitura     │ tudo que é dinheiro
       ▼                           ▼
┌────────────────────────┐  ┌──────────────────────────┐
│  SUPABASE  supabase/   │  │  CLOUD RUN  ·  api/      │
│                        │  │                          │
│  Postgres  catálogo,   │◄─┤  POST /checkout          │
│    pedidos, lotes      │  │  POST /webhook/...       │
│  Auth  e-mail + Google │  │  POST /tarefas/...       │
│  Storage  imagens      │  │                          │
│  RLS  a fronteira real │  │  segredos ficam aqui     │
└────────────────────────┘  └──────┬───────────────────┘
                                   ▼
                    Mercado Pago  ·  uselilly.com
```

**A regra que organiza tudo:** o site público só **lê**, e só o que o RLS deixa passar. Qualquer coisa que envolva dinheiro, preço ou segredo acontece dentro da API Go.

---

## 4. A fornecedora: Lilly Store

**Boa notícia — a situação é bem melhor do que parecia.** Investiguei o site e achei três coisas que mudam o plano.

### O que eu descobri

| Achado | Por que importa |
|---|---|
| A loja roda na plataforma **wBuy** | A wBuy tem **API REST oficial** em `https://sistema.sistemawbuy.com.br/api/v1`, com endpoint de produtos e limite de 100 requisições por minuto |
| Os **preços de atacado aparecem no HTML público** | Ex.: PL46 R$32,90 varejo / R$23,00 atacado · PL179 R$34,70 / R$24,30 — o atacado é consistentemente **70% do varejo** |
| Existe `sitemap.xml` completo | Índice legítimo e legível por máquina de todo o catálogo dela |
| Prazo de postagem declarado: **4 dias úteis** | Esse é o ponto de partida do seu prazo total (volto nisso na seção 5) |

O site também tem `robots.txt` permissivo (`Allow: /`, inclusive liberando explicitamente bots de IA). Isso não substitui autorização, mas indica que ela não trata o catálogo como fechado.

### O pedido certo a fazer — e ele ficou pequeno

Como a wBuy tem API nativa, seu pedido deixa de ser "me dá um jeito de pegar seus dados" e vira **uma tarefa de dois minutos no painel dela**. Mande isto no WhatsApp (19) 99860-4004:

> Oi! Sou revendedora atacado de vocês e estou montando minha loja online.
> Vi que a loja roda na wBuy, que tem API própria. Vocês conseguem gerar uma **credencial de API** no painel pra mim? Preciso só de leitura de produtos, preço de atacado e estoque — pra manter meu site sincronizado com o de vocês e não vender peça que já acabou.
>
> Aproveitando, três coisas:
> 1. Posso **usar as fotos dos produtos** de vocês no meu site? (preciso só de um "pode" por escrito aqui mesmo)
> 2. O **prazo de postagem de 4 dias úteis** vale também pro atacado?
> 3. Vocês avisam quando uma peça **sai de linha**?

A pergunta 1 não é burocracia: **as fotos são obra protegida por direito autoral dela.** Como você é revendedora, a resposta quase certamente é sim — mas você quer registrado. Uma mensagem de WhatsApp já te protege muito.

### Os caminhos, do melhor pro pior

**Plano A — credencial de API da wBuy.** É o alvo. Documentação em [documenter.getpostman.com/view/4141833/RWTsquyN](https://documenter.getpostman.com/view/4141833/RWTsquyN/). Você recebe JSON estruturado com produto, preço, estoque e imagens. Estável, sem quebrar quando ela mexe no layout, e com o preço de atacado correto e autorizado. **Peça isso antes de escrever qualquer linha de código de sincronização.**

**Plano B — sitemap + leitura das páginas de produto.** Se ela não gerar a credencial, o `sitemap.xml` te dá a lista de URLs e cada página de produto tem nome, código, descrição, imagens e preço. Funciona, mas:

- Quebra quando ela mexer no layout
- As páginas vêm em **ISO-8859-1**, não UTF-8 — se você não converter, todo acento vira `�`
- Nem todo produto exibe preço de atacado no HTML (as peças novas não exibiam)
- Precisa ser gentil: uma leitura a cada poucas horas, nunca em loop

**Plano C — planilha manual.** Se nada funcionar, você exporta na mão de tempos em tempos. Feio, mas destrava o lançamento enquanto negocia o Plano A.

### Regras que valem para qualquer plano

**1. Sincronize para o seu banco. Nunca consulte a Lilly em tempo real durante a navegação.**

Se cada visita ao seu site disparar uma consulta ao site dela: sua página fica lenta, o site dela caindo derruba o seu, e você estoura o limite de 100 requisições por minuto da API. O certo é um job a cada 6 horas que grava no seu Postgres. Seu site lê só o seu banco.

**2. Copie as imagens para o seu Storage.**

As fotos ficam em `assets.sistemawbuy.com.br`. Se você apontar direto pra lá, ela paga a banda, pode bloquear, e no dia em que trocar a foto o seu site muda sozinho. Baixe uma vez, converta pra `.webp`, suba pro Supabase Storage.

**3. Guarde o preço de atacado E o de varejo dela.**

O varejo dela é uma referência valiosa: te diz o teto de mercado. Se você precificar muito acima do varejo da Lilly, a cliente acha a peça mais barata procurando no Google. Guarde os dois e deixe o admin te avisar quando seu preço passar do varejo dela.

**4. Estoque é informação consultiva.**

Margem de segurança: se ela tem menos de 2 unidades, marque indisponível no seu site.

### Regras que valem para qualquer um dos três planos

**1. Sincronize para o seu banco. Nunca consulte a fornecedora em tempo real durante a navegação.**

Isso é importante e é o erro que quase todo mundo comete. Se cada visita ao seu site disparar uma consulta ao site dela:

- Sua página fica lenta (você depende da velocidade do servidor dela)
- Se o site dela cair, **o seu cai junto**
- Ela te bloqueia por volume de acesso

O certo: um job roda de tempos em tempos (a cada 6 horas, por exemplo), lê o catálogo dela e **grava no seu Postgres**. Seu site lê só o seu banco. Se a fornecedora sumir por dois dias, sua loja continua no ar com os dados da última sincronização.

**2. Copie as imagens para o seu Storage. Não aponte para o servidor dela.**

Se você usar a URL da imagem dela direto no seu `<img>`, ela paga a banda (e vai perceber), pode bloquear, e no dia em que ela trocar a foto o seu site muda sozinho. Baixe uma vez, converta pra `.webp`, suba pro Supabase Storage.

**3. Estoque da fornecedora é informação consultiva, não garantia.**

Guarde a quantidade dela, mas na sua loja trabalhe com uma **margem de segurança**: se ela tem menos de 2 unidades, marque como indisponível no seu site. Você não quer vender a última peça e descobrir que alguém comprou dela antes de você.

---

## 5. O modelo de lotes — e a tensão que ele cria

Você quer acumular pedidos até bater o mínimo de frete grátis do atacado (**R$300 no Sudeste**, e você está em Minas) antes de comprar da Lilly. A lógica financeira é impecável. Mas ela cria um conflito direto com a promessa de prazo, e é melhor você enxergar isso agora do que descobrir com uma cliente brava.

### A matemática do lote

Com peça de atacado a ~R$23, R$300 são **cerca de 14 peças**. Ou seja: você precisa vender 14 peças antes de poder comprar a primeira.

**Quanto tempo até fechar um lote:**

| Ritmo de venda | Lote fecha em |
|---|---|
| 3 peças/dia | ~4 dias úteis |
| 1 peça/dia | ~10 dias úteis |
| 1 peça a cada 2 dias | ~20 dias úteis |
| 1 peça a cada 3 dias | ~30 dias úteis |

**Depois que o lote fecha, ainda faltam:**

| Etapa | Dias úteis |
|---|---|
| Lilly posta | 4 (declarado no site dela) |
| Campinas/SP → você, em MG | 3 a 6 |
| Você confere, reembala e posta | 1 a 2 |
| Você → cliente | 3 a 7 |
| **Total pós-lote** | **11 a 19** |

### Onde isso quebra

Some as duas metades. Vendendo **1 peça por dia**, a primeira cliente do lote espera **10 + 15 ≈ 25 dias úteis**. A sua promessa de 10 a 20 dias úteis já nasceu quebrada — e não por culpa da Lilly, e sim do tempo que a peça dela ficou parada esperando o lote encher.

**A assimetria é o ponto:** a última cliente do lote espera ~15 dias úteis e fica feliz. A primeira espera ~25 e reclama. E é sempre a primeira que compra primeiro — ou seja, é a sua cliente mais empolgada que leva a pior experiência.

### A solução: teto de tempo no lote

Feche o lote quando **qualquer uma** das duas condições bater:

1. O lote atingiu **R$300** (frete grátis, cenário ideal), **ou**
2. O **pedido mais antigo do lote completou 5 dias úteis** — fecha assim mesmo e paga o frete

Com o teto de 5 dias, o caso típico vira **5 + 15 = 20 dias úteis** — dentro da promessa. O pior caso ainda dá **5 + 19 = 24 dias úteis**, ou seja, estoura em 4 dias quando tudo atrasa junto.

**Seja honesta sobre isso.** Duas saídas: prometer "10 a 25 dias úteis" e entregar antes na maioria das vezes, ou manter 20 e avisar a cliente proativamente quando você souber que vai passar. A segunda dá mais trabalho e gera muito menos reclamação — cliente avisada espera; cliente surpreendida abre chamado.

### Por que pagar o frete quase sempre compensa

Esse é o cálculo que resolve a dúvida:

| Lote fechado em | Peças | Frete | Custo extra por peça |
|---|---|---|---|
| R$300 | 14 | R$0 | R$0,00 |
| R$200 | 9 | ~R$30 | R$3,33 |
| R$150 | 7 | ~R$30 | R$4,29 |
| R$70 | 4 | ~R$30 | R$7,50 |

Numa peça que te dá **R$26 de lucro**, fechar o lote em R$150 custa R$4,29 — **16% do lucro daquela peça**. Uma cliente irritada, um estorno ou uma avaliação ruim custam muito mais que isso.

**A regra prática:** frete rateado é barato, atraso é caro. Na dúvida, feche o lote e pague.

### Duas alternativas que valem considerar

**Complete o lote com estoque seu.** Se o lote está em R$250 e travou, compre R$50 dos best sellers dela — peças que você venderia de qualquer jeito. Você ganha o frete grátis e ainda passa a ter pronta-entrega, que é o seu maior diferencial de prazo. Isso exige capital, então é pra quando já estiver lucrando.

**Não prometa data, prometa etapa.** Em vez de "chega em 15 dias", mostre à cliente onde a peça dela está: pedido confirmado → produção → a caminho de mim → reembalada → postada. Isso é muito mais fácil de cumprir e transforma a espera em acompanhamento. Você já tem os status no banco (seção 6) — é só expor numa página de rastreio.

### O que isso exige do sistema

Uma tabela de lotes, ligada aos pedidos:

```sql
create table lotes (
  id            uuid primary key default gen_random_uuid(),
  numero        serial unique,
  status        text not null default 'aberto',
  -- aberto → fechado → comprado → recebido → distribuido
  custo_total   numeric(10,2) default 0,   -- soma do atacado
  frete_pago    numeric(10,2) default 0,
  aberto_em     timestamptz default now(),
  fechado_em    timestamptz,
  comprado_em   timestamptz,
  recebido_em   timestamptz,
  pedido_lilly  text                        -- nº do pedido no site dela
);

alter table pedidos add column lote_id uuid references lotes(id);
```

E no admin, uma tela de lote que mostre em tempo real:

- Quanto falta para R$300
- **Há quantos dias úteis está o pedido mais antigo** ← o número que decide
- Lista de peças a comprar, agrupada por código (PL289, BRA31…), pronta pra copiar no site da Lilly
- Botão "fechar lote"

Essa tela é, na prática, o seu painel de operação diária. Vale construí-la bem.

---

## 6. Modelo de dados

A decisão central aqui: **separe o espelho da fornecedora do seu catálogo.** São duas tabelas diferentes.

Por quê? Porque o espelho é sobrescrito toda sincronização, e você não quer que uma mudança no site dela apague o seu texto, o seu preço ou tire uma peça do ar sem você saber. Você **escolhe** o que promover do espelho pro seu catálogo.

```sql
-- ESPELHO: sobrescrito a cada sincronização. Nunca venda direto daqui.
create table fornecedor_produtos (
  id                uuid primary key default gen_random_uuid(),
  sku_fornecedor    text unique not null,   -- identificador dela
  nome              text not null,
  descricao         text,
  custo             numeric(10,2) not null, -- quanto VOCÊ paga
  estoque           integer default 0,
  imagens_origem    text[],                 -- URLs originais
  url_produto       text,
  ativo             boolean default true,   -- sumiu do site dela = false
  visto_em          timestamptz default now()
);

-- SEU CATÁLOGO: você controla. Só isto aparece na loja.
create table produtos (
  id                  uuid primary key default gen_random_uuid(),
  fornecedor_produto_id uuid references fornecedor_produtos(id),
  slug                text unique not null,  -- /produto/anel-enlace-fino
  nome                text not null,         -- pode diferir do nome dela
  descricao           text,
  preco               numeric(10,2) not null, -- SEU preço de venda
  categoria           text not null,         -- aneis | colares | pulseiras | berloques
  metal               text not null,         -- Prata | Ouro
  imagens             text[],                -- caminhos no SEU storage
  publicado           boolean default false, -- nada vai ao ar sem você mandar
  destaque            boolean default false,
  criado_em           timestamptz default now()
);

create table variantes (
  id          uuid primary key default gen_random_uuid(),
  produto_id  uuid references produtos(id) on delete cascade,
  tamanho     text not null,            -- "16", "45cm", "Único"
  ajuste_preco numeric(10,2) default 0  -- se tamanho maior custa mais
);

create table pedidos (
  id              uuid primary key default gen_random_uuid(),
  numero          serial unique,          -- número curto e amigável: #1043
  status          text not null default 'aguardando_pagamento',
  -- aguardando_pagamento → pago → confirmado_fornecedor → em_producao
  --   → recebido_por_mim → enviado → entregue
  --   (ramos: cancelado, estornado, falha_estoque)

  cliente_nome    text not null,
  cliente_email   text not null,
  cliente_tel     text,
  cliente_cpf     text,

  endereco        jsonb not null,         -- cep, rua, numero, compl, bairro, cidade, uf

  subtotal        numeric(10,2) not null,
  frete           numeric(10,2) not null default 0,
  desconto        numeric(10,2) not null default 0,
  total           numeric(10,2) not null,

  gravacao        text,                   -- texto que a cliente pediu
  observacoes     text,                   -- suas anotações internas
  codigo_rastreio text,

  criado_em       timestamptz default now(),
  pago_em         timestamptz,
  enviado_em      timestamptz
);

-- CRÍTICO: congela o preço no momento da compra.
-- Nunca leia o preço de `produtos` pra mostrar um pedido antigo —
-- o preço muda e seu histórico financeiro vira ficção.
create table pedido_itens (
  id             uuid primary key default gen_random_uuid(),
  pedido_id      uuid references pedidos(id) on delete cascade,
  produto_id     uuid references produtos(id),
  nome_snapshot  text not null,           -- nome NAQUELE dia
  tamanho        text,
  quantidade     integer not null default 1,
  preco_unit     numeric(10,2) not null,  -- preço NAQUELE dia
  custo_unit     numeric(10,2) not null   -- custo NAQUELE dia → lucro real
);

create table pagamentos (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid references pedidos(id),
  mp_payment_id   text unique not null,   -- UNIQUE = proteção contra webhook duplicado
  status          text not null,          -- approved | pending | rejected | refunded
  metodo          text,                   -- pix | credit_card | debit_card
  parcelas        integer,
  valor           numeric(10,2) not null,
  taxa_mp         numeric(10,2),          -- quanto o MP ficou
  valor_liquido   numeric(10,2),          -- quanto caiu de verdade
  payload         jsonb,                  -- resposta completa, pra auditoria
  criado_em       timestamptz default now()
);

create table sincronizacoes (
  id             uuid primary key default gen_random_uuid(),
  iniciado_em    timestamptz default now(),
  finalizado_em  timestamptz,
  status         text,                    -- sucesso | erro | parcial
  encontrados    integer,
  novos          integer,
  atualizados    integer,
  sumidos        integer,
  erro           text
);
```

### Os três detalhes que parecem chatos e não são

**`pedido_itens.preco_unit` e `custo_unit`.** Congelar preço *e* custo no item é o que permite responder "quanto eu lucrei em julho?" seis meses depois. Se você só referenciar o produto, e o custo dela subir, seu histórico de lucro muda retroativamente e vira mentira.

**`pagamentos.mp_payment_id` com `unique`.** O Mercado Pago **reenvia o mesmo webhook várias vezes** — é o comportamento normal dele, não é bug. Sem essa constraint, você registra o mesmo pagamento 3 vezes e seu faturamento fica inflado. O banco te protege de graça.

**`produtos.publicado` começando em `false`.** Nada que a sincronização trouxer vai ao ar sozinho. Você revisa, define seu preço, escreve seu texto, e só então publica. Isso te salva do dia em que a fornecedora cadastrar algo estranho no site dela.

---

## 7. O fluxo de pedido, passo a passo

```
1. Cliente monta o carrinho (estado no navegador, sem servidor)
        ↓
2. Preenche dados e endereço, clica em "Finalizar"
        ↓
3. Front chama a API Go: `POST /checkout`
   enviando APENAS: [{produto_id, tamanho, quantidade}] + dados da cliente
   ⚠️ NUNCA envia preço
        ↓
4. A função:
   • busca o preço real de cada produto NO BANCO
   • recalcula o total do zero
   • confere se o estoque da fornecedora comporta
   • grava o pedido com status `aguardando_pagamento`
   • cria a preferência no Mercado Pago
   • devolve a URL de pagamento
        ↓
5. Cliente é redirecionada ao Mercado Pago e paga
        ↓
6. Mercado Pago chama seu webhook  ← ESTA é a fonte da verdade
        ↓
7. A função `webhook-mp`:
   • valida a assinatura x-signature (HMAC-SHA256)
   • consulta o pagamento na API do MP pelo ID (não confia no corpo recebido)
   • se aprovado → pedido vira `pago`, grava em `pagamentos`
   • dispara e-mail pra cliente e alerta pra você
        ↓
8. Você vê o pedido no /admin e compra na fornecedora
        ↓
9. Você atualiza o status conforme anda:
   confirmado_fornecedor → em_producao → recebido_por_mim → enviado
        ↓
10. Você reembala, gera etiqueta, preenche o rastreio, cliente recebe e-mail
```

### O ramo que vai acontecer: a fornecedora não tem a peça

Depois do passo 8, se ela disser que acabou:

1. Pedido vai para `falha_estoque`
2. Você fala com a cliente **antes** de qualquer coisa — oferecendo peça parecida ou estorno
3. Se for estorno, faz pelo painel do Mercado Pago e marca `estornado`
4. Marca o produto como indisponível pra não vender de novo

Deixe esse caminho pronto no admin desde a v1. Ele vai ser usado.

---

## 8. Segurança — as 6 armadilhas que pegam todo mundo

Leia esta seção duas vezes. Cada item aqui é dinheiro real saindo do seu bolso.

### 1. Tudo que começa com `VITE_` é público

O Vite **injeta essas variáveis dentro do arquivo JavaScript** que vai pro navegador. Qualquer pessoa abre o DevTools e lê. Não é "difícil de achar" — é texto puro no bundle.

```
✅ VITE_SUPABASE_URL           → pode, é público mesmo
✅ VITE_SUPABASE_ANON_KEY      → pode, é feita pra ser pública (o RLS protege)
❌ SUPABASE_SERVICE_ROLE_KEY   → NUNCA. Ela ignora todo o RLS
❌ MP_ACCESS_TOKEN             → NUNCA. Com ela se cria cobrança em seu nome
❌ MP_WEBHOOK_SECRET           → NUNCA
```

As três de baixo moram **só** nas variáveis de ambiente da API no Cloud Run. E `.env` no `.gitignore`, sempre.

### 2. Nunca confie em preço vindo do front-end

Se o seu checkout aceitar `{produto_id, preco: 289.00}`, alguém troca pra `preco: 1.00` no DevTools e compra sua joia por um real. Não é hipótese — é a primeira coisa que se testa numa loja.

**Regra:** o front manda **o que**, o servidor decide **quanto**. Sempre.

### 3. O webhook é a verdade, não o retorno da tela

Depois de pagar, o Mercado Pago redireciona a cliente pra uma URL de sucesso. **Nunca marque o pedido como pago por causa desse redirect** — qualquer um pode digitar essa URL no navegador.

Só o webhook confirma. E mesmo o webhook você não acredita de cara: ele te manda um ID, e **você consulta a API do Mercado Pago** com esse ID pra ver o status verdadeiro.

### 4. Valide a assinatura do webhook

O Mercado Pago manda um header `x-signature`. Sem validar, qualquer pessoa que descubra a URL do seu webhook manda "pagamento aprovado" e você despacha joia de graça.

Como funciona: você separa `ts` e `v1` do header, monta o template `id:[data.id];request-id:[x-request-id];ts:[ts];`, gera um HMAC-SHA256 com a sua chave secreta e compara com o `v1`. Se não bater, devolve 401 e não faz nada.

### 5. Webhooks chegam repetidos

O mesmo evento vem 2, 3, 5 vezes. Normal. A constraint `unique` em `mp_payment_id` já resolve — mas trate o erro de duplicata como "ok, já processei" e devolva 200, senão o MP vai continuar reenviando pra sempre.

### 6. RLS em todas as tabelas, negando por padrão

No Supabase, **tabela sem RLS ativo é tabela pública.** Com a chave anon (que está no bundle, lembra?), qualquer pessoa lê tudo — incluindo endereço e CPF das suas clientes. Isso é vazamento de dado pessoal e cai na LGPD.

```sql
alter table produtos    enable row level security;
alter table pedidos     enable row level security;
alter table pedido_itens enable row level security;
alter table pagamentos  enable row level security;
alter table fornecedor_produtos enable row level security;

-- Público lê SÓ produto publicado
create policy "vitrine publica" on produtos
  for select using (publicado = true);

-- Ninguém do lado público lê pedido. Nenhuma policy = ninguém passa.
-- A API Go conecta como dona do banco e ignora RLS por design.
```

Regra mental: **crie a tabela já com RLS ligado e sem nenhuma policy.** Depois libere só o que precisa. É muito mais seguro do que o contrário.

---

## 9. Precificação

Como você compra depois de vender, um erro de preço não some no volume — ele aparece direto no seu bolso, peça por peça.

### O modelo que você quer: markup sobre o atacado

Você trabalha com markup — 100%, 150%, 200% sobre o preço de atacado — e quer poder baixar pra 50% em promoção. O sistema tem que suportar isso de forma configurável, não hardcoded.

```
Preço base   = custo_atacado × (1 + markup/100)
Preço final  = preço base × (1 − desconto/100)
Lucro real   = preço final − custo_atacado − embalagem − taxa_gateway
```

**A embalagem e a taxa não entram no markup — e é exatamente aí que o lucro some.**

### Exemplo com uma peça real do catálogo dela

Pulseira Maya (PL46): atacado **R$23,00**, varejo dela R$32,90. Embalagem Mirava ~R$5,00. Crédito à vista (4,98%):

| Markup | Preço | Taxa MP | Lucro real | Margem |
|---|---|---|---|---|
| 50% | R$ 34,50 | R$ 1,72 | **R$ 4,78** | 14% |
| 100% | R$ 46,00 | R$ 2,29 | **R$ 15,71** | 34% |
| 150% | R$ 57,50 | R$ 2,86 | **R$ 26,64** | 46% |
| 200% | R$ 69,00 | R$ 3,44 | **R$ 37,56** | 54% |

**Três coisas que esse quadro mostra:**

**1. Markup de 50% é praticamente trabalhar de graça.** R$4,78 por peça. Uma devolução, um extravio ou uma peça com defeito apaga o lucro de cinco vendas. Se for fazer promoção agressiva, **150% é o piso seguro** — ali você ainda ganha R$26 e tem folga pra imprevisto.

**2. Cuidado com o teto de mercado.** Com 150% de markup a peça sai a R$57,50, enquanto a Lilly vende a mesma coisa a R$32,90 no varejo dela. A cliente que pesquisar no Google acha. Isso não te impede de cobrar mais — marca, curadoria, embalagem e atendimento valem dinheiro — mas significa que **você não está competindo por preço, e o site precisa justificar a diferença.** Guarde o varejo dela no banco e coloque um alerta no admin quando seu preço passar de 1,8× o dela.

**3. Markup fixo por produto não serve.** Peças baratas suportam markup maior (R$23 → R$69 parece razoável); peças caras não (R$120 → R$360 não vende). Configure o multiplicador **por faixa de custo**, com sobrescrita manual por produto.

### As taxas do Mercado Pago hoje

| Forma | Taxa | Quando cai |
|---|---|---|
| **Pix** | **0,99%** | na hora |
| Crédito à vista | 3,98% a 4,98% | 30 dias / na hora |
| Crédito 2x | 4,49% | conforme escolha |
| Crédito 12x | 12,49% | conforme escolha |

**Repare na diferença: Pix custa 0,99%, crédito em 12x custa 12,49%.** Onze pontos percentuais. Por isso o desconto de 5% no Pix que já está no seu site é uma decisão inteligente — mesmo dando o desconto, o Pix continua sendo sua venda mais lucrativa, e o dinheiro cai na hora (que é justamente quando você precisa dele pra comprar da fornecedora).

**Cuidado com o parcelamento.** Se você anuncia "6x sem juros" e a cliente parcela em 6, a taxa sai do seu lucro. Ou você embute isso no preço desde o começo, ou limita o parcelamento sem juros a 3x, ou repassa os juros. Decida antes de lançar — não depois.

### Configure isso no banco

```sql
create table regras_preco (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,          -- "padrão", "black friday", "dia das mães"
  markup_pct    numeric(5,1) not null,  -- 150.0
  desconto_pct  numeric(5,1) default 0, -- 20.0 em campanha
  custo_min     numeric(10,2) default 0,   -- faixa de custo onde a regra vale
  custo_max     numeric(10,2) default 99999,
  ativa         boolean default false,
  inicia_em     timestamptz,
  termina_em    timestamptz
);
```

Assim você cria a campanha de Dia das Mães com antecedência, define início e fim, e o preço volta sozinho ao normal. `produtos.preco` continua sendo o preço efetivo gravado — a regra só **sugere**, você aprova. Isso evita que um bug numa regra derrube o preço do catálogo inteiro.

**Importante:** quando o custo da Lilly mudar na sincronização, o admin deve te avisar **"a margem desta peça caiu de 46% para 31%"** — não recalcular o preço sozinho. Preço mudando sem você mandar é como se perde dinheiro sem perceber.

---

## 10. Fases de execução

Sequência pensada pra que **cada fase termine em algo funcionando**, não em metade de tudo.

### Fase 0 — Proteger o que existe · 1 dia

- [ ] `git init`, `.gitignore` conferido, primeiro commit
- [ ] Repositório **privado** no GitHub
- [ ] Conta Supabase + projeto criado
- [ ] Conta Cloudflare Pages
- [ ] Deploy do site como está (mesmo fake) — pra validar o pipeline cedo
- [ ] **Pedir a credencial de API da wBuy pra Lilly** (seção 4)

> Faça a última primeira. Se ela liberar a credencial, a Fase 5 encolhe de dias para horas — e você não quer descobrir isso depois de ter escrito um leitor de páginas inteiro.

### Fase 1 — Fundação de dados · 3 a 5 dias

- [ ] Criar as tabelas do item 5
- [ ] Ligar RLS em todas, com as policies
- [ ] Cadastrar 8 a 10 produtos **na mão** (sim, na mão — você precisa de dados reais pra testar antes de resolver a sincronização)
- [ ] Trocar `src/data/products.ts` por busca no Supabase
- [ ] Home e categoria lendo do banco

**Entrega:** site no ar mostrando produtos vindos do banco.

### Fase 2 — Página de produto e carrinho · 4 a 6 dias

- [ ] Rota `/produto/:slug`
- [ ] Galeria, seletor de tamanho, campo de gravação, prazo, botão de compra
- [ ] Reescrever `CartContext` com itens de verdade (adicionar, remover, quantidade, total)
- [ ] Persistir carrinho no `localStorage`
- [ ] `CartDrawer` mostrando o carrinho real (hoje mostra um item fixo de exemplo)

**Entrega:** dá pra montar um carrinho de verdade. Ainda não paga.

### Fase 3 — Checkout e pagamento · 5 a 8 dias · ⚠️ a fase crítica

- [ ] Conta Mercado Pago, credenciais de **teste**
- [ ] Formulário de dados + endereço (com busca de CEP via ViaCEP, gratuito)
- [ ] Handler `POST /checkout` — **recalculando preço no servidor**
- [ ] Handler `POST /webhook/mercadopago` — **com validação de assinatura**
- [ ] Páginas de retorno: sucesso, pendente, falha
- [ ] Testar exaustivamente com os cartões de teste do MP
- [ ] Testar webhook duplicado, pagamento recusado, pagamento pendente (Pix não pago)
- [ ] Trocar pras credenciais de produção
- [ ] **Fazer uma compra real de R$ 5,00 no seu próprio cartão**

**Entrega:** a loja vende.

> Não pule o teste com dinheiro real. Ambiente de teste do Mercado Pago não pega tudo.

### Fase 4 — Painel admin · 5 a 7 dias

- [ ] Supabase Auth, um usuário (você), rota `/admin` protegida
- [ ] **Dashboard:** vendas do dia, do mês, ticket médio, lucro estimado, pedidos por status
- [ ] **Lista de pedidos** com filtro por status e busca
- [ ] **Detalhe do pedido:** itens, cliente, endereço, gravação, pagamento — com botão pra avançar status
- [ ] **Marcar como enviado** + campo de rastreio
- [ ] **Gestão de produtos:** editar preço, texto, publicar/despublicar
- [ ] **Tela de lote** (seção 5): quanto falta pra R$300, idade do pedido mais antigo, lista de códigos pra copiar no site da Lilly, botão de fechar lote
- [ ] **Regras de preço:** markup por faixa, campanhas com início e fim
- [ ] Alerta (e-mail ou Telegram) quando entra pedido novo e quando um lote passa do teto de dias

**Entrega:** você opera a loja sem abrir o Supabase.

> **Atalho legítimo:** enquanto o admin não existe, use o **Table Editor do próprio Supabase** pra ver e editar pedidos. É feio, mas funciona no dia um e te deixa lançar antes.

### Fase 5 — Sincronização com a fornecedora · 4 a 10 dias

*(Prazo depende inteiramente da resposta dela — daí ter mandado as perguntas na Fase 0.)*

- [ ] Tarefa `POST /tarefas/sincronizar` lendo sitemap + páginas (plano B)
- [ ] Baixar imagens → converter pra `.webp` → subir no Storage
- [ ] Agendar com `pg_cron` a cada 6 horas
- [ ] Gravar cada execução em `sincronizacoes`
- [ ] Tela no admin: "novos produtos encontrados" → você revisa e publica
- [ ] Alerta pra você quando a sincronização falhar 2 vezes seguidas

**Entrega:** catálogo se mantém sozinho.

### Fase 6 — Acabamento e crescimento · contínuo

- [ ] SEO: meta tags por produto, Open Graph, `sitemap.xml`, schema.org de Product
- [ ] Google Analytics ou Plausible
- [ ] Pixel do Meta (se for anunciar)
- [ ] Cálculo de frete real (Melhor Envio tem API gratuita, você paga só a etiqueta)
- [ ] E-mails transacionais (Resend: 3.000/mês grátis)
- [ ] Recuperação de carrinho abandonado
- [ ] Cupons de desconto
- [ ] Avaliações de clientes reais (hoje os depoimentos são fictícios — **troque antes de lançar**)

---

## 11. Custos

### Começando (R$ 0/mês)

| Serviço | Plano | Limite relevante |
|---|---|---|
| Cloudflare Pages | Grátis | banda ilimitada, 500 builds/mês |
| Supabase | Grátis | 500 MB banco, 1 GB storage, 5 GB saída |
| Mercado Pago | Sem mensalidade | só a taxa por venda |
| GitHub | Grátis | repositório privado |
| Resend | Grátis | 3.000 e-mails/mês |
| ViaCEP | Grátis | consulta de CEP |
| Domínio `.com.br` | **~R$ 40/ano** | Registro.br |

**Custo fixo real: ~R$ 3,50/mês** (só o domínio). O resto é taxa sobre venda — você só paga se vender.

### Quando escalar

| Gatilho | Custo |
|---|---|
| Passar de 1 GB de imagens | Supabase Pro ~US$ 25/mês |
| Site parar de dormir sozinho | já resolvido com tráfego real |

Você provavelmente roda **o primeiro ano inteiro** no grátis.

---

## 12. Riscos e pontos legais

> Não sou advogado nem contador. Isto é levantamento de pontos pra você verificar, não parecer jurídico.

### CPF vs. MEI

Você está como pessoa física. Dá pra receber pelo Mercado Pago com CPF e começar. Mas:

- **Você não emite nota fiscal.** Alguma clientes vão pedir.
- **A Receita enxerga tudo.** Movimentação recorrente em conta de pessoa física com cara de comércio é exatamente o que os cruzamentos procuram.
- **Taxas de CNPJ costumam ser melhores**, e algumas condições (como Pix parcelado com taxa zero) são exclusivas de CNPJ.

**MEI em 2026:** DAS de **R$ 82,05/mês** pra comércio, teto de **R$ 81.000/ano** (~R$ 6.750/mês). Abertura gratuita e online no Portal do Empreendedor.

Minha leitura: comece vendendo no CPF pra validar se dá dinheiro — que é exatamente sua estratégia de não investir antes do lucro. Mas **abra o MEI assim que a receita cobrir o DAS com folga.** R$ 82 por mês compra tranquilidade fiscal, nota fiscal e taxas melhores. Não deixe pra quando virar problema.

### ⚠️ O texto do seu FAQ tem um risco jurídico

O `data/content.ts` diz hoje:

> "Peças personalizadas não têm troca por desistência"

O **art. 49 do CDC** dá 7 dias de arrependimento em qualquer compra fora de loja física, sem justificativa, com devolução integral **incluindo frete**. Existe entendimento de que produto personalizado é exceção — mas **não é automático**, depende do caso concreto, e joia com gravação é bem mais defensável do que joia de catálogo sem personalização nenhuma.

Como a maioria das suas peças é de catálogo (mesmo sendo sob encomenda), afirmar categoricamente que não tem devolução é arriscado. Sugestão de redação:

> "Você tem 7 dias corridos após o recebimento para desistir da compra, conforme o Código de Defesa do Consumidor. Peças com gravação personalizada, por serem feitas exclusivamente para você, não podem ser revendidas — nesses casos, entre em contato que a gente encontra a melhor solução juntas."

Isso te protege sem prometer o que você não pode cumprir. **Vale passar num advogado antes de publicar.**

### Outras pendências antes de lançar

- **LGPD:** você vai guardar nome, CPF, endereço e telefone. Precisa de política de privacidade no rodapé e de RLS bem feito (item 7.6).
- **Conteúdo fictício no ar:** os 6 depoimentos, os números de avaliação e o "@miravajoias" são inventados. Depoimento falso é publicidade enganosa. **Tire tudo antes de lançar** e traga de volta conforme clientes reais avaliarem.
- **Prazo prometido:** troque "7 a 15 dias úteis" por "10 a 20 dias úteis" em `data/content.ts` e no `FAQ` — e só sustente isso com o teto de tempo do lote (seção 5). Prazo furado em joia (presente, data comemorativa) gera reclamação e chargeback.
- **Direito de imagem das fotos:** resolvido pela pergunta 1 à Lilly.
- **Descrição das peças:** as descrições da Lilly são longas e otimizadas pro SEO dela. Copiar literal te faz competir com ela pelo mesmo texto no Google e o site perde a voz da Mirava. Reescreva no seu tom — o briefing da marca pede "delicado, próximo, feminino".

### Riscos operacionais

| Risco | Gravidade | Como reduzir |
|---|---|---|
| **Lote não fecha e o prazo estoura** | **Alta** | Teto de 5 dias úteis, fecha e paga o frete (seção 5) |
| Lilly muda o site e a sync quebra | Alta | Credencial de API resolve; senão, alerta automático |
| Vender peça que ela não tem mais | Alta | Margem de segurança no estoque + fluxo de estorno pronto |
| Bug marca pedido como pago sem pagamento | **Crítica** | Validar assinatura + reconsultar a API do MP |
| Lilly aumenta preço e você vende no antigo | Média | Sync atualiza custo e te avisa quando a margem cair |
| Cliente acha a peça mais barata no site da Lilly | Média | Não competir por preço; a marca e a curadoria são o valor |
| Depender de uma fornecedora só | Média | Prospectar uma segunda desde já |
| Chargeback | Média | Guardar comprovante de envio e rastreio sempre |

---

## 13. Checklist antes de abrir pro público

**Técnico**

- [ ] Compra real de teste concluída com sucesso
- [ ] Webhook validando assinatura, testado com evento duplicado
- [ ] RLS ligado em todas as tabelas — tente ler `pedidos` com a chave anon e confirme que **falha**
- [ ] Nenhum segredo no bundle: rode `npm run build` e faça `grep -r "service_role\|APP_USR" dist/` — tem que voltar vazio
- [ ] `npm run build` passa sem erro de TypeScript
- [ ] Testado no celular (a maior parte do tráfego vai ser mobile)
- [ ] Página 404 e estados de erro tratados

**Conteúdo**

- [ ] Depoimentos fictícios removidos
- [ ] Contatos reais no rodapé (hoje o telefone é `(11) 98888-0000`)
- [ ] Instagram real linkado
- [ ] Prazo de entrega conferido com a fornecedora
- [ ] Fotos comprimidas em `.webp`

**Legal**

- [ ] Política de privacidade publicada
- [ ] Termos de uso publicados
- [ ] Política de trocas revisada (item 11)
- [ ] Autorização de uso das fotos registrada

**Operacional**

- [ ] Você sabe exatamente o que fazer quando entra o primeiro pedido
- [ ] Embalagens compradas
- [ ] Conta no Melhor Envio criada
- [ ] Alerta de pedido novo funcionando no seu celular

---

## 14. Se eu tivesse que resumir em cinco frases

1. **Faça `git init` hoje.** Você já perdeu trabalho uma vez.
2. **Peça a credencial de API da wBuy pra Lilly antes de escrever código de sincronização.** É um pedido de dois minutos que pode economizar semanas.
3. **Preço se calcula no servidor, pagamento se confirma por webhook assinado.** Esses dois itens são a diferença entre uma loja e um prejuízo.
4. **Bote teto de tempo no lote.** Frete rateado é barato, atraso é caro. É o único jeito de sustentar 10 a 20 dias úteis.
5. **Lance com o admin feio.** Table Editor do Supabase funciona no dia um; painel bonito é fase 4. Vender antes, polir depois.

---

## Fontes

- [Taxas Mercado Pago 2026](https://www.calculadoradetaxas.com.br/mercado-pago/taxas) · [Custo de Pix e QR Code](https://www.mercadopago.com.br/blog/quanto-custa-receber-pagamentos-via-pix-e-codigo-qr)
- [Webhooks e assinatura secreta — Mercado Pago Developers](https://www.mercadopago.com.br/developers/pt/news/2024/01/11/Webhooks-Notifications-Simulator-and-Secret-Signature) · [Documentação de Webhooks](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks)
- [Limites do plano grátis do Supabase em 2026](https://uibakery.io/blog/supabase-pricing) · [Pausa por inatividade](https://www.itpathsolutions.com/supabase-free-tier-limits)
- [Vercel Hobby: restrição de uso comercial](https://schematichq.com/blog/vercel-pricing) · [Comparativo Vercel/Netlify/Cloudflare](https://coderfile.io/blog/vercel-vs-netlify-vs-cloudflare-2026)
- [Art. 49 do CDC — direito de arrependimento](https://juridico.ai/direito-civil/direito-de-arrependimento-art-49-cdc/) · [Quando o consumidor não pode desistir — Migalhas](https://www.migalhas.com.br/depeso/435789/quando-o-consumidor-nao-pode-desistir-da-compra)
- [Tabela MEI 2026 — DAS e limites](https://www.balancinho.com.br/tabela-mei) · [Limite de faturamento MEI 2026](https://www.contabilizei.com.br/contabilidade-online/faturamento-mei-2026/)
- [Documentação da API wBuy](https://documenter.getpostman.com/view/4141833/RWTsquyN/) · [Recursos de API — doc-templates wBuy](https://www.doc-templates.wbuy.com.br/recursos/api/)
- Dados da fornecedora coletados em [uselilly.com](https://www.uselilly.com/) — preços de atacado, sitemap, prazo de postagem e plataforma (11/08/2026)
