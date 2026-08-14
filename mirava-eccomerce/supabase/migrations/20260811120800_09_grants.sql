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
