-- Adiciona o método de frete aos pedidos.
--
-- Rode isto no banco que JÁ EXISTE. O schema.sql também foi atualizado, mas
-- ele só vale para banco novo — reaplicar o schema inteiro apagaria os dados.
--
-- É seguro: só adiciona coluna, não mexe em nada existente. Pedidos antigos
-- ficam com shipping_method nulo, que é a verdade (foram feitos antes de
-- existir escolha de frete).

alter table public.orders
  add column if not exists shipping_method text;

-- A restrição vai separada porque, se a coluna já existisse com lixo dentro,
-- o alter acima passaria e este falharia — dizendo exatamente onde está o
-- problema, em vez de recusar tudo sem explicar.
alter table public.orders
  drop constraint if exists ck_orders_shipping_method;

alter table public.orders
  add constraint ck_orders_shipping_method
  check (shipping_method is null or shipping_method in ('economico','sedex'));

-- Rótulo do grupo de opção da Lilly ('Tamanho', 'Letras'). Fica nulo até a
-- próxima sincronização preencher.
alter table public.products
  add column if not exists variant_label text;
