package dominio

import "math"

// Pricing é o resultado do cálculo completo de uma peça.
type Pricing struct {
	WholesaleCost Cents
	Packaging     Cents
	BasePrice     Cents // custo + markup, antes do desconto
	FinalPrice    Cents // o que a cliente paga
	GatewayFee    Cents
	Profit        Cents
	MarginPct     float64
}

// PricingInput reúne tudo que influencia o preço.
type PricingInput struct {
	WholesaleCost  Cents
	Packaging      Cents
	MarkupPct      float64
	DiscountPct    float64
	GatewayFeePct  float64
}

// Price calcula preço e lucro real.
//
// A ordem importa: markup sobre o custo, desconto sobre o preço, taxa sobre o
// que a cliente efetivamente paga. Embalagem e taxa NÃO entram no markup — e é
// exatamente aí que o lucro some quando a conta é feita de cabeça.
func Price(in PricingInput) Pricing {
	base := Cents(math.Round(float64(in.WholesaleCost) * (1 + in.MarkupPct/100)))
	final := Cents(math.Round(float64(base) * (1 - in.DiscountPct/100)))
	fee := Cents(math.Round(float64(final) * in.GatewayFeePct / 100))
	profit := final - in.WholesaleCost - in.Packaging - fee

	var margin float64
	if final > 0 {
		margin = float64(profit) / float64(final) * 100
	}

	return Pricing{
		WholesaleCost: in.WholesaleCost,
		Packaging:     in.Packaging,
		BasePrice:     base,
		FinalPrice:    final,
		GatewayFee:    fee,
		Profit:        profit,
		MarginPct:     margin,
	}
}

// MarginDangerous sinaliza preço em que uma devolução ou peça com defeito
// apaga o lucro de várias vendas.
func (p Pricing) MarginDangerous() bool { return p.MarginPct < 20 }

// Taxas do Mercado Pago (agosto/2026). Confira as suas em
// Mercado Pago → Seu negócio → Taxas e parcelas: elas variam por conta.
const (
	FeePix           = 0.99
	FeeCreditUpfront = 4.98 // recebendo na hora
	FeeCredit2x      = 4.49
	FeeCredit12x     = 12.49
)

// PriceVariationLimit é o disjuntor da sincronização automática.
//
// A sincronização atualiza preço sozinha, o que é o que a dona quer. Mas um
// extrator quebrado que leia R$2,00 no lugar de R$23,00 reescreveria o
// catálogo inteiro com lixo. Variação acima disto vira sugestão pendente
// em vez de gravação.
const PriceVariationLimit = 0.30

// VariationAcceptable diz se a mudança de preço pode ser aplicada sozinha.
func VariationAcceptable(current, updated Cents) bool {
	if current <= 0 {
		return false // sem base de comparação, exige revisão humana
	}
	delta := math.Abs(float64(updated-current)) / float64(current)
	return delta <= PriceVariationLimit
}
