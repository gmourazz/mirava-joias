package dominio

// Fechamento financeiro do mês (tela Financeiro do painel).
//
// Só pedidos cujo dinheiro é da loja entram (Status.CountsForRevenue). Custo e
// preço vêm congelados nos itens do pedido, então o resultado de um mês
// passado não muda quando a Lilly mexe no preço depois.

type FinanceInput struct {
	Orders          int
	Subtotal        Cents // venda das peças
	ShippingCharged Cents // frete pago pela cliente — repasse aos Correios
	Cost            Cents // atacado congelado nos itens
	Fees            Cents // taxas reais do Mercado Pago (payments.fee_cents)
	PackagingEach   Cents // embalagem Mirava por pedido (EMBALAGEM_CENTAVOS)
	BatchFreight    Cents // frete pago à Lilly nos lotes comprados abaixo da meta
}

type Finance struct {
	FinanceInput
	Revenue      Cents   // tudo o que a cliente pagou: peças + frete
	Packaging    Cents   // embalagem × pedidos
	GrossProfit  Cents   // peças − atacado
	NetProfit    Cents   // bruto − taxas − embalagem − frete dos lotes
	NetMarginPct float64 // líquido sobre a venda das peças
}

// MonthlyFinance fecha o mês.
//
// O frete cobrado da cliente entra no faturamento mas não no lucro: ele vai
// para os Correios. A margem é sobre a venda das peças, para um mês com muito
// SEDEX não parecer menos lucrativo sem ser.
func MonthlyFinance(in FinanceInput) Finance {
	packaging := in.PackagingEach * Cents(in.Orders)
	gross := in.Subtotal - in.Cost
	net := gross - in.Fees - packaging - in.BatchFreight

	var margin float64
	if in.Subtotal > 0 {
		margin = float64(net) / float64(in.Subtotal) * 100
	}
	return Finance{
		FinanceInput: in,
		Revenue:      in.Subtotal + in.ShippingCharged,
		Packaging:    packaging,
		GrossProfit:  gross,
		NetProfit:    net,
		NetMarginPct: margin,
	}
}
