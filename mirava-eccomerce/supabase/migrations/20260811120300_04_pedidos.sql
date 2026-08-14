-- 04 · Lotes, pedidos, itens e pagamentos
--
-- O modelo da Mirava: a cliente paga primeiro, os pedidos pagos se acumulam
-- num LOTE, e o lote é comprado na Lilly quando bate R$300 (frete grátis
-- atacado, Sudeste) OU quando o pedido mais antigo completa 5 dias úteis —
-- o que vier primeiro. Despacho semanal, às segundas.

-- ---------------------------------------------------------------------------
create table public.lotes (
  id                  uuid primary key default gen_random_uuid(),
  numero              serial not null unique,

  status              text not null default 'aberto' check (status in
                        ('aberto','fechado','comprado','recebido','distribuido','cancelado')),

  custo_total_centavos integer not null default 0 check (custo_total_centavos >= 0),
  frete_pago_centavos  integer not null default 0 check (frete_pago_centavos >= 0),

  pedido_lilly        text,          -- nº do pedido no site da Lilly
  observacoes         text,

  aberto_em           timestamptz not null default now(),
  fechado_em          timestamptz,
  comprado_em         timestamptz,
  recebido_em         timestamptz,
  atualizado_em       timestamptz not null default now()
);

create trigger t_lotes_atualizado
  before update on public.lotes
  for each row execute function public.tocar_atualizado_em();

-- Só pode existir UM lote aberto por vez. Índice parcial garante isso no
-- banco — sem depender de a aplicação lembrar.
create unique index uq_lote_aberto on public.lotes ((true)) where status = 'aberto';

-- ---------------------------------------------------------------------------
create table public.pedidos (
  id              uuid primary key default gen_random_uuid(),
  numero          serial not null unique,      -- número curto e amigável: #1043

  -- Anulável de propósito. Hoje a loja exige conta (config/loja.ts), mas
  -- essa é uma decisão de produto reversível. Modelar como NOT NULL faria
  -- do "checkout de visitante" uma migração em vez de uma flag.
  user_id         uuid references auth.users(id) on delete set null,
  lote_id         uuid references public.lotes(id) on delete set null,

  status          text not null default 'aguardando_pagamento' check (status in (
                    'aguardando_pagamento','pago','no_lote','comprado_fornecedor',
                    'recebido_por_mim','enviado','entregue',
                    'cancelado','estornado','falha_estoque')),

  cliente_nome    text not null,
  cliente_email   text not null,
  cliente_tel     text,
  cliente_cpf     text,

  endereco        jsonb not null,              -- cópia congelada, não FK:
                                               -- se ela editar o endereço depois,
                                               -- o pedido antigo não pode mudar
  subtotal_centavos integer not null check (subtotal_centavos >= 0),
  frete_centavos    integer not null default 0 check (frete_centavos >= 0),
  desconto_centavos integer not null default 0 check (desconto_centavos >= 0),
  total_centavos    integer not null check (total_centavos >= 0),

  gravacao        text,
  observacoes     text,                        -- suas anotações internas
  codigo_rastreio text,

  criado_em       timestamptz not null default now(),
  pago_em         timestamptz,
  enviado_em      timestamptz,
  atualizado_em   timestamptz not null default now(),

  constraint ck_total_coerente
    check (total_centavos = subtotal_centavos + frete_centavos - desconto_centavos)
);

create index ix_pedidos_user   on public.pedidos (user_id, criado_em desc);
create index ix_pedidos_status on public.pedidos (status, criado_em);
create index ix_pedidos_lote   on public.pedidos (lote_id);

create trigger t_pedidos_atualizado
  before update on public.pedidos
  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- Itens: preço E custo congelados no momento da compra.
--
-- Por que congelar os dois: sem isso, quando a Lilly reajustar o preço, todo
-- o seu histórico de lucro muda retroativamente e o fechamento do mês passado
-- vira ficção.
-- ---------------------------------------------------------------------------
create table public.pedido_itens (
  id                  uuid primary key default gen_random_uuid(),
  pedido_id           uuid not null references public.pedidos(id) on delete cascade,
  produto_id          uuid references public.produtos(id) on delete set null,

  nome_snapshot       text not null,
  sku_fornecedor      text,               -- para você copiar no site da Lilly
  tamanho             text,
  quantidade          integer not null check (quantidade > 0),

  preco_unit_centavos integer not null check (preco_unit_centavos >= 0),
  custo_unit_centavos integer not null check (custo_unit_centavos >= 0)
);

create index ix_itens_pedido  on public.pedido_itens (pedido_id);
create index ix_itens_produto on public.pedido_itens (produto_id);

-- ---------------------------------------------------------------------------
-- Pagamentos
--
-- O unique em mp_payment_id é a proteção de idempotência: o Mercado Pago
-- reenvia o mesmo webhook várias vezes (é o comportamento normal dele).
-- Sem essa constraint, o mesmo pagamento entra 3 vezes e seu faturamento
-- fica inflado.
-- ---------------------------------------------------------------------------
create table public.pagamentos (
  id                    uuid primary key default gen_random_uuid(),
  pedido_id             uuid not null references public.pedidos(id) on delete cascade,

  mp_payment_id         text not null unique,
  status                text not null,        -- approved | pending | rejected | refunded ...
  metodo                text,                 -- pix | credit_card | debit_card
  parcelas              smallint,

  valor_centavos        integer not null check (valor_centavos >= 0),
  taxa_centavos         integer,
  liquido_centavos      integer,

  payload               jsonb,                -- resposta completa, para auditoria
  criado_em             timestamptz not null default now()
);

create index ix_pagamentos_pedido on public.pagamentos (pedido_id);

-- ---------------------------------------------------------------------------
-- Histórico. Alimenta a linha do tempo no admin e salva sua pele quando
-- precisar entender "por que esse pedido está nesse estado?".
-- ---------------------------------------------------------------------------
create table public.eventos_pedido (
  id         bigserial primary key,
  pedido_id  uuid not null references public.pedidos(id) on delete cascade,
  de_status  text,
  para_status text not null,
  origem     text not null default 'sistema',   -- sistema | admin | webhook | cron
  detalhe    text,
  criado_em  timestamptz not null default now()
);

create index ix_eventos_pedido on public.eventos_pedido (pedido_id, criado_em desc);
