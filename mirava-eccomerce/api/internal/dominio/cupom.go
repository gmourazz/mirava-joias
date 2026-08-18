package dominio

// Cupom de boas-vindas: código único, 10% de desconto, uma vez por conta.
//
// Não é um sistema geral de cupons — é intencionalmente uma promoção só, por
// isso vive como constante em vez de virar tabela com regras genéricas. Se um
// dia existir uma segunda promoção, aí sim vale generalizar.
const (
	WelcomeCouponCode = "BEMVINDA10"
	WelcomeCouponPct  = 10.0
)

// WelcomeCouponDiscount calcula os 10% sobre o SUBTOTAL — nunca sobre o
// frete, senão o desconto premiaria quem mora longe em vez de premiar a
// primeira compra.
func WelcomeCouponDiscount(subtotal Cents) Cents {
	return ApplyPercent(subtotal, WelcomeCouponPct)
}
