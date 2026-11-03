package dominio

import "testing"

// Decisões 32 a 34: promoção e kit mudam o preço, cupom/pontos e Pix vêm por
// cima, e a soma de tudo nunca passa de 30% do preço cheio das peças.

func linha(id string, preco Cents, promo, qtd int) OrderLine {
	return OrderLine{ProductID: id, ListPrice: preco, PromoPct: promo, Quantity: qtd}
}

func TestPromocaoBaixaOPrecoDaPeca(t *testing.T) {
	r := PriceOrder(OrderPricingInput{Lines: []OrderLine{linha("a", 10000, 20, 2)}, Now: agora})
	if r.Lines[0].UnitPrice != 8000 || r.ListSubtotal != 20000 || r.Subtotal != 16000 || r.Discount != 0 {
		t.Fatalf("veio %+v", r)
	}
}

func TestPromocaoAcimaDoTetoViraTrinta(t *testing.T) {
	r := PriceOrder(OrderPricingInput{Lines: []OrderLine{linha("a", 10000, 50, 1)}, Now: agora})
	if r.Lines[0].UnitPrice != 7000 {
		t.Fatalf("promoção limitada a 30%%, veio %d", r.Lines[0].UnitPrice)
	}
}

func TestKitCompreJunto(t *testing.T) {
	// A (R$60) + B (R$40) com kit de 10%: R$10 de desconto por par.
	in := OrderPricingInput{
		Lines: []OrderLine{linha("a", 6000, 0, 2), linha("b", 4000, 0, 1)},
		Kits:  []Kit{{A: "a", B: "b", Pct: 10}},
		Now:   agora,
	}
	r := PriceOrder(in)
	if r.KitDiscount != 1000 {
		t.Fatalf("um par completo = R$10, veio %d", r.KitDiscount)
	}
	// Sem a peça B não há kit.
	in.Lines = in.Lines[:1]
	if r := PriceOrder(in); r.KitDiscount != 0 {
		t.Fatalf("sem o par, kit não vale; veio %d", r.KitDiscount)
	}
}

// Promoção e kit na mesma peça não somam: vale o maior.
func TestKitNaoSomaComPromocao(t *testing.T) {
	in := OrderPricingInput{
		Lines: []OrderLine{linha("a", 6000, 20, 1), linha("b", 4000, 0, 1)}, // promo de R$12 em A
		Kits:  []Kit{{A: "a", B: "b", Pct: 10}},                             // kit daria R$10 no par
		Now:   agora,
	}
	if r := PriceOrder(in); r.KitDiscount != 0 {
		t.Fatalf("promo de R$12 já é maior que o kit de R$10, veio %d", r.KitDiscount)
	}
	in.Kits[0].Pct = 15 // kit de R$15: completa R$3 além dos R$12 da promoção
	if r := PriceOrder(in); r.KitDiscount != 300 {
		t.Fatalf("esperado R$3 a mais, veio %d", r.KitDiscount)
	}
}

func TestCupomPorCimaDaPromocaoComTeto(t *testing.T) {
	// R$100 cheio, promo 20% → R$80; cupom de 20% daria R$16, mas o teto de
	// 30% do cheio (R$30) só deixa mais R$10.
	c := &Coupon{Code: "VINTE", Kind: CouponPercent, Value: 20, Active: true}
	r := PriceOrder(OrderPricingInput{Lines: []OrderLine{linha("a", 10000, 20, 1)}, Coupon: c, Now: agora})
	if r.DiscountErr != "" || r.CouponDiscount != 1000 || r.Discount != 1000 || r.CouponCode != "VINTE" {
		t.Fatalf("veio %+v", r)
	}
}

func TestPixCincoPorCento(t *testing.T) {
	r := PriceOrder(OrderPricingInput{Lines: []OrderLine{linha("a", 10000, 0, 1)}, Pix: true, Now: agora})
	if r.PixDiscount != 500 || r.Discount != 500 {
		t.Fatalf("5%% de R$100, veio %+v", r)
	}
	// Pix incide sobre as peças já com cupom: R$100 − R$10 = R$90 → R$4,50.
	c := &Coupon{Code: "DEZ", Kind: CouponFixed, Value: 1000, Active: true}
	r = PriceOrder(OrderPricingInput{Lines: []OrderLine{linha("a", 10000, 0, 1)}, Coupon: c, Pix: true, Now: agora})
	if r.PixDiscount != 450 || r.Discount != 1450 {
		t.Fatalf("veio %+v", r)
	}
}

func TestPixRespeitaOTeto(t *testing.T) {
	// Promoção de 30% já esgota o teto: Pix não dá mais nada.
	r := PriceOrder(OrderPricingInput{Lines: []OrderLine{linha("a", 10000, 30, 1)}, Pix: true, Now: agora})
	if r.PixDiscount != 0 || r.Subtotal != 7000 {
		t.Fatalf("veio %+v", r)
	}
}

func TestPontosDentroDoQueSobraDoTeto(t *testing.T) {
	// R$100 com promo 20% (R$80). Sobra R$10 de teto = 200 pontos, mesmo com 1000 de saldo.
	r := PriceOrder(OrderPricingInput{Lines: []OrderLine{linha("a", 10000, 20, 1)}, UsePoints: true, PointsBalance: 1000, Now: agora})
	if r.PointsUsed != 200 || r.CouponDiscount != 1000 {
		t.Fatalf("veio %+v", r)
	}
}

func TestCupomEPontosJuntosContinuaRecusado(t *testing.T) {
	c := &Coupon{Code: "DEZ", Kind: CouponPercent, Value: 10, Active: true}
	r := PriceOrder(OrderPricingInput{Lines: []OrderLine{linha("a", 10000, 0, 1)}, Coupon: c, UsePoints: true, PointsBalance: 500, Now: agora})
	if r.DiscountErr == "" || r.Discount != 0 {
		t.Fatalf("deveria recusar, veio %+v", r)
	}
}

// Erro de cupom não derruba o Pix: a prévia mostra o aviso e o resto segue.
func TestErroDeCupomMantemPix(t *testing.T) {
	c := &Coupon{Code: "VELHO", Kind: CouponPercent, Value: 10}
	r := PriceOrder(OrderPricingInput{Lines: []OrderLine{linha("a", 10000, 0, 1)}, Coupon: c, Pix: true, Now: agora})
	if r.DiscountErr == "" || r.PixDiscount != 500 {
		t.Fatalf("veio %+v", r)
	}
}

func TestPontosGanhosSaoSobreOPagoEmPecas(t *testing.T) {
	r := PriceOrder(OrderPricingInput{Lines: []OrderLine{linha("a", 10000, 20, 1)}, Pix: true, Now: agora})
	// R$80 − 5% = R$76 → 76 pontos.
	if r.PointsEarned != 76 {
		t.Fatalf("veio %d", r.PointsEarned)
	}
}

// BEMVINDA10: só no primeiro pedido pago e uma vez por cliente.
func TestCupomSoPrimeiroPedido(t *testing.T) {
	c := Coupon{Code: "BEMVINDA10", Kind: CouponPercent, Value: 10, Active: true, FirstOrderOnly: true, OncePerCustomer: true}
	if err := c.Eligible(CouponContext{}); err != nil {
		t.Fatalf("primeira compra deveria valer: %v", err)
	}
	if err := c.Eligible(CouponContext{PriorPaidOrders: 1}); err == nil {
		t.Error("cliente com pedido pago não pode usar cupom de primeira compra")
	}
	if err := c.Eligible(CouponContext{UsedByCustomer: true}); err == nil {
		t.Error("cupom de uso único já usado pela cliente")
	}
	r := PriceOrder(OrderPricingInput{Lines: []OrderLine{linha("a", 10000, 0, 1)}, Coupon: &c, CouponCtx: CouponContext{PriorPaidOrders: 2}, Now: agora})
	if r.DiscountErr == "" || r.Discount != 0 {
		t.Fatalf("veio %+v", r)
	}
}

// Nível Encanto do Club: PAC grátis sempre; SEDEX continua pago.
func TestFreteGratisDoEncanto(t *testing.T) {
	if !ClubFreeShipping(ClubEncantoFrom) || ClubFreeShipping(ClubEncantoFrom-1) {
		t.Fatal("frete grátis começa no Encanto")
	}
	if got := ShippingCostFor("MG", 5000, ShippingEconomic, true); got != 0 {
		t.Errorf("PAC deveria sair grátis, veio %d", got)
	}
	if got := ShippingCostFor("MG", 5000, ShippingExpress, true); got == 0 {
		t.Error("SEDEX continua pago no Encanto")
	}
	if got := ShippingCostFor("MG", 5000, ShippingEconomic, false); got == 0 {
		t.Error("sem Encanto e abaixo de R$300, PAC é pago")
	}
}
