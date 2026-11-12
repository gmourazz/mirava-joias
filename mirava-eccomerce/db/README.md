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

**Banco que já existia antes do design v5?** O `schema.sql` serve para banco
novo. Para um banco que já tem dados, aplique a alteração do bloco de
descontos, Club, avaliações, trocas, vitrine e automações (decisão 31) — ela
pode rodar mais de uma vez sem estragar nada:

```bash
docker exec -i mirava-postgres psql -U mirava -d mirava < alter-design-v5.sql
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

## Criar um usuário do painel

O painel tem login próprio, por nome de usuário e senha, separado das contas da
loja (decisão 46). Para criar um acesso, rode na pasta `api/` com o banco no ar.
A senha vai pela entrada padrão, para não ficar em arquivo:

```bash
cd mirava-eccomerce/api
read -s SENHA && printf '%s' "$SENHA" | go run ./cmd/criar-admin -usuario fulana -nome "Fulana" -papel master
```

`-papel dispatch` cria acesso só de pedidos e lote. Depois de ter uma master,
os acessos de despacho também podem ser criados pelo painel, em Configurações →
Equipe. O painel abre em `/admin/entrar`.

## Depois, na VPS da Hostinger

Mesma imagem (`postgres:16`), mesmo `schema.sql`. Troca só a senha (gere
uma forte, não use `mirava_dev_local`) e o `DATABASE_URL` aponta pro IP/host
da VPS em vez de `localhost`.
