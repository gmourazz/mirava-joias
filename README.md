# Mirava Joias

Loja de revenda de semijoias sob encomenda. A cliente compra e paga no site, a
peça é encomendada na fornecedora depois, chega até a Mirava, é reembalada e
enviada.

```
docs/                          documentação do projeto
├── ARQUITETURA.md             COMO construir — camadas, banco, auth, fluxos, decisões
├── PLANO.md                   O QUE construir e em que ordem — fases, custos, riscos
├── simulador-precos.html      abra no navegador: markup, desconto, margem, lote
└── marca/                     logos e briefing da marca

mirava-eccomerce/
├── api/                       BACKEND · Go · Cloud Run ou VPS
├── db/                        BANCO · Postgres próprio (schema.sql, docker-compose.yml)
├── frontend/                  FRONTEND · React + TypeScript + Vite · Cloudflare Pages
├── docs/                      como rodar em outra máquina
└── rodar.sh                   sobe banco, API e front juntos
```

## Stack

| | Tecnologia | Onde roda | Comando |
|---|---|---|---|
| `api/` | Go 1.23+ (`net/http` + pgx) | Google Cloud Run ou VPS | `go run ./cmd/servidor` |
| `db/` | PostgreSQL | Docker local / VPS | `docker compose up -d` |
| `frontend/` | React 19 + TypeScript + Vite (Node/npm) + Tailwind v4 | Cloudflare Pages | `npm run dev` |

O front **não importa código do back** nem fala com o banco: conversa só com
a API Go por HTTP. A API é a fronteira de segurança — preço, desconto e
pagamento são decididos nela.

## Por onde começar

```bash
# Tudo junto (banco, API e front)
cd mirava-eccomerce && ./rodar.sh

# Ou um por vez:
cd mirava-eccomerce/db && docker compose up -d
docker exec -i mirava-postgres psql -U mirava -d mirava < schema.sql

cd mirava-eccomerce/api && go test ./... && go run ./cmd/servidor   # precisa do .env (ver .env.exemplo)

cd mirava-eccomerce/frontend && npm install && npm run dev
```

Cada pasta tem o próprio README com detalhes. Para levar o projeto para outro
computador, veja `mirava-eccomerce/docs/COMO-RODAR-EM-OUTRA-MAQUINA.md`.

## Antes de aceitar dinheiro de verdade

- [ ] `go test ./...` passando e `npm run build` sem erro
- [ ] Banco de produção com `db/schema.sql` (ou `db/alter-design-v5.sql`) aplicado
- [ ] Webhook do Mercado Pago testado, inclusive evento duplicado
- [ ] E-mail (Resend) configurado e jobs do agendador criados (ver `api/README.md`)
- [ ] Uma compra real de R$5,00 no seu próprio cartão

O checklist completo está em `docs/PLANO.md`, seção 13.
