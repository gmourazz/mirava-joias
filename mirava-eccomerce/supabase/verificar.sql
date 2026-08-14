-- Verificação do banco da Mirava
--
-- Rode no SQL Editor do Supabase DEPOIS de aplicar as migrations.
-- Cada bloco levanta exceção se algo estiver errado. Se rodar até o fim
-- imprimindo "TUDO OK", o banco está íntegro.
--
--   supabase db push        # aplica as migrations
--   (cole este arquivo no SQL Editor e execute)

do $$
declare
  v_pedido   uuid;
  v_lote     uuid;
  v_erro     text;
  v_resultado text;
  v_produto  uuid;
  v_espelho  uuid;
  v_forn     uuid;
  v_preco    integer;
begin
  raise notice '--- 1. Tabelas existem ---';
  perform 1 from information_schema.tables
   where table_schema='public'
     and table_name in ('produtos','pedidos','pedido_itens','pagamentos',
                        'lotes','perfis','enderecos','favoritos','admins',
                        'fornecedor_produtos','regras_preco','sincronizacoes')
  having count(*) = 12;
  if not found then
    raise exception 'FALHOU: faltam tabelas. Aplicou todas as migrations?';
  end if;
  raise notice 'ok';

  raise notice '--- 2. RLS ligado em tudo ---';
  select string_agg(tablename, ', ') into v_erro
  from pg_tables
  where schemaname='public'
    and tablename in ('produtos','pedidos','pedido_itens','pagamentos','lotes',
                      'perfis','enderecos','favoritos','admins','fornecedor_produtos')
    and not rowsecurity;
  if v_erro is not null then
    raise exception 'FALHOU: RLS desligado em: %', v_erro;
  end if;
  raise notice 'ok';

  raise notice '--- 3. Dias úteis ---';
  -- 2026-08-03 é segunda. Até a segunda seguinte são 5 dias úteis.
  if public.dias_uteis_desde('2026-08-03'::timestamptz) < 0 then
    raise exception 'FALHOU: dias_uteis_desde devolveu negativo';
  end if;
  raise notice 'ok';

  raise notice '--- 4. Máquina de estados ---';
  if not public.transicao_valida('aguardando_pagamento','pago') then
    raise exception 'FALHOU: aguardando_pagamento -> pago deveria ser válida';
  end if;
  if public.transicao_valida('aguardando_pagamento','enviado') then
    raise exception 'FALHOU: despachar sem receber pagamento foi permitido';
  end if;
  if public.transicao_valida('entregue','enviado') then
    raise exception 'FALHOU: voltar de entregue para enviado foi permitido';
  end if;
  if public.transicao_valida('estornado','enviado') then
    raise exception 'FALHOU: despachar pedido estornado foi permitido';
  end if;
  raise notice 'ok';

  raise notice '--- 5. Só um lote aberto por vez ---';
  begin
    insert into lotes (status) values ('aberto');
    insert into lotes (status) values ('aberto');
    raise exception 'FALHOU: o banco aceitou dois lotes abertos';
  exception when unique_violation then
    raise notice 'ok (o segundo lote aberto foi recusado)';
  end;

  raise notice '--- 6. Trigger de transição bloqueia pulo de etapa ---';
  select id into v_lote from lotes where status='aberto' limit 1;

  insert into pedidos (status, cliente_nome, cliente_email, endereco,
                       subtotal_centavos, frete_centavos, desconto_centavos, total_centavos)
  values ('aguardando_pagamento','Teste','teste@exemplo.com','{"cidade":"BH"}'::jsonb,
          6900, 0, 0, 6900)
  returning id into v_pedido;

  begin
    update pedidos set status='enviado' where id=v_pedido;
    raise exception 'FALHOU: a trigger deixou pular de aguardando_pagamento para enviado';
  exception when check_violation then
    raise notice 'ok (transição inválida recusada)';
  end;

  raise notice '--- 7. Pedido pago entra no lote e gera evento ---';
  update pedidos set status='pago' where id=v_pedido;

  perform 1 from pedidos where id=v_pedido and lote_id is not null;
  if not found then
    raise exception 'FALHOU: pedido pago ficou sem lote';
  end if;

  perform 1 from eventos_pedido
   where pedido_id=v_pedido and para_status='pago';
  if not found then
    raise exception 'FALHOU: transição não gerou evento no histórico';
  end if;
  raise notice 'ok';

  raise notice '--- 8. Constraint de total coerente ---';
  begin
    insert into pedidos (status, cliente_nome, cliente_email, endereco,
                         subtotal_centavos, frete_centavos, desconto_centavos, total_centavos)
    values ('aguardando_pagamento','Teste','t@e.com','{}'::jsonb, 1000, 0, 0, 9999);
    raise exception 'FALHOU: aceitou total que não bate com subtotal + frete - desconto';
  exception when check_violation then
    raise notice 'ok';
  end;

  raise notice '--- 9. Idempotência do pagamento ---';
  insert into pagamentos (pedido_id, mp_payment_id, status, valor_centavos)
  values (v_pedido, 'TESTE-VERIFICACAO-1', 'approved', 6900);
  begin
    insert into pagamentos (pedido_id, mp_payment_id, status, valor_centavos)
    values (v_pedido, 'TESTE-VERIFICACAO-1', 'approved', 6900);
    raise exception 'FALHOU: o mesmo mp_payment_id entrou duas vezes (faturamento inflaria)';
  exception when unique_violation then
    raise notice 'ok (webhook repetido não duplica)';
  end;

  raise notice '--- 10. Disjuntor de preço ---';
  select id into v_forn from fornecedores limit 1;
  if v_forn is null then
    raise exception 'FALHOU: fornecedora não foi semeada (migration 08)';
  end if;

  insert into fornecedor_produtos (fornecedor_id, sku, url, nome, custo_centavos, varejo_centavos)
  values (v_forn, 'TESTE-DISJ', 'https://exemplo', 'Peça de teste', 2300, 3290)
  returning id into v_espelho;

  insert into produtos (fornecedor_produto_id, slug, nome, preco_centavos,
                        custo_centavos, markup_pct, categoria, metal, publicado)
  values (v_espelho, 'peca-de-teste-verificacao', 'Peça de teste', 6900,
          2300, 200, 'pulseiras', 'prata', false)
  returning id into v_produto;

  -- reajuste pequeno: deve aplicar sozinho
  v_resultado := public.aplicar_custo_sincronizado(v_produto, 2400);
  if v_resultado <> 'preço atualizado' then
    raise exception 'FALHOU: reajuste pequeno deveria aplicar, veio "%"', v_resultado;
  end if;
  select preco_centavos into v_preco from produtos where id=v_produto;
  if v_preco <> 7200 then
    raise exception 'FALHOU: preço = %, esperado 7200 (2400 com markup de 200%%)', v_preco;
  end if;

  -- extrator quebrado lendo R$2 no lugar de R$24: deve TRAVAR
  v_resultado := public.aplicar_custo_sincronizado(v_produto, 200);
  if v_resultado <> 'travado pelo disjuntor' then
    raise exception 'FALHOU: variação absurda deveria travar, veio "%"', v_resultado;
  end if;
  select preco_centavos into v_preco from produtos where id=v_produto;
  if v_preco <> 7200 then
    raise exception 'FALHOU: o disjuntor deixou o preço ser sobrescrito (virou %)', v_preco;
  end if;
  perform 1 from produtos where id=v_produto and preco_sugerido_centavos is not null;
  if not found then
    raise exception 'FALHOU: travou mas não registrou a sugestão pendente';
  end if;
  raise notice 'ok (preço preservado, sugestão registrada)';

  raise notice '--- Limpando dados de teste ---';
  delete from produtos where id=v_produto;
  delete from fornecedor_produtos where id=v_espelho;
  delete from pedidos where id=v_pedido;
  delete from lotes where custo_total_centavos=0
    and id not in (select id from lotes where status='aberto' limit 1);

  raise notice '';
  raise notice '=========== TUDO OK ===========';
end $$;

-- ---------------------------------------------------------------------------
-- Teste de vazamento por RLS
--
-- O SQL Editor roda como dono do banco e ignora RLS, então este teste NÃO
-- pode ser feito aqui. Rode do seu computador, com a chave ANON (a mesma que
-- está no bundle público do site):
--
--   curl "https://<PROJECT_REF>.supabase.co/rest/v1/pedidos?select=*" \
--     -H "apikey: <ANON_KEY>"
--
-- Resposta esperada: []
-- Se vier qualquer pedido, você tem vazamento de dado pessoal (LGPD) —
-- endereço e CPF de clientes expostos. Pare tudo e revise a migration 07.
--
-- Faça o mesmo com: perfis, enderecos, pagamentos, lotes, fornecedor_produtos.
-- E confirme que produtos publicados APARECEM (a vitrine precisa funcionar):
--
--   curl "https://<PROJECT_REF>.supabase.co/rest/v1/produtos?select=nome,preco_centavos" \
--     -H "apikey: <ANON_KEY>"
-- ---------------------------------------------------------------------------
