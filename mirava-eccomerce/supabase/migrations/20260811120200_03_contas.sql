-- 03 · Contas de cliente
--
-- Supabase gerencia auth.users. Aqui mora só o que é da Mirava.
--
-- ATENÇÃO ao papel de admin: ele vive em tabela própria, NUNCA em
-- user_metadata. O próprio usuário consegue editar user_metadata via API —
-- guardar {role:'admin'} lá significa que qualquer cliente cadastrada vira
-- administradora com uma chamada.

create table public.perfis (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text not null default '',
  telefone      text,
  cpf           text,
  aceita_email  boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger t_perfis_atualizado
  before update on public.perfis
  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- Perfil criado pelo banco, não pelo front-end.
-- Se a criação dependesse de uma chamada do cliente e ela falhasse, você
-- ficaria com usuário sem perfil — um estado inválido difícil de detectar.
-- ---------------------------------------------------------------------------
create or replace function public.ao_criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',   -- vem preenchido no login Google
      new.raw_user_meta_data ->> 'name',
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger t_ao_criar_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario();

-- ---------------------------------------------------------------------------
create table public.enderecos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  apelido      text,
  destinatario text not null,
  cep          text not null check (cep ~ '^\d{5}-?\d{3}$'),
  rua          text not null,
  numero       text not null,
  complemento  text,
  bairro       text not null,
  cidade       text not null,
  uf           char(2) not null check (uf ~ '^[A-Z]{2}$'),
  principal    boolean not null default false,
  criado_em    timestamptz not null default now()
);

create index ix_enderecos_user on public.enderecos (user_id);

-- Só um endereço principal por pessoa.
create unique index uq_endereco_principal
  on public.enderecos (user_id) where principal;

-- ---------------------------------------------------------------------------
create table public.favoritos (
  user_id    uuid not null references auth.users(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  criado_em  timestamptz not null default now(),
  primary key (user_id, produto_id)
);

create index ix_favoritos_produto on public.favoritos (produto_id);

-- ---------------------------------------------------------------------------
-- Admin. Uma linha aqui = acesso total. Adicione a si mesma manualmente:
--   insert into admins (user_id) values ('<seu uuid de auth.users>');
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);

create or replace function public.eh_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;

comment on function public.eh_admin is
  'Papel de admin por tabela. Nunca use user_metadata para isso — o usuário edita esse campo.';
