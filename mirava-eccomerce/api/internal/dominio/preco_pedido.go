package dominio

import (
	"errors"
	"math"
	"time"
)

// Preço do pedido (decisões 31 a 34), na ordem em que cada coisa se aplica:
//
//  1. Promoção baixa o preço da peça (preço riscado na loja).
//  2. Kit "compre junto" dá desconto nos pares completos — só o que passa da
//     promoção que as duas peças já têm (os dois não somam: vale o maior).
//  3. Cupom OU pontos do Mirava Club, sobre as peças já com promoção e kit.
//  4. Pix: 5% sobre o que sobrou das peças.
//
// Em qualquer combinação, promoção + kit + cupom/pontos + Pix nunca passa de
// 30% do preço cheio das peças (MaxDiscountPct). Frete e embrulho ficam fora.

// PixDiscountPct é o desconto do Pix sobre as peças (decisão 33).
const PixDiscountPct = 5

// MaxPromoPct é o maior percentual de promoção ou kit aceito no painel.
const MaxPromoPct = MaxDiscountPct

type OrderLine struct {
	ProductID string
	ListPrice Cents // preço cheio da unidade (com o ajuste do tamanho)
	PromoPct  int   // maior promoção ativa para a peça; 0 = sem promoção
	Quantity  int
}

type Kit struct {
	A, B string // produtos
	Pct  int
}

// CouponContext é o que o cupom precisa saber da cliente.
type CouponContext struct {
	PriorPaidOrders int  // pedidos pagos (que contam) antes deste
	UsedByCustomer  bool // a cliente já usou este cupom num pedido que conta
}

type OrderPricingInput struct {
	Lines         []OrderLine
	Kits          []Kit
	Coupon        *Coupon
	CouponUses    int
	CouponCtx     CouponContext
	UsePoints     bool
	PointsBalance int
	Pix           bool
	Now           time.Time
}

type PricedLine struct {
	OrderLine
	UnitPrice Cents // com a promoção
}

type OrderPricing struct {
	Lines          []PricedLine
	ListSubtotal   Cents // peças a preço cheio
	Subtotal       Cents // peças com promoção — é o subtotal gravado no pedido
	KitDiscount    Cents
	CouponDiscount Cents // do cupom ou dos pontos
	PixDiscount    Cents
	Discount       Cents // kit + cupom/pontos + Pix
	CouponCode     string
	PointsUsed     int
	PointsEarned   int
	// DiscountErr: o cupom ou os pontos pedidos não valem. Na prévia vira
	// aviso e o resto (promoção, kit, Pix) segue; no checkout, recusa.
	DiscountErr string
}

func clampPct(p int) int {
	if p < 0 {
		return 0
	}
	if p > MaxPromoPct {
		return MaxPromoPct
	}
	return p
}

func pctOf(v Cents, pct int) Cents {
	return Cents(math.Round(float64(v) * float64(pct) / 100))
}

func minCents(a, b Cents) Cents {
	if a < b {
		return a
	}
	return b
}

// PriceOrder monta o preço do pedido. Não consulta nada: quem chama já trouxe
// do banco o preço cheio, a promoção ativa de cada peça, os kits e o cupom.
func PriceOrder(in OrderPricingInput) OrderPricing {
	var out OrderPricing

	type unit struct{ list, promoCut Cents }
	units := map[string][]unit{}

	for _, l := range in.Lines {
		pct := clampPct(l.PromoPct)
		cut := pctOf(l.ListPrice, pct)
		p := PricedLine{OrderLine: l, UnitPrice: l.ListPrice - cut}
		p.PromoPct = pct
		out.Lines = append(out.Lines, p)
		out.ListSubtotal += l.ListPrice * Cents(l.Quantity)
		out.Subtotal += p.UnitPrice * Cents(l.Quantity)
		for i := 0; i < l.Quantity; i++ {
			units[l.ProductID] = append(units[l.ProductID], unit{l.ListPrice, cut})
		}
	}

	room := MaxDiscount(out.ListSubtotal) - (out.ListSubtotal - out.Subtotal)
	if room < 0 {
		room = 0
	}

	// Kits: cada unidade entra em um par só.
	for _, k := range in.Kits {
		pct := clampPct(k.Pct)
		if pct == 0 || k.A == k.B {
			continue
		}
		for len(units[k.A]) > 0 && len(units[k.B]) > 0 {
			a, b := units[k.A][0], units[k.B][0]
			units[k.A], units[k.B] = units[k.A][1:], units[k.B][1:]
			extra := pctOf(a.list+b.list, pct) - a.promoCut - b.promoCut
			if extra > 0 {
				out.KitDiscount += extra
			}
		}
	}
	out.KitDiscount = minCents(out.KitDiscount, room)
	room -= out.KitDiscount

	base := out.Subtotal - out.KitDiscount
	if err := couponOrPoints(&out, in, base, room); err != nil {
		out.DiscountErr = err.Error()
		out.CouponDiscount, out.CouponCode, out.PointsUsed = 0, "", 0
	}
	room -= out.CouponDiscount

	if in.Pix {
		out.PixDiscount = minCents(pctOf(base-out.CouponDiscount, PixDiscountPct), room)
	}

	out.Discount = out.KitDiscount + out.CouponDiscount + out.PixDiscount
	out.PointsEarned = PointsEarned(out.Subtotal - out.Discount)
	return out
}

func couponOrPoints(out *OrderPricing, in OrderPricingInput, base, room Cents) error {
	if in.Coupon != nil && in.UsePoints {
		return errors.New("use o cupom ou os pontos do Mirava Club: os dois juntos não valem")
	}
	if in.Coupon != nil {
		if err := in.Coupon.Eligible(in.CouponCtx); err != nil {
			return err
		}
		d, err := in.Coupon.Discount(base, in.Now, in.CouponUses)
		if err != nil {
			return err
		}
		out.CouponDiscount = minCents(d, room)
		out.CouponCode = NormalizeCouponCode(in.Coupon.Code)
		return nil
	}
	if in.UsePoints {
		pts, d := PointsRedemptionWithin(in.PointsBalance, minCents(room, MaxDiscount(base)))
		if pts == 0 {
			if in.PointsBalance < PointsPerBlock {
				return errors.New("é preciso ter pelo menos 100 pontos para trocar por desconto")
			}
			return errors.New("este pedido já está com o desconto máximo: os pontos ficam para a próxima")
		}
		out.CouponDiscount, out.PointsUsed = d, pts
	}
	return nil
}

// PointsRedemptionWithin: blocos inteiros de 100 pontos que cabem no limite.
func PointsRedemptionWithin(balance int, limit Cents) (points int, discount Cents) {
	blocos := balance / PointsPerBlock
	if m := int(limit / CentsPerBlock); blocos > m {
		blocos = m
	}
	if blocos <= 0 {
		return 0, 0
	}
	return blocos * PointsPerBlock, Cents(blocos * CentsPerBlock)
}

// Eligible confere as regras do cupom que dependem da cliente (decisão 34).
func (c Coupon) Eligible(ctx CouponContext) error {
	if c.FirstOrderOnly && ctx.PriorPaidOrders > 0 {
		return errors.New("este cupom vale só na primeira compra")
	}
	if c.OncePerCustomer && ctx.UsedByCustomer {
		return errors.New("você já usou este cupom")
	}
	return nil
}

// ClubFreeShipping: do nível Encanto para cima, PAC grátis (decisão 34).
func ClubFreeShipping(earned int) bool { return earned >= ClubEncantoFrom }
