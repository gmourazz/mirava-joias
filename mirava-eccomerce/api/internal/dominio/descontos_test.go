package dominio

import (
	"testing"
	"time"
)

var agora = time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC)

func TestCupomPercentual(t *testing.T) {
	c := Coupon{Code: "VERAO15", Kind: CouponPercent, Value: 15, Active: true}
	d, err := c.Discount(20000, agora, 0)
	if err != nil || d != 3000 {
		t.Fatalf("15%% de R$200 = R$30, veio %d (%v)", d, err)
	}
}

func TestCupomValorFixo(t *testing.T) {
	c := Coupon{Code: "VINTE", Kind: CouponFixed, Value: 2000, Active: true}
	d, _ := c.Discount(15000, agora, 0)
	if d != 2000 {
		t.Fatalf("R$20 fixo, veio %d", d)
	}
}

// O teto de 30% vale para qualquer desconto: um cupom de R$50 numa compra
// de R$100 dá só R$30.
func TestCupomRespeitaOTeto(t *testing.T) {
	c := Coupon{Code: "CINQUENTA", Kind: CouponFixed, Value: 5000, Active: true}
	d, _ := c.Discount(10000, agora, 0)
	if d != 3000 {
		t.Fatalf("teto de 30%% de R$100 = R$30, veio %d", d)
	}
	p := Coupon{Code: "METADE", Kind: CouponPercent, Value: 50, Active: true}
	if d, _ := p.Discount(10000, agora, 0); d != 3000 {
		t.Fatalf("50%% limitado a 30%%, veio %d", d)
	}
}

func TestCupomRecusado(t *testing.T) {
	ontem, amanha := agora.AddDate(0, 0, -1), agora.AddDate(0, 0, 1)
	cases := []struct {
		nome string
		c    Coupon
		sub  Cents
		usos int
	}{
		{"inativo", Coupon{Kind: CouponPercent, Value: 10}, 10000, 0},
		{"abaixo do mínimo", Coupon{Kind: CouponPercent, Value: 10, Active: true, MinSubtotal: 15000}, 10000, 0},
		{"ainda não começou", Coupon{Kind: CouponPercent, Value: 10, Active: true, StartsAt: &amanha}, 10000, 0},
		{"vencido", Coupon{Kind: CouponPercent, Value: 10, Active: true, EndsAt: &ontem}, 10000, 0},
		{"esgotado", Coupon{Kind: CouponPercent, Value: 10, Active: true, MaxUses: 5}, 10000, 5},
	}
	for _, c := range cases {
		if d, err := c.c.Discount(c.sub, agora, c.usos); err == nil {
			t.Errorf("%s: deveria recusar, deu desconto %d", c.nome, d)
		}
	}
}

func TestCupomValido(t *testing.T) {
	cases := []struct {
		c  Coupon
		ok bool
	}{
		{Coupon{Code: "OK", Kind: CouponPercent, Value: 10}, true},
		{Coupon{Code: "OK", Kind: CouponPercent, Value: 0}, false},
		{Coupon{Code: "OK", Kind: CouponPercent, Value: 31}, false}, // acima do teto não faz sentido
		{Coupon{Code: "OK", Kind: CouponFixed, Value: 1000}, true},
		{Coupon{Code: "OK", Kind: CouponFixed, Value: 0}, false},
		{Coupon{Code: "", Kind: CouponFixed, Value: 1000}, false},
		{Coupon{Code: "COM ESPAÇO", Kind: CouponFixed, Value: 1000}, false},
		{Coupon{Code: "OK", Kind: "outro", Value: 1000}, false},
	}
	for _, c := range cases {
		if err := c.c.Validate(); (err == nil) != c.ok {
			t.Errorf("Validate(%+v) = %v, esperado ok=%v", c.c, err, c.ok)
		}
	}
}

func TestNormalizaCodigoDoCupom(t *testing.T) {
	if got := NormalizeCouponCode("  verao15 "); got != "VERAO15" {
		t.Errorf("veio %q", got)
	}
}

// Mirava Club: 100 pontos = R$5. Só múltiplos de 100, e nunca acima do teto.
func TestPontosViramDesconto(t *testing.T) {
	cases := []struct {
		saldo, subtotal int
		usar            int
		desconto        Cents
	}{
		{250, 20000, 200, 1000},   // 250 pontos → usa 200 → R$10
		{99, 20000, 0, 0},         // menos de 100 não dá desconto
		{10000, 10000, 600, 3000}, // R$100 em peças: teto R$30 = 600 pontos
		{0, 10000, 0, 0},
	}
	for _, c := range cases {
		usar, d := PointsRedemption(c.saldo, Cents(c.subtotal))
		if usar != c.usar || d != c.desconto {
			t.Errorf("saldo %d, peças %d: usou %d (R$ %d), esperado %d (R$ %d)", c.saldo, c.subtotal, usar, d, c.usar, c.desconto)
		}
	}
}

// 1 ponto por R$1 nas peças, já com desconto; centavos não viram ponto.
func TestPontosGanhos(t *testing.T) {
	if got := PointsEarned(15990); got != 159 {
		t.Errorf("R$159,90 = 159 pontos, veio %d", got)
	}
	if got := PointsEarned(0); got != 0 {
		t.Errorf("veio %d", got)
	}
}

func TestNivelDoClub(t *testing.T) {
	cases := map[int]ClubLevel{0: ClubBrilho, 499: ClubBrilho, 500: ClubEncanto, 1499: ClubEncanto, 1500: ClubJoiaRara}
	for pts, want := range cases {
		if got := ClubLevelFor(pts); got != want {
			t.Errorf("%d pontos: %s, esperado %s", pts, got, want)
		}
	}
}

// Total: peças − desconto + frete + embrulho. É a mesma conta do CHECK
// ck_total_coherent no banco.
func TestTotalDoPedido(t *testing.T) {
	tot := OrderTotal(20000, 3000, 1890, true)
	if tot.GiftWrap != GiftWrapCents || tot.Total != 20000-3000+1890+GiftWrapCents {
		t.Errorf("veio %+v", tot)
	}
	semEmbrulho := OrderTotal(20000, 0, 0, false)
	if semEmbrulho.GiftWrap != 0 || semEmbrulho.Total != 20000 {
		t.Errorf("veio %+v", semEmbrulho)
	}
}

func TestMensagemDoPresente(t *testing.T) {
	if _, err := GiftMessage(string(make([]byte, 201))); err == nil {
		t.Error("mensagem com mais de 200 caracteres deveria ser recusada")
	}
	if m, err := GiftMessage("  Feliz aniversário!  "); err != nil || m != "Feliz aniversário!" {
		t.Errorf("veio %q (%v)", m, err)
	}
}

// O checkout pede cupom OU pontos; nunca os dois (decisão 31).
func TestEscolhaDoDesconto(t *testing.T) {
	c := &Coupon{Code: "DEZ", Kind: CouponPercent, Value: 10, Active: true}

	d, err := ChooseDiscount(DiscountRequest{Subtotal: 20000, Coupon: c, Now: agora})
	if err != nil || d.Discount != 2000 || d.CouponCode != "DEZ" || d.PointsUsed != 0 {
		t.Errorf("cupom: %+v %v", d, err)
	}

	d, err = ChooseDiscount(DiscountRequest{Subtotal: 20000, UsePoints: true, PointsBalance: 350, Now: agora})
	if err != nil || d.Discount != 1500 || d.PointsUsed != 300 || d.CouponCode != "" {
		t.Errorf("pontos: %+v %v", d, err)
	}

	if _, err := ChooseDiscount(DiscountRequest{Subtotal: 20000, Coupon: c, UsePoints: true, PointsBalance: 500, Now: agora}); err == nil {
		t.Error("cupom e pontos juntos deveriam ser recusados")
	}

	if _, err := ChooseDiscount(DiscountRequest{Subtotal: 20000, UsePoints: true, PointsBalance: 50, Now: agora}); err == nil {
		t.Error("menos de 100 pontos deveria avisar que não dá para usar")
	}

	d, err = ChooseDiscount(DiscountRequest{Subtotal: 20000, Now: agora})
	if err != nil || d.Discount != 0 {
		t.Errorf("sem desconto: %+v %v", d, err)
	}
}
