# Como subir o banco — passo a passo

Roteiro para criar o projeto no Supabase e aplicar as migrations. Faça na
ordem; cada passo depende do anterior.

Tempo estimado: 20 a 30 minutos.

---

## 1. Criar a conta e o projeto

1. Acesse [supabase.com](https://supabase.com) e entre com o GitHub
2. **New project**
3. Preencha:

| Campo | Valor | Por quê |
|---|---|---|
| Name | `mirava-dev` | comece pelo de desenvolvimento |
| Database Password | gere uma forte | ⚠️ **anote agora** |
| Region | **South America (São Paulo)** | "Americas" é o grupo — abra e escolha São Paulo. Região errada adiciona ~200ms em cada consulta |
| Plan | Free | cobre o primeiro ano com folga |

### Os três interruptores de Security

| Opção | Deixe | Por quê |
|---|---|---|
| Enable Data API | **ligado** | é por aqui que o site lê o catálogo com `supabase-js` |
| Automatically expose new tables | **desligado** | recomendação do próprio Supabase: tabela nova não vira endpoint público por descuido. A migration 09 concede os privilégios explicitamente |
| Enable automatic RLS | **ligado** | rede de segurança: se um dia você criar tabela e esquecer, o RLS entra ligado sozinho |

> **Por que a migration 09 existe:** com a auto-exposição desligada, são duas
> fechaduras diferentes. O `GRANT` do Postgres decide *se* o papel toca na
> tabela; o RLS decide *quais linhas* ele enxerga. As duas precisam abrir —
> policy sem grant não funciona, e grant sem policy não vaza nada.

> ⚠️ **A senha do banco aparece uma vez só.** Copie para um gerenciador de
> senhas antes de clicar em criar. Recuperar depois dá trabalho.

O projeto leva 2 a 3 minutos para ficar pronto.

### Por que dois projetos

O plano grátis permite 2 projetos ativos — exatamente o necessário:

- `mirava-dev` — onde você testa, quebra e recria à vontade
- `mirava-prod` — o de verdade, criado só quando for lançar

Nunca teste no de produção. Um `delete from pedidos` sem `where` no lugar
errado apaga o histórico de vendas real.

---

## 2. Instalar a CLI

```bash
brew install supabase/tap/supabase
supabase --version
```

---

## 3. Conectar o projeto

Pegue o **Project Ref** no painel: Settings → General → Reference ID
(algo como `abcdefghijklmnop`).

```bash
cd ~/Documents/mirava/mirava-eccomerce      # ← o PAI de supabase/, não dentro dela
supabase login                              # abre o navegador
supabase link --project-ref SEU_PROJECT_REF
```

Ele vai pedir a senha do banco — a que você anotou no passo 1.

> ⚠️ **Rode de `mirava-eccomerce/`, não de dentro de `supabase/`.** A CLI
> procura por `supabase/config.toml` a partir de onde você está. Estando
> dentro da pasta, ela procuraria `supabase/supabase/config.toml` e daria
> `Cannot find project ref`.

---

## 4. Aplicar as migrations

Ainda de `mirava-eccomerce/`:

```bash
supabase db push
```

Você deve ver as 9 migrations sendo aplicadas em ordem:

```
Applying migration 20260811120000_01_base.sql...
Applying migration 20260811120100_02_catalogo.sql...
...
Applying migration 20260811120800_09_grants.sql...
Finished supabase db push.
```

**Se falhar**, a mensagem diz qual migration e qual linha. Nada foi aplicado
pela metade — o Supabase roda cada migration em transação.

### Se precisar recomeçar do zero (só no dev)

```bash
supabase db reset --linked
```

Apaga tudo e reaplica. **Nunca rode isso em produção.**

---

## 5. Verificar

No painel: **SQL Editor** → New query → cole todo o conteúdo de
`verificar.sql` → Run.

Esperado no final:

```
=========== TUDO OK ===========
```

Se parar com exceção, a mensagem diz exatamente o que falhou. Me manda.

---

## 6. Configurar a autenticação

**Authentication → Providers → Email**

- `Enable Email provider`: ligado
- `Confirm email`: **desligue no dev**. Ligado, cada cadastro de teste exige
  abrir e-mail e clicar em link — inviável para testar. **Religue antes de
  lançar**, senão qualquer pessoa cria conta com e-mail de outra.

**Authentication → URL Configuration**

- Site URL: `http://localhost:5173` (troque pelo domínio real no prod)
- Redirect URLs: adicione `http://localhost:5173/**`

O login com Google exige criar credenciais OAuth no Google Cloud. Pode ficar
para depois — e-mail e senha já destravam todo o resto.

---

## 7. Criar seu usuário admin

**Authentication → Users → Add user → Create new user**

- E-mail: o seu
- Senha: escolha uma
- `Auto Confirm User`: marque

Copie o **UID** que aparece na lista. Depois, no SQL Editor:

```sql
insert into admins (user_id) values ('COLE_O_UID_AQUI');

-- confere
select p.nome, a.user_id from admins a join perfis p on p.id = a.user_id;
```

> Se o perfil não existir, o trigger `ao_criar_usuario` não rodou — significa
> que a migration 03 não foi aplicada. Volte ao passo 4.

---

## 8. Testar o vazamento por RLS

**Este é o teste mais importante de todos.** A chave anon fica dentro do
JavaScript público do site; o RLS é a única coisa que impede alguém de baixar
sua tabela de pedidos com CPF e endereço das clientes.

Pegue a chave em Settings → API → `anon public`, e rode no terminal:

```bash
export REF=SEU_PROJECT_REF
export ANON=SUA_ANON_KEY

# Deve devolver []  ← vazio
curl -s "https://$REF.supabase.co/rest/v1/pedidos?select=*" -H "apikey: $ANON"

# Deve devolver []
curl -s "https://$REF.supabase.co/rest/v1/perfis?select=*" -H "apikey: $ANON"
curl -s "https://$REF.supabase.co/rest/v1/enderecos?select=*" -H "apikey: $ANON"
curl -s "https://$REF.supabase.co/rest/v1/lotes?select=*" -H "apikey: $ANON"

# Este deve FUNCIONAR (a vitrine precisa ler) — devolve [] só porque
# ainda não há produto publicado
curl -s "https://$REF.supabase.co/rest/v1/produtos?select=nome" -H "apikey: $ANON"
```

Se algum dos quatro primeiros devolver dado, **pare tudo**: é vazamento de
dado pessoal e cai na LGPD. Revise a migration 07.

---

## 9. Preencher o `.env` da API

Settings → Database → Connection string → **Transaction pooler** (porta 6543).

```bash
cd ~/Documents/mirava/mirava-eccomerce/api
cp .env.exemplo .env
```

Preencha:

| Variável | Onde achar |
|---|---|
| `DATABASE_URL` | Settings → Database → Connection string → Transaction pooler |
| `SUPABASE_JWT_SECRET` | Settings → API → JWT Settings → JWT Secret |
| `CRON_SECRET` | gere: `openssl rand -hex 32` |
| `MP_*` | Mercado Pago (próxima etapa) |

> Use o **pooler** (6543), não a conexão direta (5432). O Cloud Run sobe
> várias instâncias e cada uma abre conexões; sem pooler você esgota o limite
> do plano grátis rapidinho.

Depois, para conferir que a API fala com o banco:

```bash
go run ./cmd/servidor
# em outro terminal:
curl http://localhost:8080/saude
# esperado: {"ok":true}
```

Sem as variáveis do Mercado Pago o servidor recusa subir de propósito — ele
lista quais faltam. Para testar só o banco, preencha `MP_ACCESS_TOKEN`,
`MP_WEBHOOK_SECRET` e `SITE_URL` com qualquer texto temporário.

---

## Checklist

- [ ] Projeto `mirava-dev` criado na região de São Paulo
- [ ] Senha do banco guardada em lugar seguro
- [ ] `supabase db push` aplicou as 8 migrations
- [ ] `verificar.sql` imprimiu `TUDO OK`
- [ ] Confirmação de e-mail desligada (só no dev)
- [ ] Seu usuário criado e inserido em `admins`
- [ ] Teste de vazamento: `pedidos`, `perfis`, `enderecos` e `lotes` devolvem `[]`
- [ ] `.env` da API preenchido
- [ ] `curl localhost:8080/saude` devolve `{"ok":true}`

---

## Uma pegadinha do plano grátis

O projeto **pausa depois de 7 dias sem nenhuma requisição**. Enquanto você
estiver desenvolvendo e sumir uma semana, ele dorme e você precisa religar
pelo painel. Com a loja no ar e recebendo visita isso não acontece.

Se incomodar durante o desenvolvimento, um monitor gratuito (UptimeRobot)
apontando para a URL do projeto resolve.
