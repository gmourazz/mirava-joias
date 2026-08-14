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
