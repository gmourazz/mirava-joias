# Banco — Mirava

Postgres no Supabase. Este é o **contrato entre o backend e o front**: a API Go
escreve como dona do banco; o front lê pelo `supabase-js`, sempre filtrado por
RLS.

## Aplicar

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

Depois, cole `verificar.sql` no SQL Editor do painel e execute. Se imprimir
`TUDO OK`, o banco está íntegro.

## Migrations

| Arquivo | O que faz |
|---|---|
| `01_base` | extensões, `dias_uteis_desde`, slug, trigger de `atualizado_em` |
| `02_catalogo` | `fornecedores`, `fornecedor_produtos` (espelho), `produtos`, variantes |
| `03_contas` | `perfis`, `enderecos`, `favoritos`, `admins` + criação automática de perfil |
| `04_pedidos` | `lotes`, `pedidos`, `pedido_itens`, `pagamentos`, `eventos_pedido` |
| `05_precos_sync` | `regras_preco`, `sincronizacoes` e falhas |
| `06_funcoes` | máquina de estados, lote automático, **disjuntor de preço**, views |
| `07_rls` | policies de todas as tabelas + bucket de imagens |
| `08_seed` | fornecedora Lilly, regra de preço padrão, primeiro lote |

## As decisões que parecem estranhas e não são

**Espelho separado do catálogo.** `fornecedor_produtos` é sobrescrito a cada
sincronização; `produtos` é seu. Assim, uma mudança no site da Lilly não apaga
seu texto nem tira uma peça do ar sem você saber.

**Preço e custo congelados em `pedido_itens`.** Sem isso, quando a Lilly
reajustar, todo o histórico de lucro muda retroativamente e o fechamento do
mês passado vira ficção.

**`unique` em `pagamentos.mp_payment_id`.** O Mercado Pago reenvia o mesmo
webhook várias vezes — é o comportamento normal dele. A constraint transforma
a repetição num no-op.

**Índice parcial garantindo um lote aberto por vez.** A regra vive no banco,
não na aplicação, para valer mesmo se a API tiver bug.

**Máquina de estados como trigger.** Impede que um pedido vá de
`aguardando_pagamento` direto para `enviado` — despachar joia sem receber.

**RLS ligado sem policy = ninguém entra.** É o default seguro. Crie a tabela
fechada e libere só o necessário, uma policy por vez.

## Regra de ouro

**Nunca altere o schema clicando no painel do Supabase.** Sem migration
versionada, você não consegue recriar o banco nem descobrir o que mudou quando
algo quebrar. Toda alteração vira arquivo aqui.
