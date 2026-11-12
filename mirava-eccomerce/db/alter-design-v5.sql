-- Atualiza um banco já existente para o design v5 (decisão 31).
-- Banco novo não precisa: o schema.sql já tem tudo.
--
--   docker exec -i mirava-postgres psql -U mirava -d mirava < alter-design-v5.sql
--
-- Pode rodar mais de uma vez.

begin;

alter table public.orders
  add column if not exists coupon_code     text,
  add column if not exists points_used     integer not null default 0 check (points_used >= 0),
  add column if not exists points_earned   integer not null default 0 check (points_earned >= 0),
  add column if not exists gift_wrap       boolean not null default false,
  add column if not exists gift_message    text,
  add column if not exists gift_wrap_cents integer not null default 0 check (gift_wrap_cents >= 0),
  add column if not exists reminder_sent_at       timestamptz,
  add column if not exists review_request_sent_at timestamptz,
  add column if not exists delivered_at    timestamptz;

alter table public.orders drop constraint if exists ck_total_coherent;
alter table public.orders add constraint ck_total_coherent
  check (total_cents = subtotal_cents + shipping_cents + gift_wrap_cents - discount_cents);
alter table public.orders drop constraint if exists ck_one_discount;
alter table public.orders add constraint ck_one_discount
  check (coupon_code is null or points_used = 0);

-- Pedidos já entregues ganham a data pelo histórico de eventos.
update public.orders o set delivered_at = e.created_at
from public.order_events e
where e.order_id = o.id and e.to_status = 'delivered' and o.delivered_at is null;

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

    if new.status = 'paid'      and new.paid_at      is null then new.paid_at      := now(); end if;
    if new.status = 'shipped'   and new.shipped_at   is null then new.shipped_at   := now(); end if;
    if new.status = 'delivered' and new.delivered_at is null then new.delivered_at := now(); end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 08 · Design v5: cupons, avaliações, avise-me, trocas, vitrine, avisos,
--      sacolas e automações (decisão 31 da arquitetura)
--
-- Idempotente (if not exists): o mesmo bloco entra no schema.sql e no
-- alter-design-v5.sql, que atualiza um banco já existente.
-- ---------------------------------------------------------------------------

-- Cupons. Usos não são guardados aqui: são contados nos pedidos (coupon_code)
-- que não foram cancelados nem estornados — não tem como desencontrar.
create table if not exists public.coupons (
  code              text primary key check (code = upper(code) and code !~ '\s'),
  kind              text not null check (kind in ('percent','fixed')),
  value             integer not null check (value > 0),
  min_subtotal_cents integer not null default 0 check (min_subtotal_cents >= 0),
  starts_at         timestamptz,
  ends_at           timestamptz,
  max_uses          integer not null default 0 check (max_uses >= 0),  -- 0 = sem limite
  active            boolean not null default true,
  description       text,
  created_at        timestamptz not null default now(),
  constraint ck_coupon_percent check (kind <> 'percent' or value <= 30),
  constraint ck_coupon_window  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

-- Avaliações de clientes reais (decisão 28: só aparecem aprovadas). Uma por
-- cliente por peça, e só de quem recebeu a peça (conferido na API).
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  rating      smallint not null check (rating between 1 and 5),
  text        text not null default '' check (length(text) <= 1000),
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  unique (user_id, product_id)
);
create index if not exists ix_reviews_product on public.reviews (product_id) where status = 'approved';
create index if not exists ix_reviews_pending on public.reviews (created_at) where status = 'pending';

-- Avise-me: peça indisponível na Lilly; a cliente quer saber quando voltar.
create table if not exists public.stock_alerts (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  email       text not null,
  user_id     uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  notified_at timestamptz,
  unique (product_id, email)
);
create index if not exists ix_stock_alerts_pending on public.stock_alerts (product_id) where notified_at is null;

-- Trocas e devoluções, com etapas.
create table if not exists public.returns (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  kind        text not null check (kind in ('troca','reembolso')),
  reason      text not null check (length(reason) between 3 and 1000),
  stage       text not null default 'requested'
                check (stage in ('requested','awaiting_shipment','received','done','rejected')),
  admin_note  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ix_returns_open on public.returns (created_at) where stage not in ('done','rejected');

-- Vitrine da loja: a dona escolhe e ordena as peças de cada espaço da home.
create table if not exists public.showcase_items (
  slot        text not null check (slot in ('queridinhas','lancamentos','presentes')),
  product_id  uuid not null references public.products(id) on delete cascade,
  position    integer not null default 0,
  primary key (slot, product_id)
);

-- Avisos da faixa do topo, editáveis no painel.
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  text        text not null check (length(text) between 3 and 120),
  position    integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Sacola da cliente logada, guardada para o aviso de carrinho abandonado.
-- Só intenção de compra (peça, tamanho, quantidade) — preço é do servidor.
create table if not exists public.carts (
  user_id     uuid primary key references public.users(id) on delete cascade,
  items       jsonb not null default '[]',
  updated_at  timestamptz not null default now(),
  notified_at timestamptz
);

-- Liga/desliga de cada automação por e-mail.
create table if not exists public.automation_settings (
  key     text primary key check (key in ('payment_reminder','abandoned_cart','review_request','stock_alert','return_update')),
  enabled boolean not null default true
);
insert into public.automation_settings (key) values
  ('payment_reminder'), ('abandoned_cart'), ('review_request'), ('stock_alert'), ('return_update')
on conflict do nothing;

-- Avisos iniciais da faixa: os mesmos que estavam fixos no site.
insert into public.announcements (text, position)
select t, p from (values
  ('Frete grátis acima de R$ 300', 1),
  ('Parcele em 3x sem juros', 2),
  ('Pix ou cartão pelo Mercado Pago', 3),
  ('Feito sob encomenda', 4),
  ('Pagamento 100% seguro', 5)
) v(t, p)
where not exists (select 1 from public.announcements);

commit;

-- ---------------------------------------------------------------------------
-- 09 · Design v5 completo: categorias editáveis, configurações da loja,
--      markup em camadas, promoções, kits, Pix, newsletter, banners, galeria,
--      fotos próprias, fila "novos na Lilly" e papéis (decisões 21, 27, 32-35)
--
-- Idempotente: o mesmo bloco está no schema.sql e no alter-design-v5.sql.
-- ---------------------------------------------------------------------------

-- Categorias da loja. O slug continua sendo dado em português (vira URL e
-- chave de imagem); o rótulo e a ordem do menu são editáveis no painel.
create table if not exists public.categories (
  slug        text primary key check (slug ~ '^[a-z0-9-]+$'),
  label       text not null check (length(label) between 2 and 40),
  position    integer not null default 0,
  -- Markup da categoria (decisão 21). Nulo = usa o padrão da loja.
  markup_pct  numeric(6,2) check (markup_pct is null or markup_pct between 20 and 500),
  created_at  timestamptz not null default now()
);
insert into public.categories (slug, label, position) values
  ('aneis', 'Anéis', 1), ('colares', 'Colares', 2), ('pulseiras', 'Pulseiras', 3),
  ('brincos', 'Brincos', 4), ('berloques', 'Berloques', 5), ('conjuntos', 'Conjuntos', 6),
  ('outros', 'Outros', 7)
on conflict do nothing;

-- products.category deixa de ser lista fixa e passa a apontar para categories.
alter table public.products drop constraint if exists products_category_check;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fk_products_category') then
    alter table public.products add constraint fk_products_category
      foreign key (category) references public.categories(slug) on update cascade;
  end if;
end $$;

-- Markup da peça passa a ser opcional: nulo = herda da categoria/padrão.
-- Quem estava em 200% (o padrão antigo) passa a herdar — o preço não muda.
alter table public.products alter column markup_pct drop not null;
alter table public.products alter column markup_pct drop default;
do $$ begin
  if not exists (select 1 from pg_class where relname = 'store_settings') then
    update public.products set markup_pct = null where markup_pct = 200.00;
  end if;
end $$;

alter table public.products add column if not exists seo_title        text check (seo_title is null or length(seo_title) <= 70);
alter table public.products add column if not exists seo_description  text check (seo_description is null or length(seo_description) <= 170);
-- Proteções contra a sincronização: foto, texto e categoria escolhidos pela
-- dona não são sobrescritos pelo que a Lilly mostrar depois.
alter table public.products add column if not exists keep_own_photos  boolean not null default false;
alter table public.products add column if not exists keep_own_text    boolean not null default false;
alter table public.products add column if not exists category_locked  boolean not null default false;
-- A sincronização despublicou por falta de estoque (e republica quando volta).
alter table public.products add column if not exists hidden_by_sync   boolean not null default false;

-- Configurações da loja: uma linha só.
create table if not exists public.store_settings (
  id                    boolean primary key default true check (id),
  default_markup_pct    numeric(6,2) not null default 200 check (default_markup_pct between 20 and 500),
  round_to_90           boolean not null default false,
  min_margin_pct        numeric(5,2) not null default 50 check (min_margin_pct between 0 and 90),
  out_of_stock_action   text not null default 'show' check (out_of_stock_action in ('show','hide')),
  sync_every_hours      integer not null default 6 check (sync_every_hours in (3, 6, 12, 24)),
  auto_import           boolean not null default true,
  sync_images           boolean not null default true,
  sync_descriptions     boolean not null default true,
  store_name            text not null default 'Mirava Semijoias',
  store_email           text not null default 'miravajoias@gmail.com',
  store_instagram       text not null default '@miravajoias',
  sender_name           text,
  sender_street         text,
  sender_number         text,
  sender_complement     text,
  sender_neighborhood   text,
  sender_city           text,
  sender_state          char(2),
  sender_zip            text,
  goal_revenue_cents    integer not null default 0 check (goal_revenue_cents >= 0),
  goal_orders           integer not null default 0 check (goal_orders >= 0),
  goal_profit_cents     integer not null default 0 check (goal_profit_cents >= 0),
  updated_at            timestamptz not null default now()
);
insert into public.store_settings (id) values (true) on conflict do nothing;
-- Custo de cada embrulho para presente (caixinha, laço, cartão): sai do
-- lucro no Financeiro. 0 = ainda não informado.
alter table public.store_settings add column if not exists gift_wrap_cost_cents integer not null default 0 check (gift_wrap_cost_cents >= 0);

-- Markup que vale para a peça: da peça > da categoria > padrão (decisão 21).
-- Igual a dominio.EffectiveMarkup. Mudou aqui, mude lá.
create or replace function public.effective_markup(p_markup numeric, p_category text)
returns numeric language sql stable set search_path = '' as $$
  select coalesce(
    p_markup,
    (select markup_pct from public.categories where slug = p_category),
    (select default_markup_pct from public.store_settings limit 1),
    200);
$$;

-- Sobe para o próximo X,90. Igual a dominio.RoundTo90.
create or replace function public.round_to_90(c integer)
returns integer language sql immutable as $$
  select case when c <= 0 then 0
              else (c / 100 + case when c % 100 > 90 then 1 else 0 end) * 100 + 90 end;
$$;

-- Preço a partir do custo. Igual a dominio.PriceFromMarkupRounded.
create or replace function public.price_from_cost(p_cost integer, p_markup numeric)
returns integer language sql stable set search_path = '' as $$
  select case when coalesce((select round_to_90 from public.store_settings limit 1), false)
              then public.round_to_90(round(p_cost * (1 + p_markup / 100.0))::integer)
              else round(p_cost * (1 + p_markup / 100.0))::integer end;
$$;

-- Promoções programadas (decisão 32).
create table if not exists public.promotions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 2 and 60),
  pct         integer not null check (pct between 1 and 30),
  scope       text not null check (scope in ('all','category','products')),
  category    text references public.categories(slug) on update cascade on delete cascade,
  product_ids uuid[] not null default '{}',
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  created_at  timestamptz not null default now(),
  constraint ck_promo_window check (ends_at > starts_at),
  constraint ck_promo_scope  check ((scope = 'category') = (category is not null)
                                   and (scope <> 'products' or cardinality(product_ids) > 0))
);
create index if not exists ix_promotions_window on public.promotions (starts_at, ends_at);

-- Maior promoção ativa para a peça agora. Promoções sobrepostas não somam.
create or replace function public.promo_pct(p_id uuid, p_category text)
returns integer language sql stable set search_path = '' as $$
  select coalesce(max(pct), 0) from public.promotions
  where now() >= starts_at and now() < ends_at
    and (scope = 'all'
         or (scope = 'category' and category = p_category)
         or (scope = 'products' and p_id = any(product_ids)));
$$;

-- Kits "compre junto" (decisão 32).
create table if not exists public.kits (
  id          uuid primary key default gen_random_uuid(),
  product_a   uuid not null references public.products(id) on delete cascade,
  product_b   uuid not null references public.products(id) on delete cascade,
  pct         integer not null check (pct between 1 and 30),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint ck_kit_pair check (product_a <> product_b),
  unique (product_a, product_b)
);

-- Pedido: composição do desconto e forma de pagamento escolhida (decisões 32-33).
alter table public.orders add column if not exists kit_discount_cents integer not null default 0 check (kit_discount_cents >= 0);
alter table public.orders add column if not exists pix_discount_cents integer not null default 0 check (pix_discount_cents >= 0);
alter table public.orders add column if not exists payment_choice text check (payment_choice in ('pix','card','boleto'));
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ck_discount_parts') then
    alter table public.orders add constraint ck_discount_parts
      check (kit_discount_cents + pix_discount_cents <= discount_cents);
  end if;
end $$;
-- Preço cheio da unidade, congelado: com promoção, o pedido guarda o cheio e
-- o promocional (unit_price_cents) — é o que permite conferir o teto de 30%.
alter table public.order_items add column if not exists list_price_cents integer check (list_price_cents >= unit_price_cents);

-- Cupom com regras por cliente (decisão 34) e cupom público (aparece em
-- "Meus cupons" na conta).
alter table public.coupons add column if not exists first_order_only  boolean not null default false;
alter table public.coupons add column if not exists once_per_customer boolean not null default false;
alter table public.coupons add column if not exists public            boolean not null default false;
insert into public.coupons (code, kind, value, first_order_only, once_per_customer, public, description)
values ('BEMVINDA10', 'percent', 10, true, true, true, 'Boas-vindas: 10% na primeira compra (decisão 34)')
on conflict do nothing;

-- Cadastro de novidades (pop-up, rodapé, cadastro de conta). Com consentimento.
create table if not exists public.subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  whatsapp        text,
  source          text not null default 'popup' check (source in ('popup','rodape','cadastro','conta')),
  user_id         uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  unsubscribed_at timestamptz
);
create unique index if not exists uq_subscribers_email on public.subscribers (lower(email));

alter table public.profiles add column if not exists birth_date date;

-- Anotações e etiquetas da cliente, só para o painel.
create table if not exists public.customer_notes (
  user_id    uuid primary key references public.users(id) on delete cascade,
  tags       text[] not null default '{}',
  notes      text not null default '' check (length(notes) <= 2000),
  updated_at timestamptz not null default now()
);

-- Esqueci minha senha: guarda só o hash do token.
create table if not exists public.password_resets (
  token_hash text primary key,
  user_id    uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

-- Banners da home e galeria de fotos (decisão 35: imagens em /uploads).
create table if not exists public.banners (
  id         uuid primary key default gen_random_uuid(),
  eyebrow    text not null default '' check (length(eyebrow) <= 40),
  title      text not null check (length(title) between 2 and 90),
  subtitle   text not null default '' check (length(subtitle) <= 200),
  cta_label  text not null default 'Ver peças' check (length(cta_label) <= 30),
  cta_url    text not null default '/categoria/colecoes/todos',
  image      text,
  position   integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.gallery_images (
  id         uuid primary key default gen_random_uuid(),
  image      text not null,
  link       text,
  caption    text,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

-- Texto editável das automações (nulo = texto padrão do código).
alter table public.automation_settings add column if not exists subject text check (subject is null or length(subject) <= 120);
alter table public.automation_settings add column if not exists body    text check (body is null or length(body) <= 2000);

-- Avisos que saíram para a cliente de cada pedido (aparece no drawer).
create table if not exists public.order_notices (
  id        bigserial primary key,
  order_id  uuid not null references public.orders(id) on delete cascade,
  kind      text not null,
  channel   text not null default 'email',
  sent_at   timestamptz not null default now()
);
create index if not exists ix_order_notices on public.order_notices (order_id, sent_at desc);

-- Fila "novos na Lilly": peças do espelho ainda sem produto na loja. Ignorar
-- tira da fila sem apagar o espelho.
alter table public.supplier_products add column if not exists ignored_at timestamptz;

-- Mapeamento de categorias da Lilly: palavra no nome da peça → categoria.
create table if not exists public.category_mappings (
  keyword   text primary key check (keyword = lower(keyword) and length(keyword) between 2 and 40),
  category  text not null references public.categories(slug) on update cascade on delete cascade,
  position  integer not null default 0
);
insert into public.category_mappings (keyword, category, position) values
  ('conjunto', 'conjuntos', 1), ('kit', 'conjuntos', 2), ('anel', 'aneis', 3),
  ('colar', 'colares', 4), ('gargantilha', 'colares', 5), ('choker', 'colares', 6),
  ('pulseira', 'pulseiras', 7), ('bracelete', 'pulseiras', 8), ('berloque', 'berloques', 9),
  ('pingente avulso', 'berloques', 10), ('argola', 'brincos', 10), ('charm', 'berloques', 11), ('brinco', 'brincos', 12)
on conflict do nothing;

-- Relógios: a fornecedora também vende (decisão 37). Categoria e palavras do
-- mapeamento, para a sincronização e a importação por link classificarem certo.
insert into public.categories (slug, label, position) values ('relogios', 'Relógios', 8) on conflict do nothing;
insert into public.category_mappings (keyword, category, position) values
  ('relógio', 'relogios', 0), ('relogio', 'relogios', 0)
on conflict do nothing;

-- Coleções da Mirava (menu "Coleções"): grupos de peças escolhidos e ordenados
-- pela dona, como as coleções da fornecedora (ex.: "It Girl Era"). A peça pode
-- estar em mais de uma. Só peças publicadas aparecem na loja.
create table if not exists public.collections (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null check (length(name) between 2 and 60),
  tagline     text not null default '' check (length(tagline) <= 90),
  description text not null default '' check (length(description) <= 600),
  image       text,
  position    integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create table if not exists public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  position      integer not null default 0,
  primary key (collection_id, product_id)
);
create index if not exists ix_collection_items_product on public.collection_items (product_id);

-- Papéis do painel (decisão 27): master vê tudo; despacho só pedidos e lote.
alter table public.admins add column if not exists role text not null default 'master' check (role in ('master','dispatch'));

-- Sincronização com o markup em camadas (decisão 21).
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

  -- Markup em camadas e ,90 (decisão 21): public.effective_markup e
  -- public.price_from_cost, definidas na seção 09. Iguais ao Go.
  v_new_price := public.price_from_cost(p_new_cost, public.effective_markup(r.markup_pct, r.category));

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

-- Reembolso e cancelamento pela cliente (decisão 43): o pedido pode ser
-- estornado em qualquer etapa depois de pago. Mesma tabela de dominio/pedido.go.
create or replace function public.valid_transition(from_status text, to_status text)
returns boolean
language sql
immutable
as $$
  select case from_status
    when 'awaiting_payment'         then to_status in ('paid','cancelled')
    when 'paid'                     then to_status in ('in_batch','refunded','out_of_stock')
    when 'in_batch'                 then to_status in ('purchased_from_supplier','out_of_stock','paid','refunded')
    when 'purchased_from_supplier'  then to_status in ('received_by_owner','out_of_stock','refunded')
    when 'received_by_owner'        then to_status in ('shipped','refunded')
    when 'shipped'                  then to_status in ('delivered','refunded')
    when 'delivered'                then to_status in ('refunded')
    when 'cancelled'                then false
    when 'refunded'                 then false
    when 'out_of_stock'             then to_status in ('refunded','in_batch')
    else false
  end;
$$;

-- Leitura incremental da Lilly (plano de ação, etapa 2): o lastmod do sitemap
-- e quando cada página foi lida, para a sincronização pular o que não mudou.
create table if not exists public.sync_urls (
  supplier_id  uuid not null references public.suppliers(id) on delete cascade,
  url          text not null,
  lastmod      text,
  checked_at   timestamptz not null default now(),
  primary key (supplier_id, url)
);

-- Páginas já lidas antes desta tabela entram sem lastmod: a primeira rodada
-- não relê tudo de uma vez, renova as mais antigas aos poucos.
insert into public.sync_urls (supplier_id, url, checked_at)
select supplier_id, url, last_seen_at from public.supplier_products
where url is not null
on conflict do nothing;

-- Usuários do painel (decisão 46): login próprio, por nome de usuário e senha,
-- separado das contas da loja. O papel continua aqui, nunca num campo que o
-- usuário edita. A tabela admins (acesso pela conta da loja) deixou de ser usada.
create table if not exists public.admin_users (
  id             uuid primary key default gen_random_uuid(),
  username       text not null unique check (username ~ '^[a-z0-9._-]{3,40}$'),
  name           text not null,
  password_hash  text not null,
  role           text not null default 'master' check (role in ('master', 'dispatch')),
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz
);
