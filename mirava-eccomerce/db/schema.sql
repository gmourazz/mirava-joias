-- ============================================================
-- SCHEMA DA MIRAVA — Postgres próprio (local via Docker, depois VPS Hostinger)
--
-- Convenção: identificadores (tabela, coluna, função) em inglês. Comentários
-- em português, porque é o idioma de quem lê e mantém este projeto.
--
-- Diferença central em relação ao Supabase: aqui NÃO existe RLS nem papel
-- anon/authenticated. A API Go conecta como dona do banco e filtra por
-- user_id explicitamente em toda consulta — ela é a fronteira de segurança,
-- não o Postgres. O front nunca conecta direto neste banco.
--
-- Rode com:
--   psql "$DATABASE_URL" -f db/schema.sql
-- ============================================================

-- ---------------------------------------------------------------------------
-- 01 · Fundação
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.touch_updated_at is
  'Trigger genérico: mantém updated_at em dia. Use com before update.';

-- Dias úteis completos decorridos desde um instante até agora.
-- LIMITAÇÃO CONHECIDA: ignora feriados nacionais — aceitável para a regra
-- de lote, que erra a favor da cliente.
create or replace function public.business_days_since(start_at timestamptz)
returns integer
language sql
stable
as $$
  select greatest(0, count(*)::int - 1)
  from generate_series(
    (start_at at time zone 'America/Sao_Paulo')::date,
    (now()    at time zone 'America/Sao_Paulo')::date,
    interval '1 day'
  ) as d
  where extract(isodow from d) < 6;
$$;

comment on function public.business_days_since is
  'Dias úteis completos entre o instante dado e agora, fuso de São Paulo. Ignora feriados.';

-- Remoção de acentos sem depender da extensão unaccent.
create or replace function public.simple_unaccent(txt text)
returns text
language sql
immutable
as $$
  select translate(
    txt,
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  );
$$;

-- "Pulseira Prata - Riviera Cristal" -> "pulseira-prata-riviera-cristal"
create or replace function public.generate_slug(txt text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(public.simple_unaccent(txt)),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 02 · Contas — usuários próprios (substitui auth.users do Supabase)
-- ---------------------------------------------------------------------------
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default '',
  email         text not null unique,
  password_hash text not null,
  -- Cupom de boas-vindas (10% na primeira encomenda, código BEMVINDA10):
  -- null = ainda não usado. Marcado só quando o PAGAMENTO é confirmado (ver
  -- webhookMP), nunca na tentativa de checkout — senão um pedido abandonado
  -- queimaria o cupom à toa. Ver internal/dominio/cupom.go.
  welcome_coupon_redeemed_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger t_users_updated
  before update on public.users
  for each row execute function public.touch_updated_at();

comment on table public.users is
  'Conta própria da Mirava (bcrypt + JWT emitido pela API Go). Ver internal/auth.';

-- E-mails capturados pelo banner "Bem-vinda" da home. Existe só para não
-- jogar fora um contato que a visitante deu de propósito — a promoção em si
-- (código BEMVINDA10) não depende desta tabela, só de ter conta.
create table public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id           uuid primary key references public.users(id) on delete cascade,
  name         text not null default '',
  phone        text,
  cpf          text,
  accepts_email boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger t_profiles_updated
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Perfil é criado pela API Go na mesma transação do cadastro
-- (internal/db.CreateUser) — não precisa de trigger em users.

create table public.addresses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  label        text,
  recipient    text not null,
  zip_code     text not null check (zip_code ~ '^\d{5}-?\d{3}$'),
  street       text not null,
  number       text not null,
  complement   text,
  neighborhood text not null,
  city         text not null,
  state        char(2) not null check (state ~ '^[A-Z]{2}$'),
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index ix_addresses_user on public.addresses (user_id);

create unique index uq_address_primary
  on public.addresses (user_id) where is_primary;

-- Tabela favorites vem depois de products (seção 03) — ela referencia
-- products.id, então precisa existir DEPOIS na ordem do script.

-- ---------------------------------------------------------------------------
-- Admin. Uma linha aqui = acesso total.
--   insert into public.admins (user_id) values ('<uuid de users>');
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id    uuid primary key references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admins is
  'Papel de admin por tabela própria, nunca em campo editável pelo usuário.';

-- ---------------------------------------------------------------------------
-- 03 · Catálogo
--
--   supplier_products  ESPELHO. A sincronização sobrescreve a cada rodada.
--   products           SEU CATÁLOGO. A sincronização nunca escreve aqui
--                       direto — só sugere, via as colunas de sugestão.
-- ---------------------------------------------------------------------------
create table public.suppliers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  site           text not null,
  sitemap_url    text,
  wholesale_ratio numeric(4,3) not null default 0.700,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger t_suppliers_updated
  before update on public.suppliers
  for each row execute function public.touch_updated_at();

create table public.supplier_products (
  id                uuid primary key default gen_random_uuid(),
  supplier_id       uuid not null references public.suppliers(id) on delete cascade,

  sku               text not null,
  url               text not null,
  name              text not null,
  description       text,
  warranty          text,

  cost_cents        integer not null check (cost_cents > 0),
  retail_cents      integer check (retail_cents >= 0),
  cost_confirmed    boolean not null default false,

  available         boolean not null default true,

  source_images     text[] not null default '{}',
  rating            numeric(2,1),
  rating_count      integer,
  reviews           jsonb not null default '[]',

  last_seen_at      timestamptz not null default now(),
  vanished_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint uq_supplier_sku unique (supplier_id, sku)
);

create index ix_sp_available  on public.supplier_products (supplier_id, available);
create index ix_sp_last_seen  on public.supplier_products (last_seen_at desc);

create trigger t_sp_updated
  before update on public.supplier_products
  for each row execute function public.touch_updated_at();

create table public.products (
  id                    uuid primary key default gen_random_uuid(),
  supplier_product_id   uuid unique references public.supplier_products(id) on delete set null,

  slug                  text not null unique,
  name                  text not null,
  description           text,

  price_cents           integer not null check (price_cents > 0),
  cost_cents            integer not null check (cost_cents >= 0),

  auto_price            boolean not null default true,
  markup_pct            numeric(6,2) not null default 200.00 check (markup_pct >= 0),

  suggested_price_cents integer,
  suggestion_reason     text,

  -- Valores em português de propósito: são slugs de conteúdo/URL/asset
  -- (rota /categoria/:menuKey/:filter, chaves de imagem em lib/images.ts),
  -- não identificadores de código — trocar para inglês quebraria as imagens
  -- do catálogo sem trazer benefício real.
  category              text not null check (category in
                          ('aneis','colares','pulseiras','berloques','brincos','conjuntos','outros')),
  metal                 text not null check (metal in ('prata','ouro')),

  images                text[] not null default '{}',
  published             boolean not null default false,
  featured              boolean not null default false,

  -- Espelho da avaliação da Lilly — não é opinião de cliente Mirava, é a nota
  -- e os comentários que já existem na página de origem, copiados junto com
  -- nome, descrição e foto.
  rating                numeric(2,1),
  rating_count          integer,
  reviews               jsonb not null default '[]',

  -- Como se chama o grupo de opção desta peça na Lilly: 'Tamanho' num anel,
  -- 'Letras' num colar de letra. Nulo quando a peça não tem escolha. O rótulo
  -- importa: mostrar "Tamanho: A" numa peça de letra estaria errado.
  variant_label         text,

  -- MAIS VENDIDOS, com dois sinais e uma regra de sucessão.
  --
  -- supplier_rank é a posição da peça na vitrine "Mais vendidos" da Lilly
  -- (1 = a que mais vende lá). Serve enquanto a Mirava não tem venda própria
  -- suficiente para saber o que sai. É emprestado, e a sincronização reescreve
  -- a cada rodada.
  --
  -- units_sold é venda NOSSA: soma das unidades em pedidos pagos, recalculada
  -- pela tarefa de mais vendidos. É dado próprio, permanente, e não some se a
  -- Lilly sair do ar ou mudar de vitrine.
  --
  -- A ordenação usa units_sold primeiro e só cai no supplier_rank para
  -- desempatar. Ou seja: quanto mais a Mirava vende, menos ela depende da
  -- Lilly — sem precisar trocar código nenhum no dia da virada.
  supplier_rank         integer check (supplier_rank > 0),
  units_sold            integer not null default 0 check (units_sold >= 0),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index ix_products_showcase  on public.products (published, category) where published;
create index ix_products_featured  on public.products (featured) where published and featured;
create index ix_products_pending   on public.products (suggested_price_cents)
  where suggested_price_cents is not null;
-- Vitrine de mais vendidos: nossa venda na frente, posição da Lilly como
-- desempate. `nulls last` mantém quem nunca apareceu na vitrine dela no fim.
create index ix_products_best      on public.products
  (units_sold desc, supplier_rank asc nulls last) where published;

create trigger t_products_updated
  before update on public.products
  for each row execute function public.touch_updated_at();

comment on table public.products is
  'Catálogo da Mirava. A sincronização nunca escreve aqui direto — ver disjuntor abaixo.';

create table public.product_variants (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products(id) on delete cascade,
  size              text not null,
  price_adjust_cents integer not null default 0,
  available         boolean not null default true,
  sort_order        smallint not null default 0,

  constraint uq_variant unique (product_id, size)
);

create index ix_variants_product on public.product_variants (product_id);

create table public.favorites (
  user_id    uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ---------------------------------------------------------------------------
-- 04 · Lotes, pedidos, itens e pagamentos
-- ---------------------------------------------------------------------------
create table public.batches (
  id               uuid primary key default gen_random_uuid(),
  number           serial not null unique,

  status           text not null default 'open' check (status in
                     ('open','closed','purchased','received','distributed','cancelled')),

  total_cost_cents integer not null default 0 check (total_cost_cents >= 0),
  shipping_cents   integer not null default 0 check (shipping_cents >= 0),

  supplier_order_ref text,
  notes              text,

  opened_at        timestamptz not null default now(),
  closed_at        timestamptz,
  purchased_at     timestamptz,
  received_at      timestamptz,
  updated_at       timestamptz not null default now()
);

create trigger t_batches_updated
  before update on public.batches
  for each row execute function public.touch_updated_at();

create unique index uq_batch_open on public.batches ((true)) where status = 'open';

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  number          serial not null unique,

  -- Anulável de propósito — conta obrigatória hoje é config, não schema.
  user_id         uuid references public.users(id) on delete set null,
  batch_id        uuid references public.batches(id) on delete set null,

  status          text not null default 'awaiting_payment' check (status in (
                    'awaiting_payment','paid','in_batch','purchased_from_supplier',
                    'received_by_owner','shipped','delivered',
                    'cancelled','refunded','out_of_stock')),

  customer_name   text not null,
  customer_email  text not null,
  customer_phone  text,
  customer_cpf    text,

  address         jsonb not null,
  subtotal_cents  integer not null check (subtotal_cents >= 0),
  shipping_cents  integer not null default 0 check (shipping_cents >= 0),
  discount_cents  integer not null default 0 check (discount_cents >= 0),
  total_cents     integer not null check (total_cents >= 0),

  -- Serviço de entrega escolhido: 'economico' ou 'sedex'. Sem ele o valor do
  -- frete sozinho não diz o que despachar — R$0 tanto pode ser frete grátis
  -- quanto pedido antigo, e SEDEX exige postagem diferente.
  shipping_method text check (shipping_method in ('economico','sedex')),

  engraving       text,
  notes           text,
  tracking_code   text,

  created_at      timestamptz not null default now(),
  paid_at         timestamptz,
  shipped_at      timestamptz,
  updated_at      timestamptz not null default now(),

  constraint ck_total_coherent
    check (total_cents = subtotal_cents + shipping_cents - discount_cents)
);

create index ix_orders_user   on public.orders (user_id, created_at desc);
create index ix_orders_status on public.orders (status, created_at);
create index ix_orders_batch  on public.orders (batch_id);

create trigger t_orders_updated
  before update on public.orders
  for each row execute function public.touch_updated_at();

create table public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  product_id        uuid references public.products(id) on delete set null,

  name_snapshot     text not null,
  supplier_sku      text,
  size              text,
  quantity          integer not null check (quantity > 0),

  unit_price_cents  integer not null check (unit_price_cents >= 0),
  unit_cost_cents   integer not null check (unit_cost_cents >= 0)
);

create index ix_items_order   on public.order_items (order_id);
create index ix_items_product on public.order_items (product_id);

create table public.payments (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,

  mp_payment_id  text not null unique,
  status         text not null,
  method         text,
  installments   smallint,

  amount_cents   integer not null check (amount_cents >= 0),
  fee_cents      integer,
  net_cents      integer,

  payload        jsonb,
  created_at     timestamptz not null default now()
);

create index ix_payments_order on public.payments (order_id);

create table public.order_events (
  id          bigserial primary key,
  order_id    uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status   text not null,
  origin      text not null default 'system',
  detail      text,
  created_at  timestamptz not null default now()
);

create index ix_order_events on public.order_events (order_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 05 · Regras de preço e registro de sincronização
-- ---------------------------------------------------------------------------
create table public.price_rules (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  markup_pct     numeric(6,2) not null check (markup_pct >= 0),
  discount_pct   numeric(5,2) not null default 0 check (discount_pct between 0 and 90),

  min_cost_cents integer not null default 0,
  max_cost_cents integer not null default 2147483647,

  category       text,
  active         boolean not null default false,
  starts_at      timestamptz,
  ends_at        timestamptz,

  created_at     timestamptz not null default now(),

  constraint ck_cost_range check (max_cost_cents >= min_cost_cents),
  constraint ck_window     check (ends_at is null or starts_at is null
                                  or ends_at > starts_at)
);

create index ix_price_rules_active on public.price_rules (active, starts_at, ends_at)
  where active;

create table public.syncs (
  id             uuid primary key default gen_random_uuid(),
  supplier_id    uuid references public.suppliers(id) on delete set null,

  status         text not null default 'running' check (status in
                   ('running','success','partial','error')),

  sitemap_urls   integer not null default 0,
  processed      integer not null default 0,
  created_count  integer not null default 0,
  updated_count  integer not null default 0,
  failed         integer not null default 0,
  vanished       integer not null default 0,
  locked_prices  integer not null default 0,

  error          text,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz
);

create index ix_syncs_recent on public.syncs (started_at desc);

create table public.sync_failures (
  id         bigserial primary key,
  sync_id    uuid not null references public.syncs(id) on delete cascade,
  url        text not null,
  reason     text not null,
  created_at timestamptz not null default now()
);

create index ix_sync_failures on public.sync_failures (sync_id);

comment on column public.syncs.locked_prices is
  'Quantos preços o disjuntor barrou por variação suspeita. Se for alto, o extrator quebrou.';

-- ---------------------------------------------------------------------------
-- 06 · Regras de negócio no banco (defesa em profundidade — duplicado em Go)
-- ---------------------------------------------------------------------------
create or replace function public.valid_transition(from_status text, to_status text)
returns boolean
language sql
immutable
as $$
  select case from_status
    when 'awaiting_payment'         then to_status in ('paid','cancelled')
    when 'paid'                     then to_status in ('in_batch','refunded','out_of_stock')
    when 'in_batch'                 then to_status in ('purchased_from_supplier','out_of_stock','paid')
    when 'purchased_from_supplier'  then to_status in ('received_by_owner','out_of_stock')
    when 'received_by_owner'        then to_status in ('shipped')
    when 'shipped'                  then to_status in ('delivered')
    when 'delivered'                then false
    when 'cancelled'                then false
    when 'refunded'                 then false
    when 'out_of_stock'             then to_status in ('refunded','in_batch')
    else false
  end;
$$;

create or replace function public.check_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not public.valid_transition(old.status, new.status) then
      raise exception
        'Transição de status inválida: % -> % (pedido %)',
        old.status, new.status, old.number
        using errcode = 'check_violation';
    end if;

    insert into public.order_events (order_id, from_status, to_status, origin)
    values (new.id, old.status, new.status,
            coalesce(current_setting('app.origin', true), 'system'));

    if new.status = 'paid'    and new.paid_at    is null then new.paid_at    := now(); end if;
    if new.status = 'shipped' and new.shipped_at is null then new.shipped_at := now(); end if;
  end if;
  return new;
end;
$$;

create trigger t_orders_transition
  before update on public.orders
  for each row execute function public.check_transition();

comment on function public.valid_transition is
  'Fonte da verdade das transições. Mantenha igual à máquina de estados em Go.';

create or replace function public.open_batch()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.batches where status = 'open' limit 1;
  if v_id is null then
    insert into public.batches default values returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.recalculate_batch(p_batch uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.batches b
  set total_cost_cents = coalesce((
    select sum(i.unit_cost_cents * i.quantity)
    from public.orders o
    join public.order_items i on i.order_id = o.id
    where o.batch_id = b.id
      and o.status not in ('cancelled','refunded','out_of_stock')
  ), 0)
  where b.id = p_batch;
$$;

create or replace function public.on_order_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch uuid;
begin
  if new.status = 'paid' and old.status = 'awaiting_payment' then
    v_batch := public.open_batch();
    new.batch_id := v_batch;
  end if;
  return new;
end;
$$;

create trigger t_order_enters_batch
  before update on public.orders
  for each row execute function public.on_order_paid();

create or replace function public.after_order_in_batch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.batch_id is not null then
    perform public.recalculate_batch(new.batch_id);
  end if;
  if old.batch_id is not null and old.batch_id is distinct from new.batch_id then
    perform public.recalculate_batch(old.batch_id);
  end if;
  return null;
end;
$$;

create trigger t_after_order_batch
  after update on public.orders
  for each row execute function public.after_order_in_batch();

create or replace function public.batch_should_close(
  p_batch          uuid,
  p_goal_cents     integer default 30000,   -- R$300, Sudeste
  p_days_cap       integer default 5
)
returns table (should_close boolean, reason text, oldest_days integer)
language sql
stable
security definer
set search_path = ''
as $$
  with b as (
    select total_cost_cents, status from public.batches where id = p_batch
  ),
  oldest as (
    select coalesce(max(public.business_days_since(o.paid_at)), 0) as days
    from public.orders o
    where o.batch_id = p_batch
      and o.status not in ('cancelled','refunded','out_of_stock')
      and o.paid_at is not null
  )
  select
    (b.status = 'open' and (b.total_cost_cents >= p_goal_cents
                            or oldest.days >= p_days_cap)),
    case
      when b.total_cost_cents >= p_goal_cents then 'meta de frete grátis atingida'
      when oldest.days >= p_days_cap          then 'teto de dias úteis atingido'
      else 'ainda acumulando'
    end,
    oldest.days
  from b, oldest;
$$;

-- ---------------------------------------------------------------------------
-- DISJUNTOR DE PREÇO — variação acima do limite vira sugestão, não gravação.
-- ---------------------------------------------------------------------------
create or replace function public.apply_synced_cost(
  p_product        uuid,
  p_new_cost       integer,
  p_variation_limit numeric default 0.30
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r           public.products%rowtype;
  v_new_price integer;
  v_variation numeric;
begin
  select * into r from public.products where id = p_product;
  if not found then return 'produto inexistente'; end if;

  if p_new_cost <= 0 then
    return 'custo inválido, ignorado';
  end if;

  update public.products set cost_cents = p_new_cost where id = p_product;

  if not r.auto_price then
    return 'preço manual, não alterado';
  end if;

  v_new_price := round(p_new_cost * (1 + r.markup_pct / 100.0));

  v_variation := case
    when r.price_cents = 0 then 1
    else abs(v_new_price - r.price_cents)::numeric / r.price_cents
  end;

  if v_variation > p_variation_limit then
    update public.products
    set suggested_price_cents = v_new_price,
        suggestion_reason = format(
          'variação de %s%% barrada pelo disjuntor (de %s para %s centavos)',
          round(v_variation * 100), r.price_cents, v_new_price)
    where id = p_product;
    return 'travado pelo disjuntor';
  end if;

  update public.products
  set price_cents = v_new_price,
      suggested_price_cents = null,
      suggestion_reason = null
  where id = p_product;

  return 'preço atualizado';
end;
$$;

comment on function public.apply_synced_cost is
  'Sincronização automática de preço COM disjuntor. Variação acima do limite vira sugestão, não gravação.';

-- ---------------------------------------------------------------------------
-- Views do admin
-- ---------------------------------------------------------------------------
create or replace view public.v_sales_summary as
select
  count(*) filter (where o.paid_at::date = (now() at time zone 'America/Sao_Paulo')::date) as orders_today,
  coalesce(sum(o.total_cents) filter (where o.paid_at::date = (now() at time zone 'America/Sao_Paulo')::date), 0) as revenue_today_cents,
  count(*) filter (where date_trunc('month', o.paid_at) = date_trunc('month', now())) as orders_month,
  coalesce(sum(o.total_cents) filter (where date_trunc('month', o.paid_at) = date_trunc('month', now())), 0) as revenue_month_cents,
  count(*) filter (where o.status in ('paid','in_batch','purchased_from_supplier','received_by_owner')) as pending_shipment
from public.orders o
where o.paid_at is not null;

create or replace view public.v_monthly_profit as
select
  date_trunc('month', o.paid_at) as month,
  sum(i.unit_price_cents * i.quantity) as revenue_cents,
  sum(i.unit_cost_cents * i.quantity) as cost_cents,
  sum((i.unit_price_cents - i.unit_cost_cents) * i.quantity) as gross_margin_cents
from public.orders o
join public.order_items i on i.order_id = o.id
where o.paid_at is not null
  and o.status not in ('cancelled','refunded','out_of_stock')
group by 1
order by 1 desc;

create or replace view public.v_shopping_list as
select
  o.batch_id,
  i.supplier_sku,
  i.name_snapshot,
  sum(i.quantity)::int as quantity,
  max(i.unit_cost_cents) as unit_cost_cents,
  sum(i.unit_cost_cents * i.quantity) as subtotal_cents
from public.orders o
join public.order_items i on i.order_id = o.id
where o.batch_id is not null
  and o.status not in ('cancelled','refunded','out_of_stock')
group by o.batch_id, i.supplier_sku, i.name_snapshot
order by i.supplier_sku;

-- ---------------------------------------------------------------------------
-- 07 · Dados iniciais
-- ---------------------------------------------------------------------------
insert into public.suppliers (name, site, sitemap_url, wholesale_ratio)
values (
  'Lilly Store',
  'https://www.uselilly.com',
  'https://www.uselilly.com/sitemap.xml',
  0.700
)
on conflict do nothing;

insert into public.price_rules (name, markup_pct, discount_pct, active)
values ('Padrão', 200.00, 0, true)
on conflict do nothing;

insert into public.batches (status) values ('open')
on conflict do nothing;
