-- Mais vendidos: dois sinais na tabela `products`.
--
--   supplier_rank  posição na vitrine "Mais vendidos" da Lilly (1 = topo).
--                  Emprestado, reescrito a cada sincronização.
--   units_sold     unidades vendidas PELA MIRAVA em pedidos pagos. Dado
--                  próprio, recalculado pela tarefa; é ele que faz a loja
--                  parar de depender da vitrine da fornecedora.
--
-- A vitrine ordena por units_sold desc e usa supplier_rank só para desempatar.
-- Enquanto não houver venda própria, a lista é a da Lilly; conforme a Mirava
-- vende, a lista vira dela sozinha, sem precisar mexer em código.
--
-- Como rodar:
--   docker exec -i mirava-postgres psql -U mirava -d mirava < db/alter-mais-vendidos.sql

alter table public.products
  add column if not exists supplier_rank integer,
  add column if not exists units_sold    integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_supplier_rank_check') then
    alter table public.products
      add constraint products_supplier_rank_check check (supplier_rank > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_units_sold_check') then
    alter table public.products
      add constraint products_units_sold_check check (units_sold >= 0);
  end if;
end $$;

create index if not exists ix_products_best on public.products
  (units_sold desc, supplier_rank asc nulls last) where published;

comment on column public.products.supplier_rank is
  'Posição na vitrine de mais vendidos da fornecedora. Reescrita a cada sincronização.';
comment on column public.products.units_sold is
  'Unidades vendidas pela Mirava em pedidos pagos. Recalculada pela tarefa de mais vendidos.';

-- Confere:
select count(*) filter (where supplier_rank is not null) as com_rank_da_lilly,
       count(*) filter (where units_sold > 0)            as com_venda_propria
from public.products;
