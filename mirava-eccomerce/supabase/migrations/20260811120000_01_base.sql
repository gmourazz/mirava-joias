-- 01 · Fundação: extensões e helpers usados por todas as outras migrations.
--
-- Convenções deste banco:
--   • Dinheiro é SEMPRE integer em centavos, com sufixo _centavos. Nunca float.
--   • Datas são timestamptz. O fuso de referência do negócio é America/Sao_Paulo.
--   • Status são text + CHECK (não enum) — adicionar um status novo é só alterar
--     a constraint, sem a dor de ALTER TYPE fora de transação.

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_cron";       -- agendamento da sincronização
create extension if not exists "pg_net";        -- chamar Edge Function pelo cron

-- ---------------------------------------------------------------------------
-- atualizado_em automático
-- ---------------------------------------------------------------------------
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

comment on function public.tocar_atualizado_em is
  'Trigger genérico: mantém atualizado_em em dia. Use com before update.';

-- ---------------------------------------------------------------------------
-- Dias úteis
-- ---------------------------------------------------------------------------
-- Conta dias úteis completos decorridos desde um instante até agora.
-- Usado pela regra do teto do lote (fecha quando o pedido mais antigo
-- completa N dias úteis).
--
-- LIMITAÇÃO CONHECIDA: ignora feriados nacionais. Para a regra de lote isso
-- é aceitável — errar por um dia a favor da cliente não causa problema.
-- Se um dia precisar de precisão, crie uma tabela `feriados` e desconte aqui.
create or replace function public.dias_uteis_desde(inicio timestamptz)
returns integer
language sql
stable
as $$
  select greatest(0, count(*)::int - 1)
  from generate_series(
    (inicio at time zone 'America/Sao_Paulo')::date,
    (now()   at time zone 'America/Sao_Paulo')::date,
    interval '1 day'
  ) as d
  where extract(isodow from d) < 6;
$$;

comment on function public.dias_uteis_desde is
  'Dias úteis completos entre o instante dado e agora, fuso de São Paulo. Ignora feriados.';

-- ---------------------------------------------------------------------------
-- Slug
-- ---------------------------------------------------------------------------
-- Remoção de acentos sem depender da extensão unaccent (que exige permissão
-- de superusuário em alguns planos). translate resolve o português inteiro.
-- Precisa vir ANTES de gerar_slug: o Postgres valida o corpo das funções SQL
-- no momento da criação, então uma função que ainda não existe quebra aqui.
create or replace function public.unaccent_simples(texto text)
returns text
language sql
immutable
as $$
  select translate(
    texto,
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  );
$$;

-- "Pulseira Prata - Riviera Cristal" -> "pulseira-prata-riviera-cristal"
create or replace function public.gerar_slug(texto text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(public.unaccent_simples(texto)),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
$$;
