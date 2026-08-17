# Banco próprio da Mirava

Substitui o Supabase (ver `docs/ARQUITETURA.md`, decisão 15). Postgres
comum, sem RLS nem papéis `anon`/`authenticated` — a API Go conecta como
dona do banco e filtra por `user_id` explicitamente.

## Rodar local

```bash
cd mirava-eccomerce/db
docker compose up -d
```

Espera uns segundos o Postgres subir, depois aplica o schema:

```bash
docker exec -i mirava-postgres psql -U mirava -d mirava < schema.sql
```

Confirma que criou as tabelas:

```bash
docker exec -it mirava-postgres psql -U mirava -d mirava -c '\dt public.*'
```

## .env da API

Já está preenchido em `mirava-eccomerce/api/.env`:

```
DATABASE_URL=postgresql://mirava:mirava_dev_local@localhost:5432/mirava
```

## Criar a primeira admin (você)

Depois de cadastrar sua conta pelo `/auth/cadastrar` da API, pegue o `id`
dela e rode:

```sql
insert into public.admins (user_id) values ('<uuid da sua conta>');
```

## Depois, na VPS da Hostinger

Mesma imagem (`postgres:16`), mesmo `schema.sql`. Troca só a senha (gere
uma forte, não use `mirava_dev_local`) e o `DATABASE_URL` aponta pro IP/host
da VPS em vez de `localhost`.
