package dominio

import "testing"

// Os números deste teste vêm de uma peça real da Lilly: Pulseira Maya (PL46),
// atacado R$23,00, varejo dela R$32,90. Embalagem Mirava estimada em R$5,00.
func TestPrecificarPecaReal(t *testing.T) {
	casos := []struct {
		markup     float64
		preco      Centavos
		lucro      Centavos
		margemAprox float64
	}{
		{50, 3450, 478, 13.9},
		{100, 4600, 1571, 34.2},
		{150, 5750, 2664, 46.3},
		{200, 6900, 3756, 54.4}, // markup escolhido pela dona
	}

	for _, c := range casos {
		got := Precificar(EntradaPreco{
			CustoAtacado:   2300,
			Embalagem:      500,
			MarkupPct:      c.markup,
			TaxaGatewayPct: TaxaCreditoAVista,
		})

		if got.PrecoFinal != c.preco {
			t.Errorf("markup %.0f%%: preço = %v, esperado %v", c.markup, got.PrecoFinal, c.preco)
		}
		if got.Lucro != c.lucro {
			t.Errorf("markup %.0f%%: lucro = %v, esperado %v", c.markup, got.Lucro, c.lucro)
		}
		if diff := got.MargemPct - c.margemAprox; diff > 0.15 || diff < -0.15 {
			t.Errorf("markup %.0f%%: margem = %.2f%%, esperado ~%.1f%%", c.markup, got.MargemPct, c.margemAprox)
		}
	}
}

// Markup de 50% deixa menos de R$5 por peça — precisa disparar o alerta.
func TestMargemPerigosa(t *testing.T) {
	fraca := Precificar(EntradaPreco{
		CustoAtacado: 2300, Embalagem: 500, MarkupPct: 50, TaxaGatewayPct: TaxaCreditoAVista,
	})
	if !fraca.MargemPerigosa() {
		t.Errorf("markup de 50%% deveria ser sinalizado como perigoso (margem %.1f%%)", fraca.MargemPct)
	}

	boa := Precificar(EntradaPreco{
		CustoAtacado: 2300, Embalagem: 500, MarkupPct: 200, TaxaGatewayPct: TaxaCreditoAVista,
	})
	if boa.MargemPerigosa() {
		t.Errorf("markup de 200%% não deveria ser perigoso (margem %.1f%%)", boa.MargemPct)
	}
}

// Pix é a venda mais lucrativa mesmo dando 5% de desconto — e o dinheiro cai
// na hora, que é quando ela precisa para fechar o lote.
func TestPixCompensaMesmoComDesconto(t *testing.T) {
	pix := Precificar(EntradaPreco{
		CustoAtacado: 2300, Embalagem: 500, MarkupPct: 200,
		DescontoPct: 5, TaxaGatewayPct: TaxaPix,
	})
	credito := Precificar(EntradaPreco{
		CustoAtacado: 2300, Embalagem: 500, MarkupPct: 200,
		TaxaGatewayPct: TaxaCreditoAVista,
	})

	diff := credito.Lucro - pix.Lucro
	if diff > 100 { // menos de R$1,00 de diferença
		t.Errorf("Pix com 5%% off perdendo demais: crédito %v vs pix %v (diferença %v)",
			credito.Lucro, pix.Lucro, diff)
	}
}

func TestDisjuntorDePreco(t *testing.T) {
	casos := []struct {
		nome        string
		atual, novo Centavos
		aceita      bool
	}{
		{"reajuste pequeno da Lilly", 6900, 7200, true},
		{"reajuste de 10%", 6900, 7590, true},
		{"queda de 30% no limite", 10000, 7000, true},
		{"extrator leu R$2 em vez de R$23", 6900, 600, false},
		{"preço dobrou, suspeito", 6900, 14000, false},
		{"produto sem preço anterior", 0, 6900, false},
	}

	for _, c := range casos {
		if got := VariacaoAceitavel(c.atual, c.novo); got != c.aceita {
			t.Errorf("%s: VariacaoAceitavel(%v, %v) = %v, esperado %v",
				c.nome, c.atual, c.novo, got, c.aceita)
		}
	}
}

func TestParseBRL(t *testing.T) {
	casos := []struct {
		entrada string
		querido Centavos
	}{
		{"48,00", 4800},
		{"R$ 48,00", 4800},
		{"R$32,90", 3290},
		{"1.234,56", 123456},
		{"23,00", 2300},
	}
	for _, c := range casos {
		got, err := ParseBRL(c.entrada)
		if err != nil {
			t.Errorf("ParseBRL(%q) devolveu erro: %v", c.entrada, err)
			continue
		}
		if got != c.querido {
			t.Errorf("ParseBRL(%q) = %v, esperado %v", c.entrada, got, c.querido)
		}
	}
}

func TestFormatacao(t *testing.T) {
	if got := Centavos(6900).String(); got != "R$ 69,00" {
		t.Errorf("String() = %q", got)
	}
	if got := Centavos(478).String(); got != "R$ 4,78" {
		t.Errorf("String() = %q", got)
	}
}
