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
