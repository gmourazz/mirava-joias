-- Peça de teste de R$ 1,00, para fechar um pedido de verdade sem gastar.
--
-- Existe só para exercitar o caminho do dinheiro de ponta a ponta: checkout,
-- Mercado Pago, webhook, e-mail de confirmação e a tela de despacho. Some da
-- loja com o comando de remoção lá no fim.
--
-- Como rodar:
--   docker exec -i mirava-postgres psql -U mirava -d mirava < db/produto-teste.sql

insert into public.products (
  supplier_product_id,   -- nulo: esta peça não veio da Lilly
  slug, name, description,
  price_cents,           -- R$ 1,00
  cost_cents,
  auto_price,            -- FALSO, e isso importa (ver abaixo)
  category, metal, images, published, featured
) values (
  null,
  'peca-de-teste-mirava',
  'PRODUTO TESTE — não é uma peça à venda',
  E'Este é um PRODUTO DE TESTE da loja. Não é uma joia, não existe, '
  || E'e nada será enviado.\n\n'
  || E'Ele serve só para conferir se o pagamento, a confirmação por e-mail e '
  || E'o acompanhamento do pedido estão funcionando, usando o valor simbólico '
  || E'de R$ 1,00 em vez do preço de uma peça de verdade.\n\n'
  || E'Se você é cliente e chegou aqui por acaso, pode ignorar — nenhuma peça '
  || E'do catálogo tem relação com este item.',
  100,
  0,

  -- auto_price = false é a linha mais importante deste arquivo.
  --
  -- Com true, a próxima sincronização recalcularia o preço a partir do custo
  -- (custo × 3) e esta peça sairia de R$ 1,00 para R$ 0,00 — que o CHECK
  -- (price_cents > 0) recusaria, ou pior, viraria outro valor no meio do seu
  -- teste. Preço fixo, decidido aqui, imune à sincronização.
  false,

  'outros',
  'prata',
  '{}',                  -- sem foto: a vitrine mostra "sem foto", e tudo bem
  true,                  -- publicada, senão não aparece para comprar
  false                  -- fora dos destaques, para não ocupar a home
)
-- Rodar de novo é seguro: atualiza em vez de duplicar.
on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  price_cents = 100,
  published   = true,
  auto_price  = false;

-- Confere que entrou:
select name, price_cents, published, auto_price
from public.products where slug = 'peca-de-teste-mirava';

-- ---------------------------------------------------------------------------
-- QUANDO TERMINAR O TESTE, tire a peça do ar com:
--
--   update public.products set published = false
--   where slug = 'peca-de-teste-mirava';
--
-- Prefira despublicar a apagar: se ela já estiver dentro de um pedido de
-- teste, o delete falharia (ou levaria o pedido junto) e você perderia o
-- histórico que acabou de criar.
-- ---------------------------------------------------------------------------
