-- 02 · Catálogo
--
-- Duas camadas separadas de propósito:
--
--   fornecedor_produtos  ESPELHO. A sincronização sobrescreve isto a cada
--                        rodada. É o que a Lilly diz que existe.
--   produtos             SEU CATÁLOGO. Você controla nome, texto e preço.
--                        A sincronização NUNCA escreve aqui direto — só
--                        sugere, via as colunas de sugestão.
--
-- O motivo da separação: uma mudança no site da Lilly não pode apagar o seu
-- texto nem tirar uma peça do ar sem você saber.

-- ---------------------------------------------------------------------------
create table public.fornecedores (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  site          text not null,
  sitemap_url   text,
  -- razão entre atacado e varejo quando a página não mostra o atacado.
  -- 0.70 confirmado em 5 amostras da Lilly (PL46, PL20, PL82, PL103, PL269).
  razao_atacado numeric(4,3) not null default 0.700,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger t_fornecedores_atualizado
  before update on public.fornecedores
  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- ESPELHO — sobrescrito pela sincronização. Não venda a partir daqui.
-- ---------------------------------------------------------------------------
create table public.fornecedor_produtos (
  id                    uuid primary key default gen_random_uuid(),
  fornecedor_id         uuid not null references public.fornecedores(id) on delete cascade,

  sku                   text not null,              -- "PL46" — o código dela
  url                   text not null,
  nome                  text not null,
  descricao             text,
  garantia              text,

  custo_centavos        integer not null check (custo_centavos > 0),
  varejo_centavos       integer check (varejo_centavos >= 0),
  -- true quando o atacado foi lido da página; false quando veio de
  -- varejo × razao_atacado (peças de coleção nova não exibem atacado).
  custo_confirmado      boolean not null default false,

  -- A Lilly NÃO publica quantidade em estoque. Só dá para saber se dá ou não
  -- para comprar, pela presença do botão. Por isso é boolean, não integer:
  -- modelar como número seria inventar precisão que o dado não tem.
  disponivel            boolean not null default true,

  imagens_origem        text[] not null default '{}',
  avaliacao             numeric(2,1),
  qtd_avaliacoes        integer,

  visto_em              timestamptz not null default now(),
  sumido_em             timestamptz,                -- deixou de aparecer no sitemap
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),

  constraint uq_fornecedor_sku unique (fornecedor_id, sku)
);

create index ix_fp_disponivel on public.fornecedor_produtos (fornecedor_id, disponivel);
create index ix_fp_visto      on public.fornecedor_produtos (visto_em desc);

create trigger t_fp_atualizado
  before update on public.fornecedor_produtos
  for each row execute function public.tocar_atualizado_em();

comment on column public.fornecedor_produtos.disponivel is
  'Lida do botão de compra da página. A Lilly não publica quantidade — não invente número aqui.';

-- ---------------------------------------------------------------------------
-- SEU CATÁLOGO
-- ---------------------------------------------------------------------------
create table public.produtos (
  id                      uuid primary key default gen_random_uuid(),
  fornecedor_produto_id   uuid unique references public.fornecedor_produtos(id) on delete set null,

  slug                    text not null unique,
  nome                    text not null,
  descricao               text,

  -- O preço que a cliente paga. Fonte da verdade da vitrine.
  preco_centavos          integer not null check (preco_centavos > 0),
  -- Custo congelado na última sincronização, para cálculo de margem.
  custo_centavos          integer not null check (custo_centavos >= 0),

  -- Precificação automática: quando true, a sincronização recalcula
  -- preco_centavos aplicando o markup. O disjuntor da migration 06 impede
  -- que uma variação absurda (extração quebrada) seja aplicada.
  preco_automatico        boolean not null default true,
  markup_pct              numeric(6,2) not null default 200.00 check (markup_pct >= 0),

  -- Sugestão pendente quando o disjuntor barra a atualização automática.
  preco_sugerido_centavos integer,
  sugestao_motivo         text,

  categoria               text not null check (categoria in
                            ('aneis','colares','pulseiras','berloques','brincos','conjuntos','outros')),
  metal                   text not null check (metal in ('prata','ouro')),

  imagens                 text[] not null default '{}',   -- caminhos no SEU Storage
  publicado               boolean not null default false, -- nada vai ao ar sozinho
  destaque                boolean not null default false,

  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);

create index ix_produtos_vitrine   on public.produtos (publicado, categoria) where publicado;
create index ix_produtos_destaque  on public.produtos (destaque) where publicado and destaque;
create index ix_produtos_pendentes on public.produtos (preco_sugerido_centavos)
  where preco_sugerido_centavos is not null;

create trigger t_produtos_atualizado
  before update on public.produtos
  for each row execute function public.tocar_atualizado_em();

comment on table public.produtos is
  'Catálogo da Mirava. A sincronização nunca escreve aqui direto — ver disjuntor na migration 06.';

-- ---------------------------------------------------------------------------
-- Variantes (tamanhos)
-- ---------------------------------------------------------------------------
create table public.produto_variantes (
  id                    uuid primary key default gen_random_uuid(),
  produto_id            uuid not null references public.produtos(id) on delete cascade,
  tamanho               text not null,                    -- "16", "45cm", "Único"
  ajuste_preco_centavos integer not null default 0,
  disponivel            boolean not null default true,
  ordem                 smallint not null default 0,

  constraint uq_variante unique (produto_id, tamanho)
);

create index ix_variantes_produto on public.produto_variantes (produto_id);
