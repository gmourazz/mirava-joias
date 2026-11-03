package dominio

import (
	"testing"
	"time"
)

// O painel deixa a dona mover o pedido à mão, mas não por qualquer caminho:
// pagamento só o webhook confirma, e postagem exige código de rastreio (rota
// própria). O resto segue a máquina de estados.
func TestTransicaoManualDoPainel(t *testing.T) {
	cases := []struct {
		from, to Status
		ok       bool
	}{
		{InBatch, PurchasedFromSupplier, true},
		{PurchasedFromSupplier, ReceivedByOwner, true},
		{Shipped, Delivered, true},
		{AwaitingPayment, Cancelled, true},
		{Paid, OutOfStock, true},
		{InBatch, OutOfStock, true},
		{OutOfStock, Refunded, true},
		{Paid, Refunded, true},
		{InBatch, Paid, true}, // tirar do lote devolve para "pago"

		{AwaitingPayment, Paid, false},    // só o webhook confirma pagamento
		{Paid, InBatch, false},            // entrar no lote é efeito da compra do lote
		{OutOfStock, InBatch, true},       // peça voltou: o pedido retorna ao lote
		{ReceivedByOwner, Shipped, false}, // postagem pede rastreio: rota própria
		{Paid, Delivered, false},          // continua valendo a máquina de estados
		{Delivered, Refunded, false},
	}
	for _, c := range cases {
		if got := ManualTransitionAllowed(c.from, c.to); got != c.ok {
			t.Errorf("ManualTransitionAllowed(%s, %s) = %v, esperado %v", c.from, c.to, got, c.ok)
		}
	}
}

func TestAcoesManuaisNuncaIncluemPagoNemPostado(t *testing.T) {
	for from := range transitions {
		for _, to := range ManualActions(from) {
			if !ManualTransitionAllowed(from, to) {
				t.Errorf("ManualActions(%s) oferece %s, que não é permitido", from, to)
			}
		}
	}
}

// Etapas do painel: o que a dona precisa fazer com o pedido agora.
func TestEtapaDoPainel(t *testing.T) {
	cases := map[Status]AdminStage{
		AwaitingPayment:       AdminAwaitingPayment,
		Paid:                  AdminToBuy,
		InBatch:               AdminToBuy,
		PurchasedFromSupplier: AdminAtSupplier,
		ReceivedByOwner:       AdminToShip,
		Shipped:               AdminShipped,
		Delivered:             AdminDelivered,
		OutOfStock:            AdminProblem,
		Cancelled:             AdminClosed,
		Refunded:              AdminClosed,
	}
	for s, want := range cases {
		if got := AdminStageOf(s); got != want {
			t.Errorf("AdminStageOf(%s) = %s, esperado %s", s, got, want)
		}
	}
}

// Prazo prometido: 20 dias úteis a partir do pagamento. "Perto do prazo" é
// faltar 4 dias úteis ou menos — o ponto em que ainda dá para agir.
func TestPrazoDoPedido(t *testing.T) {
	pago := time.Date(2026, 10, 1, 10, 0, 0, 0, time.UTC) // quinta

	d := DeadlineFor(pago, time.Date(2026, 10, 1, 15, 0, 0, 0, time.UTC))
	if d.Left != PromisedBusinessDays || d.Near || d.Late {
		t.Errorf("no dia do pagamento: %+v", d)
	}

	// 16 dias úteis depois: faltam 4 → perto do prazo.
	d = DeadlineFor(pago, time.Date(2026, 10, 23, 10, 0, 0, 0, time.UTC))
	if d.Left != 4 || !d.Near || d.Late {
		t.Errorf("16 dias úteis depois: %+v", d)
	}

	// 21 dias úteis depois: atrasado 1.
	d = DeadlineFor(pago, time.Date(2026, 10, 30, 10, 0, 0, 0, time.UTC))
	if d.Left != -1 || !d.Late {
		t.Errorf("21 dias úteis depois: %+v", d)
	}

	if want := time.Date(2026, 10, 29, 0, 0, 0, 0, time.UTC); !d.Due.Equal(want) {
		t.Errorf("data-limite = %v, esperado %v", d.Due, want)
	}
}

func TestSomaDiasUteisPulaFimDeSemana(t *testing.T) {
	sexta := time.Date(2026, 10, 2, 0, 0, 0, 0, time.UTC)
	if got := AddBusinessDays(sexta, 1); got.Weekday() != time.Monday {
		t.Errorf("sexta + 1 dia útil = %s", got.Weekday())
	}
	if got := AddBusinessDays(sexta, 5); !got.Equal(time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("sexta + 5 dias úteis = %v", got)
	}
}

// O lote pode ser comprado aberto (a dona decide antecipar) ou já fechado;
// depois de comprado, só pode ser recebido.
func TestCompraERecebimentoDoLote(t *testing.T) {
	if !BatchCanBePurchased(BatchOpen) || !BatchCanBePurchased(BatchClosed) {
		t.Error("lote aberto ou fechado deve poder ser comprado")
	}
	if BatchCanBePurchased(BatchPurchased) || BatchCanBePurchased(BatchReceived) {
		t.Error("lote já comprado não pode ser comprado de novo")
	}
	if !BatchCanBeReceived(BatchPurchased) {
		t.Error("lote comprado deve poder ser recebido")
	}
	if BatchCanBeReceived(BatchOpen) || BatchCanBeReceived(BatchReceived) {
		t.Error("só lote comprado pode ser recebido")
	}
}

// Preço pelo markup, igual à conta da função SQL apply_synced_cost
// (round(custo * (1 + markup/100))). Se as duas divergirem, a sincronização
// e o painel gravariam preços diferentes para a mesma peça.
func TestPrecoPeloMarkup(t *testing.T) {
	cases := []struct {
		cost   Cents
		markup float64
		want   Cents
	}{
		{2300, 200, 6900}, // R$23 com 200% = R$69
		{2300, 150, 5750},
		{1999, 120, 4398}, // 1999 * 2.2 = 4397.8 → arredonda para cima
		{1, 200, 3},
	}
	for _, c := range cases {
		if got := PriceFromMarkup(c.cost, c.markup); got != c.want {
			t.Errorf("PriceFromMarkup(%d, %v) = %d, esperado %d", c.cost, c.markup, got, c.want)
		}
	}
}

// Markup fora da faixa é quase sempre erro de digitação (2000 no lugar de
// 200) — e vira preço absurdo no ar. O painel recusa.
func TestFaixaDeMarkup(t *testing.T) {
	for _, ok := range []float64{20, 120, 200, 500} {
		if !ValidMarkup(ok) {
			t.Errorf("markup %v deveria ser aceito", ok)
		}
	}
	for _, ruim := range []float64{0, 10, 19.9, 501, 2000, -50} {
		if ValidMarkup(ruim) {
			t.Errorf("markup %v deveria ser recusado", ruim)
		}
	}
}

// Selo "Novo" na vitrine: peça cadastrada há até 30 dias.
func TestPecaNova(t *testing.T) {
	agora := time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC)
	if !IsNewProduct(agora.AddDate(0, 0, -29), agora) {
		t.Error("29 dias atrás ainda é novidade")
	}
	if IsNewProduct(agora.AddDate(0, 0, -31), agora) {
		t.Error("31 dias atrás já não é novidade")
	}
}

// "Despachar até": o último dia útil em que a peça pode sair daqui e ainda
// chegar dentro dos 20 dias úteis prometidos, descontado o transporte.
func TestDespacharAte(t *testing.T) {
	pago := time.Date(2026, 10, 1, 10, 0, 0, 0, time.UTC) // quinta
	// SP, SEDEX: o transporte mais longo da tabela para o Sudeste.
	transporte := ShippingTransitMaxDays("SP", ShippingExpress)
	if transporte <= 0 {
		t.Fatalf("transporte do SEDEX para SP deveria ser positivo, veio %d", transporte)
	}
	got := ShipBy(pago, transporte)
	want := AddBusinessDays(pago, PromisedBusinessDays-transporte)
	if !got.Equal(want) {
		t.Errorf("ShipBy = %v, esperado %v", got, want)
	}
	// Mais longe, o PAC leva mais: tem que sair antes.
	if !ShipBy(pago, ShippingTransitMaxDays("AM", ShippingEconomic)).Before(got) {
		t.Error("PAC para o Norte deveria ter de sair antes do SEDEX para SP")
	}
}
