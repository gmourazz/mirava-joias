package dominio

import "math"

// Precificacao é o resultado do cálculo completo de uma peça.
type Precificacao struct {
	CustoAtacado Centavos
	Embalagem    Centavos
	PrecoBase    Centavos // custo + markup, antes do desconto
	PrecoFinal   Centavos // o que a cliente paga
	TaxaGateway  Centavos
	Lucro        Centavos
	MargemPct    float64
}

// EntradaPreco reúne tudo que influencia o preço.
type EntradaPreco struct {
	CustoAtacado  Centavos
	Embalagem     Centavos
	MarkupPct     float64
	DescontoPct   float64
	TaxaGatewayPct float64
}

// Precificar calcula preço e lucro real.
//
// A ordem importa: markup sobre o custo, desconto sobre o preço, taxa sobre o
// que a cliente efetivamente paga. Embalagem e taxa NÃO entram no markup — e é
// exatamente aí que o lucro some quando a conta é feita de cabeça.
func Precificar(e EntradaPreco) Precificacao {
	base := Centavos(math.Round(float64(e.CustoAtacado) * (1 + e.MarkupPct/100)))
	final := Centavos(math.Round(float64(base) * (1 - e.DescontoPct/100)))
	taxa := Centavos(math.Round(float64(final) * e.TaxaGatewayPct / 100))
	lucro := final - e.CustoAtacado - e.Embalagem - taxa

	var margem float64
	if final > 0 {
		margem = float64(lucro) / float64(final) * 100
	}

	return Precificacao{
		CustoAtacado: e.CustoAtacado,
		Embalagem:    e.Embalagem,
		PrecoBase:    base,
		PrecoFinal:   final,
		TaxaGateway:  taxa,
		Lucro:        lucro,
		MargemPct:    margem,
	}
}

// MargemPerigosa sinaliza preço em que uma devolução ou peça com defeito
// apaga o lucro de várias vendas.
func (p Precificacao) MargemPerigosa() bool { return p.MargemPct < 20 }

// Taxas do Mercado Pago (agosto/2026). Confira as suas em
// Mercado Pago → Seu negócio → Taxas e parcelas: elas variam por conta.
const (
	TaxaPix            = 0.99
	TaxaCreditoAVista  = 4.98 // recebendo na hora
	TaxaCredito2x      = 4.49
	TaxaCredito12x     = 12.49
)

// LimiteVariacaoPreco é o disjuntor da sincronização automática.
//
// A sincronização atualiza preço sozinha, o que é o que a dona quer. Mas um
// extrator quebrado que leia R$2,00 no lugar de R$23,00 reescreveria o
// catálogo inteiro com lixo. Variação acima disto vira sugestão pendente
// em vez de gravação.
const LimiteVariacaoPreco = 0.30

// VariacaoAceitavel diz se a mudança de preço pode ser aplicada sozinha.
func VariacaoAceitavel(atual, novo Centavos) bool {
	if atual <= 0 {
		return false // sem base de comparação, exige revisão humana
	}
	delta := math.Abs(float64(novo-atual)) / float64(atual)
	return delta <= LimiteVariacaoPreco
}
