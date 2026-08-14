-- ============================================================
-- TODAS AS MIGRATIONS DA MIRAVA, EM ORDEM
--
-- Plano B, para quando a CLI não conecta.
-- Cole ESTE ARQUIVO INTEIRO no SQL Editor do Supabase e execute.
-- Depois rode verificar.sql para conferir.
--
-- Gerado em: 11/08/2026 22:27
-- ============================================================


-- ┌──────────────────────────────────────────────────────────
-- │ 20260811120000_01_base.sql
-- └──────────────────────────────────────────────────────────

-- 01 · Fundação: extensões e helpers usados por todas as outras migrations.
--
-- Convenções deste banco:
--   • Dinheiro é SEMPRE integer em centavos, com sufixo _centavos. Nunca float.
--   • Datas são timestamptz. O fuso de referência do negócio é America/Sao_Paulo.
--   • Status são text + CHECK (não enum) — adicionar um status novo é só alterar
--     a constraint, sem a dor de ALTER TYPE fora de transação.

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_cron";       -- agendamento da sincronização
create extension if not exists "pg_net";        -- chamar Edge Function pelo cron

-- ---------------------------------------------------------------------------
-- atualizado_em automático
-- ---------------------------------------------------------------------------
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

comment on function public.tocar_atualizado_em is
  'Trigger genérico: mantém atualizado_em em dia. Use com before update.';

-- ---------------------------------------------------------------------------
-- Dias úteis
-- ---------------------------------------------------------------------------
-- Conta dias úteis completos decorridos desde um instante até agora.
-- Usado pela regra do teto do lote (fecha quando o pedido mais antigo
-- completa N dias úteis).
--
-- LIMITAÇÃO CONHECIDA: ignora feriados nacionais. Para a regra de lote isso
-- é aceitável — errar por um dia a favor da cliente não causa problema.
-- Se um dia precisar de precisão, crie uma tabela `feriados` e desconte aqui.
create or replace function public.dias_uteis_desde(inicio timestamptz)
returns integer
language sql
stable
as $$
  select greatest(0, count(*)::int - 1)
  from generate_series(
    (inicio at time zone 'America/Sao_Paulo')::date,
    (now()   at time zone 'America/Sao_Paulo')::date,
    interval '1 day'
  ) as d
  where extract(isodow from d) < 6;
$$;

comment on function public.dias_uteis_desde is
  'Dias úteis completos entre o instante dado e agora, fuso de São Paulo. Ignora feriados.';

-- ---------------------------------------------------------------------------
-- Slug
-- ---------------------------------------------------------------------------
-- Remoção de acentos sem depender da extensão unaccent (que exige permissão
-- de superusuário em alguns planos). translate resolve o português inteiro.
-- Precisa vir ANTES de gerar_slug: o Postgres valida o corpo das funções SQL
-- no momento da criação, então uma função que ainda não existe quebra aqui.
create or replace function public.unaccent_simples(texto text)
returns text
language sql
immutable
as $$
  select translate(
    texto,
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  );
$$;

-- "Pulseira Prata - Riviera Cristal" -> "pulseira-prata-riviera-cristal"
create or replace function public.gerar_slug(texto text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(public.unaccent_simples(texto)),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
$$;


-- ┌──────────────────────────────────────────────────────────
-- │ 20260811120100_02_catalogo.sql
-- └──────────────────────────────────────────────────────────

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


-- ┌──────────────────────────────────────────────────────────
-- │ 20260811120200_03_contas.sql
-- └──────────────────────────────────────────────────────────

-- 03 · Contas de cliente
--
-- Supabase gerencia auth.users. Aqui mora só o que é da Mirava.
--
-- ATENÇÃO ao papel de admin: ele vive em tabela própria, NUNCA em
-- user_metadata. O próprio usuário consegue editar user_metadata via API —
-- guardar {role:'admin'} lá significa que qualquer cliente cadastrada vira
-- administradora com uma chamada.

create table public.perfis (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text not null default '',
  telefone      text,
  cpf           text,
  aceita_email  boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger t_perfis_atualizado
  before update on public.perfis
  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- Perfil criado pelo banco, não pelo front-end.
-- Se a criação dependesse de uma chamada do cliente e ela falhasse, você
-- ficaria com usuário sem perfil — um estado inválido difícil de detectar.
-- ---------------------------------------------------------------------------
create or replace function public.ao_criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',   -- vem preenchido no login Google
      new.raw_user_meta_data ->> 'name',
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger t_ao_criar_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario();

-- ---------------------------------------------------------------------------
create table public.enderecos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  apelido      text,
  destinatario text not null,
  cep          text not null check (cep ~ '^\d{5}-?\d{3}$'),
  rua          text not null,
  numero       text not null,
  complemento  text,
  bairro       text not null,
  cidade       text not null,
  uf           char(2) not null check (uf ~ '^[A-Z]{2}$'),
  principal    boolean not null default false,
  criado_em    timestamptz not null default now()
);

create index ix_enderecos_user on public.enderecos (user_id);

-- Só um endereço principal por pessoa.
create unique index uq_endereco_principal
  on public.enderecos (user_id) where principal;

-- ---------------------------------------------------------------------------
create table public.favoritos (
  user_id    uuid not null references auth.users(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  criado_em  timestamptz not null default now(),
  primary key (user_id, produto_id)
);

create index ix_favoritos_produto on public.favoritos (produto_id);

-- ---------------------------------------------------------------------------
-- Admin. Uma linha aqui = acesso total. Adicione a si mesma manualmente:
--   insert into admins (user_id) values ('<seu uuid de auth.users>');
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);

create or replace function public.eh_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;

comment on function public.eh_admin is
  'Papel de admin por tabela. Nunca use user_metadata para isso — o usuário edita esse campo.';


-- ┌──────────────────────────────────────────────────────────
-- │ 20260811120300_04_pedidos.sql
-- └──────────────────────────────────────────────────────────

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


-- ┌──────────────────────────────────────────────────────────
-- │ 20260811120400_05_precos_sync.sql
-- └──────────────────────────────────────────────────────────

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


-- ┌──────────────────────────────────────────────────────────
-- │ 20260811120500_06_funcoes.sql
-- └──────────────────────────────────────────────────────────

-- 06 · Regras de negócio no banco
--
-- O que está aqui é o que precisa valer MESMO se a aplicação tiver bug:
-- transição de status, lote único, e o disjuntor de preço.

-- ---------------------------------------------------------------------------
-- Máquina de estados do pedido
-- ---------------------------------------------------------------------------
create or replace function public.transicao_valida(de text, para text)
returns boolean
language sql
immutable
as $$
  select case de
    when 'aguardando_pagamento' then para in ('pago','cancelado')
    when 'pago'                 then para in ('no_lote','estornado','falha_estoque')
    when 'no_lote'              then para in ('comprado_fornecedor','falha_estoque','pago')
    when 'comprado_fornecedor'  then para in ('recebido_por_mim','falha_estoque')
    when 'recebido_por_mim'     then para in ('enviado')
    when 'enviado'              then para in ('entregue')
    when 'entregue'             then false
    when 'cancelado'            then false
    when 'estornado'            then false
    when 'falha_estoque'        then para in ('estornado','no_lote')
    else false
  end;
$$;

create or replace function public.checar_transicao()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not public.transicao_valida(old.status, new.status) then
      raise exception
        'Transição de status inválida: % -> % (pedido %)',
        old.status, new.status, old.numero
        using errcode = 'check_violation';
    end if;

    insert into public.eventos_pedido (pedido_id, de_status, para_status, origem)
    values (new.id, old.status, new.status,
            coalesce(current_setting('app.origem', true), 'sistema'));

    if new.status = 'pago'    and new.pago_em    is null then new.pago_em    := now(); end if;
    if new.status = 'enviado' and new.enviado_em is null then new.enviado_em := now(); end if;
  end if;
  return new;
end;
$$;

create trigger t_pedidos_transicao
  before update on public.pedidos
  for each row execute function public.checar_transicao();

comment on function public.transicao_valida is
  'Fonte da verdade das transições. A mesma tabela existe em src/domain/pedido/maquinaDeEstados.ts — mantenha as duas iguais.';

-- ---------------------------------------------------------------------------
-- Lote aberto: devolve o atual ou cria um novo.
-- ---------------------------------------------------------------------------
create or replace function public.lote_aberto()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.lotes where status = 'aberto' limit 1;
  if v_id is null then
    insert into public.lotes default values returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Recalcula o custo acumulado do lote a partir dos itens dos pedidos nele.
create or replace function public.recalcular_lote(p_lote uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.lotes l
  set custo_total_centavos = coalesce((
    select sum(i.custo_unit_centavos * i.quantidade)
    from public.pedidos p
    join public.pedido_itens i on i.pedido_id = p.id
    where p.lote_id = l.id
      and p.status not in ('cancelado','estornado','falha_estoque')
  ), 0)
  where l.id = p_lote;
$$;

-- Pedido pago entra no lote aberto automaticamente.
create or replace function public.ao_pagar_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lote uuid;
begin
  if new.status = 'pago' and old.status = 'aguardando_pagamento' then
    v_lote := public.lote_aberto();
    new.lote_id := v_lote;
  end if;
  return new;
end;
$$;

create trigger t_pedido_entra_no_lote
  before update on public.pedidos
  for each row execute function public.ao_pagar_pedido();

create or replace function public.apos_pedido_no_lote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lote_id is not null then
    perform public.recalcular_lote(new.lote_id);
  end if;
  if old.lote_id is not null and old.lote_id is distinct from new.lote_id then
    perform public.recalcular_lote(old.lote_id);
  end if;
  return null;
end;
$$;

create trigger t_apos_pedido_lote
  after update on public.pedidos
  for each row execute function public.apos_pedido_no_lote();

-- ---------------------------------------------------------------------------
-- O lote deve fechar?
-- Regra: bateu a meta de frete grátis OU o pedido mais antigo completou o
-- teto de dias úteis. Frete rateado é barato; atraso é caro.
-- ---------------------------------------------------------------------------
create or replace function public.lote_deve_fechar(
  p_lote        uuid,
  p_meta_centavos integer default 30000,   -- R$300, Sudeste
  p_teto_dias   integer default 5
)
returns table (deve boolean, motivo text, dias_mais_antigo integer)
language sql
stable
security definer
set search_path = ''
as $$
  with l as (
    select custo_total_centavos, status from public.lotes where id = p_lote
  ),
  antigo as (
    select coalesce(max(public.dias_uteis_desde(p.pago_em)), 0) as dias
    from public.pedidos p
    where p.lote_id = p_lote
      and p.status not in ('cancelado','estornado','falha_estoque')
      and p.pago_em is not null
  )
  select
    (l.status = 'aberto' and (l.custo_total_centavos >= p_meta_centavos
                              or antigo.dias >= p_teto_dias)),
    case
      when l.custo_total_centavos >= p_meta_centavos then 'meta de frete grátis atingida'
      when antigo.dias >= p_teto_dias                then 'teto de dias úteis atingido'
      else 'ainda acumulando'
    end,
    antigo.dias
  from l, antigo;
$$;

-- ---------------------------------------------------------------------------
-- DISJUNTOR DE PREÇO
--
-- A sincronização é automática, mas um extrator quebrado que leia R$2,00 em
-- vez de R$23,00 reescreveria o catálogo inteiro com lixo. Então:
--   • o custo é sempre atualizado (é o dado bruto da Lilly)
--   • o PREÇO só é reescrito se a variação for plausível
--   • variação acima do limite vira sugestão pendente + alerta
-- ---------------------------------------------------------------------------
create or replace function public.aplicar_custo_sincronizado(
  p_produto        uuid,
  p_novo_custo     integer,
  p_limite_variacao numeric default 0.30   -- 30%
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r            public.produtos%rowtype;
  v_novo_preco integer;
  v_variacao   numeric;
begin
  select * into r from public.produtos where id = p_produto;
  if not found then return 'produto inexistente'; end if;

  if p_novo_custo <= 0 then
    return 'custo inválido, ignorado';
  end if;

  -- custo sempre acompanha a Lilly
  update public.produtos set custo_centavos = p_novo_custo where id = p_produto;

  if not r.preco_automatico then
    return 'preço manual, não alterado';
  end if;

  v_novo_preco := round(p_novo_custo * (1 + r.markup_pct / 100.0));

  v_variacao := case
    when r.preco_centavos = 0 then 1
    else abs(v_novo_preco - r.preco_centavos)::numeric / r.preco_centavos
  end;

  if v_variacao > p_limite_variacao then
    update public.produtos
    set preco_sugerido_centavos = v_novo_preco,
        sugestao_motivo = format(
          'variação de %s%% barrada pelo disjuntor (de %s para %s centavos)',
          round(v_variacao * 100), r.preco_centavos, v_novo_preco)
    where id = p_produto;
    return 'travado pelo disjuntor';
  end if;

  update public.produtos
  set preco_centavos = v_novo_preco,
      preco_sugerido_centavos = null,
      sugestao_motivo = null
  where id = p_produto;

  return 'preço atualizado';
end;
$$;

comment on function public.aplicar_custo_sincronizado is
  'Sincronização automática de preço COM disjuntor. Variação acima do limite vira sugestão, não gravação.';

-- ---------------------------------------------------------------------------
-- Views do admin
-- ---------------------------------------------------------------------------
create or replace view public.v_resumo_vendas as
select
  count(*) filter (where p.pago_em::date = (now() at time zone 'America/Sao_Paulo')::date) as pedidos_hoje,
  coalesce(sum(p.total_centavos) filter (where p.pago_em::date = (now() at time zone 'America/Sao_Paulo')::date), 0) as receita_hoje_centavos,
  count(*) filter (where date_trunc('month', p.pago_em) = date_trunc('month', now())) as pedidos_mes,
  coalesce(sum(p.total_centavos) filter (where date_trunc('month', p.pago_em) = date_trunc('month', now())), 0) as receita_mes_centavos,
  count(*) filter (where p.status in ('pago','no_lote','comprado_fornecedor','recebido_por_mim')) as pendentes_envio
from public.pedidos p
where p.pago_em is not null;

create or replace view public.v_lucro_mes as
select
  date_trunc('month', p.pago_em) as mes,
  sum(i.preco_unit_centavos * i.quantidade) as receita_centavos,
  sum(i.custo_unit_centavos * i.quantidade) as custo_centavos,
  sum((i.preco_unit_centavos - i.custo_unit_centavos) * i.quantidade) as margem_bruta_centavos
from public.pedidos p
join public.pedido_itens i on i.pedido_id = p.id
where p.pago_em is not null
  and p.status not in ('cancelado','estornado','falha_estoque')
group by 1
order by 1 desc;

-- O que comprar na Lilly: agrupado por SKU, pronto para copiar.
create or replace view public.v_lista_compra as
select
  p.lote_id,
  i.sku_fornecedor,
  i.nome_snapshot,
  sum(i.quantidade)::int as quantidade,
  max(i.custo_unit_centavos) as custo_unit_centavos,
  sum(i.custo_unit_centavos * i.quantidade) as subtotal_centavos
from public.pedidos p
join public.pedido_itens i on i.pedido_id = p.id
where p.lote_id is not null
  and p.status not in ('cancelado','estornado','falha_estoque')
group by p.lote_id, i.sku_fornecedor, i.nome_snapshot
order by i.sku_fornecedor;


-- ┌──────────────────────────────────────────────────────────
-- │ 20260811120600_07_rls.sql
-- └──────────────────────────────────────────────────────────

-- 07 · Row Level Security
--
-- LEIA ISTO ANTES DE MEXER:
--
-- A chave anon está dentro do JavaScript que você entrega no navegador.
-- Qualquer pessoa lê. O RLS é a ÚNICA coisa que impede alguém de baixar sua
-- tabela de pedidos com CPF e endereço das clientes.
--
-- Padrão adotado: liga RLS em tudo e cria policy só onde precisa.
-- Tabela sem policy = ninguém do lado público entra. É o default seguro.
--
-- As Edge Functions usam service_role, que ignora RLS por design — é assim
-- que elas conseguem criar pedido e gravar pagamento.

alter table public.fornecedores          enable row level security;
alter table public.fornecedor_produtos   enable row level security;
alter table public.produtos              enable row level security;
alter table public.produto_variantes     enable row level security;
alter table public.perfis                enable row level security;
alter table public.enderecos             enable row level security;
alter table public.favoritos             enable row level security;
alter table public.admins                enable row level security;
alter table public.lotes                 enable row level security;
alter table public.pedidos               enable row level security;
alter table public.pedido_itens          enable row level security;
alter table public.pagamentos            enable row level security;
alter table public.eventos_pedido        enable row level security;
alter table public.regras_preco          enable row level security;
alter table public.sincronizacoes        enable row level security;
alter table public.sincronizacao_falhas  enable row level security;

-- ---------------------------------------------------------------------------
-- VITRINE — a única coisa realmente pública
-- ---------------------------------------------------------------------------
create policy "vitrine lê produto publicado"
  on public.produtos for select
  to anon, authenticated
  using (publicado = true);

create policy "vitrine lê variante de produto publicado"
  on public.produto_variantes for select
  to anon, authenticated
  using (exists (
    select 1 from public.produtos p
    where p.id = produto_variantes.produto_id and p.publicado
  ));

-- ---------------------------------------------------------------------------
-- DADOS DA CLIENTE — só o dono
-- ---------------------------------------------------------------------------
create policy "perfil próprio"
  on public.perfis for select to authenticated
  using (auth.uid() = id);

create policy "atualiza perfil próprio"
  on public.perfis for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "endereços próprios"
  on public.enderecos for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "favoritos próprios"
  on public.favoritos for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- PEDIDOS — a cliente LÊ os dela. Não cria, não edita.
-- Quem cria pedido é a Edge Function criar-pagamento, com service_role.
-- Se a cliente pudesse inserir em pedidos, poderia inventar o próprio total.
-- ---------------------------------------------------------------------------
create policy "lê meus pedidos"
  on public.pedidos for select to authenticated
  using (auth.uid() = user_id);

create policy "lê itens dos meus pedidos"
  on public.pedido_itens for select to authenticated
  using (exists (
    select 1 from public.pedidos p
    where p.id = pedido_itens.pedido_id and p.user_id = auth.uid()
  ));

create policy "lê pagamentos dos meus pedidos"
  on public.pagamentos for select to authenticated
  using (exists (
    select 1 from public.pedidos p
    where p.id = pagamentos.pedido_id and p.user_id = auth.uid()
  ));

-- linha do tempo do rastreio
create policy "lê eventos dos meus pedidos"
  on public.eventos_pedido for select to authenticated
  using (exists (
    select 1 from public.pedidos p
    where p.id = eventos_pedido.pedido_id and p.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- ADMIN — enxerga tudo
-- ---------------------------------------------------------------------------
create policy "admin produtos"       on public.produtos             for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "admin variantes"      on public.produto_variantes    for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "admin fornecedores"   on public.fornecedores         for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "admin espelho"        on public.fornecedor_produtos  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "admin pedidos"        on public.pedidos              for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "admin itens"          on public.pedido_itens         for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "admin pagamentos"     on public.pagamentos           for select to authenticated using (public.eh_admin());
create policy "admin eventos"        on public.eventos_pedido       for select to authenticated using (public.eh_admin());
create policy "admin lotes"          on public.lotes                for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "admin regras"         on public.regras_preco         for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "admin sync"           on public.sincronizacoes       for select to authenticated using (public.eh_admin());
create policy "admin sync falhas"    on public.sincronizacao_falhas for select to authenticated using (public.eh_admin());
create policy "admin lê perfis"      on public.perfis               for select to authenticated using (public.eh_admin());

-- public.admins: NENHUMA policy de propósito.
-- Gerenciar quem é admin só pelo painel do Supabase (service_role).
-- Uma policy aqui que consultasse a própria tabela causaria recursão.

-- ---------------------------------------------------------------------------
-- Escrita: revogada explicitamente nas tabelas de dinheiro.
-- RLS sem policy já bloqueia, mas revogar deixa a intenção registrada e
-- protege contra alguém criar uma policy permissiva demais sem pensar.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.pedidos       from anon, authenticated;
revoke insert, update, delete on public.pedido_itens  from anon, authenticated;
revoke insert, update, delete on public.pagamentos    from anon, authenticated;
revoke insert, update, delete on public.lotes         from anon, authenticated;
revoke all                    on public.admins        from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: bucket público de imagens de produto
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do nothing;

create policy "imagens de produto são públicas"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'produtos');

create policy "só admin sobe imagem"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'produtos' and public.eh_admin());

create policy "só admin apaga imagem"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'produtos' and public.eh_admin());


-- ┌──────────────────────────────────────────────────────────
-- │ 20260811120700_08_seed.sql
-- └──────────────────────────────────────────────────────────

-- 08 · Dados iniciais
--
-- Só o que o sistema precisa para funcionar. Nada de produto fictício:
-- o catálogo vem da sincronização.

insert into public.fornecedores (nome, site, sitemap_url, razao_atacado)
values (
  'Lilly Store',
  'https://www.uselilly.com',
  'https://www.uselilly.com/sitemap.xml',
  0.700
)
on conflict do nothing;

-- Regra de preço padrão: markup de 200% sobre o atacado.
-- Peça de R$23,00 de custo sai a R$69,00.
insert into public.regras_preco (nome, markup_pct, desconto_pct, ativa)
values ('Padrão', 200.00, 0, true)
on conflict do nothing;

-- Primeiro lote, já aberto e pronto para receber pedidos pagos.
insert into public.lotes (status) values ('aberto')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Agendamentos
--
-- Substitua <PROJECT_REF> e <SERVICE_ROLE_KEY> antes de aplicar, ou rode
-- estes dois blocos manualmente no SQL Editor depois de publicar as
-- Edge Functions. Guardar a service_role dentro de um job do cron é
-- aceitável porque ela nunca sai do banco — mas não versione a chave real
-- no git: rode este trecho à mão.
-- ---------------------------------------------------------------------------

-- Sincronização com a Lilly, a cada 6 horas
-- select cron.schedule(
--   'sincronizar-lilly',
--   '0 */6 * * *',
--   $$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/sincronizar-lilly',
--     headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
--     body    := '{}'::jsonb
--   );
--   $$
-- );

-- Avaliação do lote, todo dia útil às 9h (12h UTC)
-- select cron.schedule(
--   'avaliar-lote',
--   '0 12 * * 1-5',
--   $$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/fechar-lote',
--     headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
--     body    := '{}'::jsonb
--   );
--   $$
-- );


-- ┌──────────────────────────────────────────────────────────
-- │ 20260811120800_09_grants.sql
-- └──────────────────────────────────────────────────────────

-- 09 · Privilégios explícitos
--
-- Necessária porque o projeto foi criado com "Automatically expose new tables"
-- DESLIGADO — a recomendação do próprio Supabase. Sem auto-exposição, uma
-- tabela nova não vira endpoint público por descuido; em troca, o acesso
-- precisa ser concedido aqui, de propósito.
--
-- SÃO DUAS FECHADURAS DIFERENTES, e as duas precisam abrir:
--
--   GRANT  → "este papel pode tocar nesta tabela?"     (privilégio do Postgres)
--   RLS    → "quais LINHAS ele enxerga?"               (policy da migration 07)
--
-- Um GRANT generoso não vaza nada sozinho: sem policy, o RLS continua negando
-- tudo. E uma policy sem GRANT não adianta: o Postgres barra antes de chegar
-- na policy. Por isso os grants abaixo podem parecer amplos — quem decide o
-- que aparece é sempre o RLS.

grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- VITRINE — leitura pública
-- O RLS restringe a `publicado = true` (migration 07).
-- ---------------------------------------------------------------------------
grant select on public.produtos          to anon, authenticated;
grant select on public.produto_variantes to anon, authenticated;

-- ---------------------------------------------------------------------------
-- CLIENTE LOGADA
-- O RLS restringe a `auth.uid() = user_id`.
-- ---------------------------------------------------------------------------
grant select, update         on public.perfis    to authenticated;
grant select, insert, update, delete on public.enderecos to authenticated;
grant select, insert, delete on public.favoritos to authenticated;

-- Pedidos: SELECT apenas. Quem cria e altera é a API Go, como dona do banco.
-- Se a cliente pudesse inserir em `pedidos`, inventaria o próprio total.
grant select on public.pedidos        to authenticated;
grant select on public.pedido_itens   to authenticated;
grant select on public.pagamentos     to authenticated;
grant select on public.eventos_pedido to authenticated;

-- ---------------------------------------------------------------------------
-- ADMIN
-- O painel roda no navegador com o mesmo papel `authenticated`; quem separa
-- a dona das clientes é a policy `eh_admin()` da migration 07.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.fornecedores        to authenticated;
grant select, insert, update, delete on public.fornecedor_produtos to authenticated;
grant select, insert, update, delete on public.regras_preco        to authenticated;
grant select, insert, update, delete on public.lotes               to authenticated;
grant select on public.sincronizacoes       to authenticated;
grant select on public.sincronizacao_falhas to authenticated;

-- Sequências dos `serial` (pedidos.numero, lotes.numero): só a API grava,
-- então anon e authenticated não precisam de acesso.

-- ---------------------------------------------------------------------------
-- public.admins: NENHUM grant, de propósito.
-- Quem é admin se gerencia pelo painel do Supabase (service_role).
-- ---------------------------------------------------------------------------
revoke all on public.admins from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reaplica as revogações da migration 07.
-- Se algum GRANT acima passar da conta num futuro `alter`, estas linhas
-- garantem que ninguém escreve direto nas tabelas de dinheiro.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.pedidos      from anon, authenticated;
revoke insert, update, delete on public.pedido_itens from anon, authenticated;
revoke insert, update, delete on public.pagamentos   from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Views do admin
-- ---------------------------------------------------------------------------
grant select on public.v_resumo_vendas to authenticated;
grant select on public.v_lucro_mes     to authenticated;
grant select on public.v_lista_compra  to authenticated;

