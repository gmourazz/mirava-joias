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

// Faixa aceita de markup no painel. Abaixo de 20% a peça mal paga a taxa e a
// embalagem; acima de 500% é quase sempre erro de digitação (2000 no lugar de
// 200).
const (
	MinMarkupPct = 20
	MaxMarkupPct = 500
)

func ValidMarkup(pct float64) bool { return pct >= MinMarkupPct && pct <= MaxMarkupPct }

// PriceFromMarkup é o preço de venda a partir do custo de atacado e do
// markup. A MESMA conta existe em SQL, na função public.apply_synced_cost
// (db/schema.sql): round(custo * (1 + markup/100)). Mudou aqui, mude lá.
func PriceFromMarkup(cost Cents, markupPct float64) Cents {
	return Cents(math.Round(float64(cost) * (1 + markupPct/100)))
}

// EffectiveMarkup é o markup que vale para a peça (decisão 21): o da própria
// peça, senão o da categoria, senão o padrão da loja. A mesma ordem existe em
// SQL, em public.effective_markup (db/schema.sql).
func EffectiveMarkup(product, category *float64, global float64) float64 {
	if product != nil {
		return *product
	}
	if category != nil {
		return *category
	}
	return global
}

// RoundTo90 sobe o preço para o próximo X,90 — nunca baixa. Igual a
// public.round_to_90 no SQL.
func RoundTo90(c Cents) Cents {
	if c <= 0 {
		return 0
	}
	reais := c / 100
	if c%100 > 90 {
		reais++
	}
	return reais*100 + 90
}

// PriceFromMarkupRounded aplica o markup e, se a loja pedir, o ,90.
func PriceFromMarkupRounded(cost Cents, markupPct float64, round90 bool) Cents {
	p := PriceFromMarkup(cost, markupPct)
	if round90 {
		return RoundTo90(p)
	}
	return p
}
