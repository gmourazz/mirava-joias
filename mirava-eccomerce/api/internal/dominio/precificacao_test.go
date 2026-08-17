package dominio

import "testing"

// Os números deste teste vêm de uma peça real da Lilly: Pulseira Maya (PL46),
// atacado R$23,00, varejo dela R$32,90. Embalagem Mirava estimada em R$5,00.
func TestPriceRealItem(t *testing.T) {
	cases := []struct {
		markup      float64
		price       Cents
		profit      Cents
		approxMargin float64
	}{
		{50, 3450, 478, 13.9},
		{100, 4600, 1571, 34.2},
		{150, 5750, 2664, 46.3},
		{200, 6900, 3756, 54.4}, // markup escolhido pela dona
	}

	for _, c := range cases {
		got := Price(PricingInput{
			WholesaleCost: 2300,
			Packaging:     500,
			MarkupPct:     c.markup,
			GatewayFeePct: FeeCreditUpfront,
		})

		if got.FinalPrice != c.price {
			t.Errorf("markup %.0f%%: preço = %v, esperado %v", c.markup, got.FinalPrice, c.price)
		}
		if got.Profit != c.profit {
			t.Errorf("markup %.0f%%: lucro = %v, esperado %v", c.markup, got.Profit, c.profit)
		}
		if diff := got.MarginPct - c.approxMargin; diff > 0.15 || diff < -0.15 {
			t.Errorf("markup %.0f%%: margem = %.2f%%, esperado ~%.1f%%", c.markup, got.MarginPct, c.approxMargin)
		}
	}
}

// Markup de 50% deixa menos de R$5 por peça — precisa disparar o alerta.
func TestMarginDangerous(t *testing.T) {
	weak := Price(PricingInput{
		WholesaleCost: 2300, Packaging: 500, MarkupPct: 50, GatewayFeePct: FeeCreditUpfront,
	})
	if !weak.MarginDangerous() {
		t.Errorf("markup de 50%% deveria ser sinalizado como perigoso (margem %.1f%%)", weak.MarginPct)
	}

	good := Price(PricingInput{
		WholesaleCost: 2300, Packaging: 500, MarkupPct: 200, GatewayFeePct: FeeCreditUpfront,
	})
	if good.MarginDangerous() {
		t.Errorf("markup de 200%% não deveria ser perigoso (margem %.1f%%)", good.MarginPct)
	}
}

// Pix é a venda mais lucrativa mesmo dando 5% de desconto — e o dinheiro cai
// na hora, que é quando ela precisa para fechar o lote.
func TestPixWorthsEvenWithDiscount(t *testing.T) {
	pix := Price(PricingInput{
		WholesaleCost: 2300, Packaging: 500, MarkupPct: 200,
		DiscountPct: 5, GatewayFeePct: FeePix,
	})
	credit := Price(PricingInput{
		WholesaleCost: 2300, Packaging: 500, MarkupPct: 200,
		GatewayFeePct: FeeCreditUpfront,
	})

	diff := credit.Profit - pix.Profit
	if diff > 100 { // menos de R$1,00 de diferença
		t.Errorf("Pix com 5%% off perdendo demais: crédito %v vs pix %v (diferença %v)",
			credit.Profit, pix.Profit, diff)
	}
}

func TestPriceCircuitBreaker(t *testing.T) {
	cases := []struct {
		name           string
		current, updated Cents
		accepted       bool
	}{
		{"reajuste pequeno da Lilly", 6900, 7200, true},
		{"reajuste de 10%", 6900, 7590, true},
		{"queda de 30% no limite", 10000, 7000, true},
		{"extrator leu R$2 em vez de R$23", 6900, 600, false},
		{"preço dobrou, suspeito", 6900, 14000, false},
		{"produto sem preço anterior", 0, 6900, false},
	}

	for _, c := range cases {
		if got := VariationAcceptable(c.current, c.updated); got != c.accepted {
			t.Errorf("%s: VariationAcceptable(%v, %v) = %v, esperado %v",
				c.name, c.current, c.updated, got, c.accepted)
		}
	}
}

func TestParseBRL(t *testing.T) {
	cases := []struct {
		input string
		want  Cents
	}{
		{"48,00", 4800},
		{"R$ 48,00", 4800},
		{"R$32,90", 3290},
		{"1.234,56", 123456},
		{"23,00", 2300},
	}
	for _, c := range cases {
		got, err := ParseBRL(c.input)
		if err != nil {
			t.Errorf("ParseBRL(%q) devolveu erro: %v", c.input, err)
			continue
		}
		if got != c.want {
			t.Errorf("ParseBRL(%q) = %v, esperado %v", c.input, got, c.want)
		}
	}
}

func TestFormatting(t *testing.T) {
	if got := Cents(6900).String(); got != "R$ 69,00" {
		t.Errorf("String() = %q", got)
	}
	if got := Cents(478).String(); got != "R$ 4,78" {
		t.Errorf("String() = %q", got)
	}
}
