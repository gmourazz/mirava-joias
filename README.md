# Mirava Joias

Loja de revenda de semijoias sob encomenda. A cliente compra e paga no site, a
peça é encomendada na fornecedora depois, chega até a Mirava, é reembalada e
enviada.

```
docs/                          documentação do projeto
├── ARQUITETURA.md             COMO construir — camadas, banco, RLS, auth, fluxos
├── PLANO.md                   O QUE construir e em que ordem — fases, custos, riscos
└── simulador-precos.html      abra no navegador: markup, desconto, margem, lote

mirava-eccomerce/
├── api/                       BACKEND · Go · Cloud Run
├── supabase/                  BANCO · migrations, RLS
└── frontend/                  FRONTEND · React + Vite · Cloudflare Pages
```

## Três projetos, três deploys

| | Tecnologia | Onde roda | Comando |
|---|---|---|---|
| `api/` | Go 1.23+ | Google Cloud Run | `go run ./cmd/servidor` |
| `supabase/` | Postgres | Supabase | `supabase db push` |
| `frontend/` | React + Vite | Cloudflare Pages | `npm run dev` |

O front **não importa código do back**. Conversa com a API por HTTP e com o
Supabase por `supabase-js`. Trocar qualquer um dos três não obriga a mexer nos
outros.

## Por onde começar

```bash
# 1. Backend — roda sem configuração nenhuma
cd mirava-eccomerce/api && go mod tidy && go test ./...

# 2. Banco — precisa de projeto no Supabase
cd mirava-eccomerce/supabase && supabase db push
# depois cole verificar.sql no SQL Editor do painel

# 3. Front
cd mirava-eccomerce/frontend && npm install && npm run dev
```

Cada pasta tem o próprio README com detalhes.

## Antes de aceitar dinheiro de verdade

- [ ] `go test ./...` passando
- [ ] `verificar.sql` rodou até "TUDO OK"
- [ ] Teste de vazamento: ler `pedidos` com a chave anon devolve `[]`
- [ ] Webhook do Mercado Pago testado, inclusive evento duplicado
- [ ] Conteúdo fictício removido do front (depoimentos e avaliações são inventados)
- [ ] Uma compra real de R$5,00 no seu próprio cartão

O checklist completo está em `docs/PLANO.md`, seção 13.
