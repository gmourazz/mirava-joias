package dominio

import "testing"

// O fechamento do mês: a venda das peças paga o atacado, as taxas do Mercado
// Pago, a embalagem de cada pedido e o frete dos lotes comprados abaixo da
// meta. O frete cobrado da cliente é repasse aos Correios — entra no
// faturamento, mas não é lucro.
func TestFechamentoDoMes(t *testing.T) {
	f := MonthlyFinance(FinanceInput{
		Orders:          3,
		Subtotal:        30000, // R$300 em peças
		ShippingCharged: 3780,  // dois fretes de R$18,90
		Cost:            10000, // R$100 no atacado
		Fees:            1494,  // taxas reais do MP
		PackagingEach:   500,
		BatchFreight:    3000, // um lote fechado pelo teto de dias
	})

	if f.Revenue != 33780 {
		t.Errorf("faturamento = %d, esperado 33780", f.Revenue)
	}
	if f.GrossProfit != 20000 {
		t.Errorf("lucro bruto = %d, esperado 20000", f.GrossProfit)
	}
	if f.Packaging != 1500 {
		t.Errorf("embalagem = %d, esperado 1500", f.Packaging)
	}
	// 30000 − 10000 − 1494 − 1500 − 3000
	if f.NetProfit != 14006 {
		t.Errorf("lucro líquido = %d, esperado 14006", f.NetProfit)
	}
}

func TestMesSemVendaNaoDivide(t *testing.T) {
	f := MonthlyFinance(FinanceInput{PackagingEach: 500})
	if f.NetProfit != 0 || f.NetMarginPct != 0 {
		t.Errorf("mês vazio deveria dar zero, veio %+v", f)
	}
}

// Margem líquida é sobre a venda das peças, não sobre o faturamento com
// frete — senão um mês com muito SEDEX pareceria menos lucrativo sem ser.
func TestMargemSobreAVendaDasPecas(t *testing.T) {
	f := MonthlyFinance(FinanceInput{Orders: 1, Subtotal: 10000, ShippingCharged: 5000, Cost: 4000})
	if f.NetMarginPct != 60 {
		t.Errorf("margem = %v, esperado 60", f.NetMarginPct)
	}
}

// Desconto (cupom ou pontos) sai da venda das peças; embrulho é receita da
// loja e entra no faturamento e no lucro (decisão 31).
func TestFechamentoComDescontoEEmbrulho(t *testing.T) {
	f := MonthlyFinance(FinanceInput{
		Orders:   2,
		Subtotal: 20000, // R$200 em peças
		Discount: 3000,  // um cupom de R$30
		GiftWrap: 500,   // um embrulho
		Cost:     7000,
	})
	if f.Revenue != 17500 {
		t.Errorf("faturamento = %d, esperado 17500 (200 − 30 + 5)", f.Revenue)
	}
	if f.GrossProfit != 10500 {
		t.Errorf("lucro bruto = %d, esperado 10500 (200 − 30 − 70 + 5)", f.GrossProfit)
	}
	// Margem sobre as peças já com desconto: 10500 / 17000.
	if got := f.NetMarginPct; got < 61.76 || got > 61.77 {
		t.Errorf("margem = %v, esperado ~61,76", got)
	}
}
