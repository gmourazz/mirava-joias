# Pendências — coisas testadas parcialmente ou deixadas para depois

Este arquivo é uma lista de trabalho, não documentação permanente. Risque o
item quando resolver; apague a linha depois de um tempo se não fizer mais
sentido guardar.

---

## O que falta pro site funcionar de verdade (ir ao ar)

Checklist completo pra aceitar dinheiro de verdade. Levantado em 2026-08-26 —
ver também `api/README.md`, seção "Antes de aceitar dinheiro de verdade".

### Só falta credencial (o código já existe e os testes passam)

- [ ] **Preencher `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` e `WEBHOOK_URL` em
      `api/.env`.** O pacote `api/internal/mercadopago` (checkout, webhook,
      validação de assinatura) está pronto e com teste passando
      (`go test ./...`). Sem essas três variáveis, a API recusa checkout e
      webhook — é exatamente o aviso que aparece no log ao subir o servidor:
      "Mercado Pago não configurado". Você mencionou que esses valores já
      estão preenchidos no `.env` de outra máquina sua — é só trazer eles
      pra cá (ou preencher direto em produção, no Secret Manager).
- [ ] Depois de preencher: testar o webhook pelo simulador do painel do
      Mercado Pago, **inclusive disparando o mesmo evento duas vezes** (a
      segunda tem que responder "já processado" — é o que evita cobrar/
      liberar o pedido em duplicidade).
- [ ] **Uma compra real de R$ 5,00 no seu próprio cartão**, depois de tudo
      acima. O sandbox não pega tudo; esse teste é o único que prova que o
      dinheiro chega de fato. (Ver também a pendência do cupom BEMVINDA10 e
      do e-mail de aviso de pedido abaixo — os dois só terminam de ser
      validados nesse mesmo teste.)

### Depende de decisão sua — não dá pra eu decidir ou preencher

- [ ] **Domínio de produção.** Hoje `SITE_URL` em `api/.env` é
      `http://localhost:5174` (dev). Em produção precisa virar o domínio de
      verdade (ex: `https://miravajoias.com.br`) — o CORS da API depende
      disso pra aceitar requisição do front.
- [ ] **Deploy da API em algum lugar público.** Sem isso não existe URL
      pública pra preencher `WEBHOOK_URL`, e o Mercado Pago não consegue
      chamar o webhook de volta. O `api/README.md` já tem a receita pronta
      pro Cloud Run (comando `gcloud run deploy` com tudo configurado).
- [ ] **Armazenamento das fotos de produto.** `UPLOADS_DIR` hoje salva em
      disco local (`./uploads`). Se o deploy for Cloud Run — que reinicia a
      instância e apaga disco não-persistente —, isso precisa virar bucket
      (Cloud Storage) antes de ir ao ar, senão as fotos baixadas da Lilly
      somem. Se o deploy for VPS com disco persistente (Hostinger, como o
      comentário no `.env.exemplo` sugere), não precisa mexer.
- [ ] **CNPJ, razão social e endereço da empresa.** Não existe em nenhum
      lugar do código hoje (nem `config/loja.ts`, nem rodapé, nem as páginas
      legais novas — ver abaixo). Preciso desses dados de você pra
      completar as páginas de Termos e Privacidade; até lá, elas têm um
      aviso visível "razão social e CNPJ a preencher" em vez de um dado
      inventado.

### Feito nesta sessão (não dependia de Mercado Pago)

- [x] Página **Política de privacidade** (`/privacidade`) — o que a loja
      coleta, pra quê e com quem compartilha (Mercado Pago, Correios,
      ViaCEP, Resend), baseado no que o código realmente faz.
- [x] Página **Termos de uso e compra** (`/termos`) — formaliza a política
      de troca/devolução que já existia espalhada no FAQ (7 dias de
      arrependimento, vale de 30 dias na troca, condição da peça), prazo de
      entrega e parcelamento puxados de `config/loja.ts` (não duplicados à
      mão).
- [x] Links das duas páginas adicionados no rodapé, coluna "Ajuda".

## Cupom de boas-vindas (BEMVINDA10)

- [ ] **Testar o e-mail de verdade.** `RESEND_API_KEY` e `EMAIL_REMETENTE` já
      estão preenchidos em `api/.env` (conferido em 2026-08-26) — falta só
      testar de novo pelo banner da home e confirmar que o e-mail com o
      código chega mesmo.
- [x] Validação do código, cálculo dos 10%, exigência de login e bloqueio de
      reuso por conta — testados via curl nesta sessão, funcionando.
- [ ] **Testar o fluxo completo até o pagamento.** Sem `MP_ACCESS_TOKEN` /
      `MP_WEBHOOK_SECRET` configurados, o checkout recusa antes de chegar no
      Mercado Pago — então o desconto nunca foi visto batendo no total de um
      pedido pago de verdade, nem a marcação de "cupom usado" (que só
      acontece no webhook, depois do pagamento aprovado) foi testada em
      produção real, só simulada direto no banco.

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

- [ ] `RESEND_API_KEY` já está preenchida (ver nota no cupom acima) — falta
      testar se os avisos de "pedido pago", "pagamento falhou" etc.
      (`internal/notificacao`) realmente chegam por e-mail, não só logam.
