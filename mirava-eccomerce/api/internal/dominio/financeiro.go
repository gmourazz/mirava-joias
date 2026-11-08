package dominio

// Fechamento financeiro do mês (tela Financeiro do painel).
//
// Só pedidos cujo dinheiro é da loja entram (Status.CountsForRevenue). Custo e
// preço vêm congelados nos itens do pedido, então o resultado de um mês
// passado não muda quando a Lilly mexe no preço depois.

type FinanceInput struct {
	Orders   int
	Subtotal Cents // venda das peças, sem desconto
	Discount Cents // cupom ou pontos do Club (decisão 31)
	GiftWrap Cents // embrulho para presente cobrado
	// Embrulhos vendidos e o custo de cada um (caixinha, laço, cartão) — vem
	// de Configurações; 0 = ainda não informado.
	GiftWraps        int
	GiftWrapCostEach Cents
	ShippingCharged  Cents // frete pago pela cliente — repasse aos Correios
	Cost             Cents // atacado congelado nos itens
	Fees             Cents // taxas reais do Mercado Pago (payments.fee_cents)
	PackagingEach    Cents // embalagem Mirava por pedido (EMBALAGEM_CENTAVOS)
	BatchFreight     Cents // frete pago à Lilly nos lotes comprados abaixo da meta
	// Atacado de peças já compradas na Lilly cujo pedido foi estornado no mês
	// (decisão 43): a cliente recebeu o dinheiro de volta e a peça ficou.
	CanceledCost Cents
}

type Finance struct {
	FinanceInput
	Revenue      Cents   // tudo o que a cliente pagou: peças − desconto + frete + embrulho
	Packaging    Cents   // embalagem × pedidos
	GiftWrapCost Cents   // custo dos embrulhos vendidos
	GrossProfit  Cents   // peças − desconto − atacado + embrulho
	NetProfit    Cents   // bruto − taxas − embalagem − custo dos embrulhos − frete dos lotes − peças canceladas
	NetMarginPct float64 // líquido sobre a venda das peças, já com desconto
}

// MonthlyFinance fecha o mês.
//
// O frete cobrado da cliente entra no faturamento mas não no lucro: ele vai
// para os Correios. A margem é sobre a venda das peças, para um mês com muito
// SEDEX não parecer menos lucrativo sem ser.
//
// O desconto sai da venda das peças. O embrulho é receita da loja; o custo de
// cada embrulho (Configurações) sai do lucro.
func MonthlyFinance(in FinanceInput) Finance {
	packaging := in.PackagingEach * Cents(in.Orders)
	pieces := in.Subtotal - in.Discount
	gross := pieces - in.Cost + in.GiftWrap
	giftCost := in.GiftWrapCostEach * Cents(in.GiftWraps)
	net := gross - in.Fees - packaging - giftCost - in.BatchFreight - in.CanceledCost

	var margin float64
	if pieces > 0 {
		margin = float64(net) / float64(pieces) * 100
	}
	return Finance{
		FinanceInput: in,
		Revenue:      pieces + in.ShippingCharged + in.GiftWrap,
		Packaging:    packaging,
		GiftWrapCost: giftCost,
		GrossProfit:  gross,
		NetProfit:    net,
		NetMarginPct: margin,
	}
}
