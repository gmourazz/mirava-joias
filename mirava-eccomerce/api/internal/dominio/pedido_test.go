package dominio

import (
	"testing"
	"time"
)

func TestLegalTransitions(t *testing.T) {
	cases := []struct {
		from, to Status
		ok       bool
	}{
		{AwaitingPayment, Paid, true},
		{AwaitingPayment, Cancelled, true},
		{Paid, InBatch, true},
		{InBatch, PurchasedFromSupplier, true},
		{PurchasedFromSupplier, ReceivedByOwner, true},
		{ReceivedByOwner, Shipped, true},
		{Shipped, Delivered, true},
		{OutOfStock, Refunded, true},

		// Os caminhos que precisam ser impossíveis:
		{AwaitingPayment, Shipped, false},   // despachar sem receber
		{AwaitingPayment, Delivered, false},
		{Delivered, Shipped, false},         // voltar no tempo
		{Cancelled, Paid, false},
		{Refunded, Shipped, false},          // despachar depois de devolver
		{Paid, Delivered, false},            // pular a operação inteira
	}

	for _, c := range cases {
		if got := CanGo(c.from, c.to); got != c.ok {
			t.Errorf("CanGo(%s, %s) = %v, esperado %v", c.from, c.to, got, c.ok)
		}
	}
}

// Este teste existe para lembrar que a mesma tabela vive em SQL, na função
// public.valid_transition (db/schema.sql). Se alguém adicionar um status aqui
// sem adicionar lá, o banco vai recusar a transição em produção.
func TestEveryStatusHasTableEntry(t *testing.T) {
	all := []Status{
		AwaitingPayment, Paid, InBatch, PurchasedFromSupplier, ReceivedByOwner,
		Shipped, Delivered, Cancelled, Refunded, OutOfStock,
	}
	for _, s := range all {
		if _, ok := transitions[s]; !ok {
			t.Errorf("status %s sem entrada em transitions — o banco vai recusar", s)
		}
		if s.Label() == string(s) {
			t.Errorf("status %s sem rótulo amigável para a cliente", s)
		}
	}
}

func TestCountsForRevenue(t *testing.T) {
	doesNotCount := []Status{AwaitingPayment, Cancelled, Refunded, OutOfStock}
	for _, s := range doesNotCount {
		if s.CountsForRevenue() {
			t.Errorf("%s não deveria entrar no faturamento", s)
		}
	}
	if !Paid.CountsForRevenue() {
		t.Error("paid deveria contar no faturamento")
	}
}

func TestBusinessDays(t *testing.T) {
	// 2026-08-03 é uma segunda-feira.
	monday := time.Date(2026, 8, 3, 10, 0, 0, 0, time.UTC)

	cases := []struct {
		days    int
		want    int
		note    string
	}{
		{0, 0, "mesmo dia"},
		{1, 1, "terça"},
		{4, 4, "sexta"},
		{5, 4, "sábado: de segunda até aqui passaram ter, qua, qui, sex"},
		{7, 5, "segunda seguinte: fim de semana não conta"},
	}
	for _, c := range cases {
		got := BusinessDaysBetween(monday, monday.AddDate(0, 0, c.days))
		if got != c.want {
			t.Errorf("%s: %d dias corridos = %d úteis, esperado %d", c.note, c.days, got, c.want)
		}
	}
}

func TestEvaluateBatch(t *testing.T) {
	now := time.Date(2026, 8, 11, 12, 0, 0, 0, time.UTC) // terça
	sixBusinessDaysAgo := time.Date(2026, 8, 3, 12, 0, 0, 0, time.UTC)

	// Bateu R$300: fecha com frete grátis.
	ev := EvaluateBatch(30000, now, now)
	if !ev.ShouldClose || ev.Reason != ReasonGoal || ev.EstimatedShipping != 0 {
		t.Errorf("meta atingida deveria fechar sem frete: %+v", ev)
	}

	// Só R$150, mas o pedido mais antigo já esperou demais: fecha e paga.
	ev = EvaluateBatch(15000, sixBusinessDaysAgo, now)
	if !ev.ShouldClose || ev.Reason != ReasonCap {
		t.Errorf("teto de dias deveria fechar o lote: %+v", ev)
	}
	if ev.EstimatedShipping == 0 {
		t.Error("fechando abaixo da meta, o frete precisa ser previsto")
	}

	// Pouco dinheiro e pouco tempo: continua acumulando.
	ev = EvaluateBatch(5000, now, now)
	if ev.ShouldClose {
		t.Errorf("não deveria fechar ainda: %+v", ev)
	}
	if ev.MissingForGoal != 25000 {
		t.Errorf("MissingForGoal = %v, esperado R$ 250,00", ev.MissingForGoal)
	}
}

// A cliente não precisa saber o que é lote nem quando a peça foi comprada na
// fornecedora: do pagamento até a postagem é tudo a mesma espera.
func TestTudoAntesDaPostagemEhPreparacao(t *testing.T) {
	for _, s := range []Status{Paid, InBatch, PurchasedFromSupplier, ReceivedByOwner} {
		if got := PublicStage(s); got != StagePreparing {
			t.Errorf("%s virou %q, esperava %q", s, got, StagePreparing)
		}
	}
}

func TestPostagemMudaOQueAClienteVe(t *testing.T) {
	if PublicStage(Shipped) != StageShipped {
		t.Error("postado deveria virar enviado")
	}
	if PublicStage(Delivered) != StageDelivered {
		t.Error("entregue deveria virar entregue")
	}
}

func TestCanceladoEstornadoESemEstoqueEncerram(t *testing.T) {
	for _, s := range []Status{Cancelled, Refunded, OutOfStock} {
		if got := PublicStage(s); got != StageClosed {
			t.Errorf("%s virou %q, esperava %q", s, got, StageClosed)
		}
	}
}

// Todo estado interno precisa de tradução — um estado novo sem entrada aqui
// cairia silenciosamente em "encerrado" e assustaria a cliente.
func TestTodoStatusTemRotulo(t *testing.T) {
	for s := range transitions {
		stage := PublicStage(s)
		if StageLabel(stage) == "" {
			t.Errorf("status %s virou stage %q sem rótulo", s, stage)
		}
		if s != Cancelled && s != Refunded && s != OutOfStock && stage == StageClosed {
			t.Errorf("status %s caiu em 'encerrado' sem ser um estado final", s)
		}
	}
}
