# API Mirava

Backend em Go. Postgres e autenticação ficam no Supabase; esta API é quem
calcula preço, recebe o webhook do Mercado Pago, sincroniza o catálogo da
Lilly e decide quando fechar o lote de compra.

## Estrutura

```
cmd/servidor/          entrada, wiring, encerramento gradual
internal/
  dominio/             regras puras — não importa banco, HTTP nem nada
    dinheiro.go        Cents (inteiro), nunca float
    precificacao.go    markup, desconto, margem, disjuntor
    pedido.go          máquina de estados
    lote.go            regra do R$300 e do teto de dias
  lilly/               leitura do catálogo (ISO-8859-1) + salvaguardas
  mercadopago/         preferência, consulta, validação de assinatura
  auth/                validação do JWT do Supabase
  db/                  acesso ao Postgres (pgx)
  web/                 handlers HTTP
```

A dependência aponta sempre para dentro: `web` → `db`/`mercadopago` → `dominio`.
O pacote `dominio` não importa nenhum dos outros — é o que permite testar a
regra de preço sem subir banco.

## Rodando local

```bash
cp .env.exemplo .env    # preencha
go mod tidy
go test ./...           # o domínio inteiro roda em milissegundos
go run ./cmd/servidor
```

## Variáveis de ambiente

| Variável | O que é | Onde achar |
|---|---|---|
| `DATABASE_URL` | conexão Postgres | Supabase → Settings → Database → Connection string (use o **pooler**, porta 6543) |
| `SUPABASE_JWT_SECRET` | valida o token da cliente | Supabase → Settings → API → JWT Secret |
| `MP_ACCESS_TOKEN` | chamadas à API | Mercado Pago → Suas integrações → Credenciais |
| `MP_WEBHOOK_SECRET` | valida a assinatura do webhook | Mercado Pago → Webhooks → Assinatura secreta |
| `MP_MODO` | `teste` usa o sandbox | você define |
| `SITE_URL` | origem do front, para CORS e retorno | ex: `https://miravajoias.com.br` |
| `WEBHOOK_URL` | URL pública desta API + `/webhook/mercadopago` | depois do deploy |
| `CRON_SECRET` | protege as rotas de tarefa | gere: `openssl rand -hex 32` |
| `PARCELAS_SEM_JUROS` | padrão 3 | 12x custaria 12,49% do seu lucro |

**Nenhuma delas pode ir para o front-end.** No Vite, tudo que começa com
`VITE_` é embutido no bundle e fica visível para qualquer pessoa.

## Rotas

| Rota | Autorização | O que faz |
|---|---|---|
| `GET /saude` | pública | health check do Cloud Run |
| `POST /checkout` | JWT da cliente | cria o pedido e devolve a URL de pagamento |
| `POST /webhook/mercadopago` | assinatura HMAC | confirma pagamento — a fonte da verdade |
| `POST /tarefas/sincronizar` | `CRON_SECRET` | varre o catálogo da Lilly |
| `POST /tarefas/avaliar-lote` | `CRON_SECRET` | fecha o lote se bateu meta ou teto |

## Deploy no Cloud Run

```bash
gcloud auth login
gcloud config set project SEU_PROJETO

gcloud run deploy mirava-api \
  --source . \
  --region southamerica-east1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 3 \
  --memory 512Mi \
  --timeout 3600 \
  --set-env-vars "SITE_URL=https://miravajoias.com.br,MP_MODO=producao,PARCELAS_SEM_JUROS=3" \
  --set-secrets "DATABASE_URL=mirava-db:latest,SUPABASE_JWT_SECRET=mirava-jwt:latest,MP_ACCESS_TOKEN=mirava-mp-token:latest,MP_WEBHOOK_SECRET=mirava-mp-webhook:latest,CRON_SECRET=mirava-cron:latest"
```

Guarde os segredos no Secret Manager, não em `--set-env-vars`:

```bash
echo -n "postgresql://..." | gcloud secrets create mirava-db --data-file=-
```

`--allow-unauthenticated` é necessário porque o Mercado Pago precisa alcançar
o webhook. A proteção real são a assinatura HMAC e o `CRON_SECRET`.

`--min-instances 0` deixa escalar a zero: você só paga o que usar, e o free
tier (2 milhões de requisições/mês) cobre a operação com folga. O custo é uma
partida a frio de 1 a 2 segundos na primeira visita depois de um período
parado — aceitável para uma loja começando.

## Agendamentos (Cloud Scheduler)

```bash
# Sincronizar o catálogo a cada 6 horas
gcloud scheduler jobs create http mirava-sincronizar \
  --location southamerica-east1 \
  --schedule "0 */6 * * *" \
  --time-zone "America/Sao_Paulo" \
  --uri "https://SUA-API.run.app/tarefas/sincronizar" \
  --http-method POST \
  --headers "Authorization=Bearer SEU_CRON_SECRET"

# Avaliar o lote todo dia útil às 9h
gcloud scheduler jobs create http mirava-lote \
  --location southamerica-east1 \
  --schedule "0 9 * * 1-5" \
  --time-zone "America/Sao_Paulo" \
  --uri "https://SUA-API.run.app/tarefas/avaliar-lote" \
  --http-method POST \
  --headers "Authorization=Bearer SEU_CRON_SECRET"
```

O free tier do Scheduler cobre 3 jobs.

## Configurar o webhook no Mercado Pago

1. Suas integrações → sua aplicação → Webhooks
2. URL: `https://SUA-API.run.app/webhook/mercadopago`
3. Evento: **Pagamentos**
4. Copie a **assinatura secreta** para `MP_WEBHOOK_SECRET`
5. Use o simulador do painel para disparar um evento de teste

## Antes de aceitar dinheiro de verdade

- [ ] `go test ./...` passando
- [ ] `supabase/verificar.sql` rodou até "TUDO OK"
- [ ] Teste de vazamento com a chave anon devolveu `[]` para `pedidos`
- [ ] Webhook testado pelo simulador do Mercado Pago
- [ ] Webhook duplicado testado (dispare o mesmo evento duas vezes — o segundo
      deve responder "já processado")
- [ ] **Uma compra real de R$5,00 no seu próprio cartão.** O sandbox não pega
      tudo; esse teste é o único que prova que o dinheiro chega.
