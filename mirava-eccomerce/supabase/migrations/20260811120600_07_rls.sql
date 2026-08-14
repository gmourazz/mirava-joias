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
