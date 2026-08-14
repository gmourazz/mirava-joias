-- 05 · Regras de preço e registro de sincronização

-- ---------------------------------------------------------------------------
-- Campanhas de preço com início e fim.
-- Você monta o Dia das Mães com antecedência e o preço volta sozinho depois.
-- A regra SUGERE; quem grava preco_centavos é você (ou o disjuntor da 06).
-- ---------------------------------------------------------------------------
create table public.regras_preco (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  markup_pct         numeric(6,2) not null check (markup_pct >= 0),
  desconto_pct       numeric(5,2) not null default 0 check (desconto_pct between 0 and 90),

  -- faixa de custo em que a regra vale — peça barata suporta markup maior
  custo_min_centavos integer not null default 0,
  custo_max_centavos integer not null default 2147483647,

  categoria          text,          -- null = todas
  ativa              boolean not null default false,
  inicia_em          timestamptz,
  termina_em         timestamptz,

  criado_em          timestamptz not null default now(),

  constraint ck_faixa_custo check (custo_max_centavos >= custo_min_centavos),
  constraint ck_janela      check (termina_em is null or inicia_em is null
                                   or termina_em > inicia_em)
);

create index ix_regras_ativas on public.regras_preco (ativa, inicia_em, termina_em)
  where ativa;

-- ---------------------------------------------------------------------------
-- Log de cada rodada da sincronização.
-- É aqui que você descobre que o layout da Lilly mudou — antes da cliente
-- descobrir por você.
-- ---------------------------------------------------------------------------
create table public.sincronizacoes (
  id             uuid primary key default gen_random_uuid(),
  fornecedor_id  uuid references public.fornecedores(id) on delete set null,

  status         text not null default 'rodando' check (status in
                   ('rodando','sucesso','parcial','erro')),

  urls_no_sitemap integer not null default 0,
  processados    integer not null default 0,
  novos          integer not null default 0,
  atualizados    integer not null default 0,
  falhas         integer not null default 0,
  sumidos        integer not null default 0,
  precos_travados integer not null default 0,   -- barrados pelo disjuntor

  erro           text,
  iniciado_em    timestamptz not null default now(),
  finalizado_em  timestamptz
);

create index ix_sync_recentes on public.sincronizacoes (iniciado_em desc);

-- Falhas item a item, para você ver qual seletor quebrou.
create table public.sincronizacao_falhas (
  id          bigserial primary key,
  sync_id     uuid not null references public.sincronizacoes(id) on delete cascade,
  url         text not null,
  motivo      text not null,
  criado_em   timestamptz not null default now()
);

create index ix_sync_falhas on public.sincronizacao_falhas (sync_id);

comment on column public.sincronizacoes.precos_travados is
  'Quantos preços o disjuntor barrou por variação suspeita. Se for alto, o extrator quebrou.';
