# Pendências — coisas testadas parcialmente ou deixadas para depois

Este arquivo é uma lista de trabalho, não documentação permanente. Risque o
item quando resolver; apague a linha depois de um tempo se não fizer mais
sentido guardar.

---

## Cupom de boas-vindas (BEMVINDA10)

- [ ] **Testar o e-mail de verdade.** `RESEND_API_KEY` está vazia em
      `api/.env` — a inscrição na newsletter grava normal no banco
      (`newsletter_subscribers`), mas o e-mail com o código não sai. Preencher
      `RESEND_API_KEY` e `EMAIL_REMETENTE` no `.env` e testar de novo pelo
      banner da home.
- [x] Validação do código, cálculo dos 10%, exigência de login e bloqueio de
      reuso por conta — testados via curl nesta sessão, funcionando.
- [ ] **Testar o fluxo completo até o pagamento.** Sem `MP_ACCESS_TOKEN` /
      `MP_WEBHOOK_SECRET` configurados, o checkout recusa antes de chegar no
      Mercado Pago — então o desconto nunca foi visto batendo no total de um
      pedido pago de verdade, nem a marcação de "cupom usado" (que só
      acontece no webhook, depois do pagamento aprovado) foi testada em
      produção real, só simulada direto no banco.

## Mercado Pago

- [ ] `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` não configurados localmente —
      checkout e webhook recusam com "Pagamento indisponível". Preencher com
      credenciais de teste do Mercado Pago pra validar o fluxo de compra
      inteiro (inclusive o cupom acima).

## Sincronização com a Lilly

- [ ] **Bug conhecido:** a última sincronização completa (2.157 produtos)
      terminou com sucesso segundo o log da API, mas a linha correspondente
      em `syncs` ficou travada em `status='running'` — o `FinishSync` no fim
      do handler (`api/internal/web/tarefas.go`) ignora o erro da escrita
      (`_ = s.db.FinishSync(...)`). Não afeta o catálogo publicado, só o
      histórico/painel de sincronizações. Vale investigar por que a escrita
      falhou e não engolir o erro em silêncio.
- [ ] Categorização automática (`GuessCategory` em `internal/lilly/lilly.go`)
      ainda joga ~235 produtos em "outros" (eram 450 antes de adicionar
      argola/ear cuff/piercing como palavras-chave de "brincos"). Vale uma
      segunda leva de palavras-chave se aparecer mais peça de categoria
      errada na vitrine.

## E-mail de aviso de pedido

- [ ] Mesma causa do cupom: sem `RESEND_API_KEY`, os avisos de "pedido pago",
      "pagamento falhou" etc. (`internal/notificacao`) não disparam de
      verdade — só logam aviso. Testar quando o Resend estiver configurado.
