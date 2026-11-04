package dominio

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

// Descontos, embrulho e Mirava Club (decisão 31 da arquitetura).
//
// Regras: cupom (% ou valor fixo) OU pontos, nunca os dois; desconto só sobre
// as peças, nunca sobre o frete; teto de 30% das peças em qualquer caso. A
// conta do pedido inteiro (com promoção, kit e Pix) é PriceOrder.

// MaxDiscountPct é o teto de desconto sobre as peças. Com markup de 200%, a
// peça ainda paga atacado, taxa e embalagem com 30% de desconto.
const MaxDiscountPct = 30

// MaxDiscount é o maior desconto possível para um valor de peças.
func MaxDiscount(subtotal Cents) Cents {
	return subtotal * MaxDiscountPct / 100
}

func capDiscount(d, subtotal Cents) Cents {
	if m := MaxDiscount(subtotal); d > m {
		d = m
	}
	if d < 0 {
		return 0
	}
	return d
}

// ---------------------------------------------------------------------------
// Cupom
// ---------------------------------------------------------------------------

type CouponKind string

const (
	CouponPercent CouponKind = "percent" // Value = % (1 a 30)
	CouponFixed   CouponKind = "fixed"   // Value = centavos
)

type Coupon struct {
	Code        string
	Kind        CouponKind
	Value       int
	MinSubtotal Cents
	StartsAt    *time.Time
	EndsAt      *time.Time
	MaxUses     int // 0 = sem limite
	Active      bool
	// Regras por cliente (decisão 34), conferidas em Eligible.
	FirstOrderOnly  bool
	OncePerCustomer bool
}

var ErrCouponInvalid = errors.New("cupom inválido")

// NormalizeCouponCode: códigos são guardados e comparados em maiúsculas, sem
// espaços nas pontas — "verao15 " e "VERAO15" são o mesmo cupom.
func NormalizeCouponCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

// Validate confere o cupom na hora de criar no painel.
func (c Coupon) Validate() error {
	code := NormalizeCouponCode(c.Code)
	if code == "" || len(code) > 30 || strings.ContainsAny(code, " \t") {
		return errors.New("o código precisa ter de 1 a 30 caracteres, sem espaço")
	}
	switch c.Kind {
	case CouponPercent:
		if c.Value < 1 || c.Value > MaxDiscountPct {
			return errors.New("a porcentagem precisa ficar entre 1% e 30%")
		}
	case CouponFixed:
		if c.Value < 100 {
			return errors.New("o valor fixo precisa ser de pelo menos R$ 1,00")
		}
	default:
		return errors.New("tipo de cupom inválido")
	}
	if c.MinSubtotal < 0 || c.MaxUses < 0 {
		return errors.New("mínimo e limite de usos não podem ser negativos")
	}
	if c.StartsAt != nil && c.EndsAt != nil && !c.EndsAt.After(*c.StartsAt) {
		return errors.New("o fim da validade precisa ser depois do início")
	}
	return nil
}

// Discount calcula o desconto do cupom sobre as peças, ou diz por que não
// vale. `uses` é quantas vezes o cupom já foi usado em pedidos que contam.
func (c Coupon) Discount(subtotal Cents, now time.Time, uses int) (Cents, error) {
	switch {
	case !c.Active:
		return 0, errors.New("este cupom não está ativo")
	case c.StartsAt != nil && now.Before(*c.StartsAt):
		return 0, errors.New("este cupom ainda não começou a valer")
	case c.EndsAt != nil && now.After(*c.EndsAt):
		return 0, errors.New("este cupom já venceu")
	case c.MaxUses > 0 && uses >= c.MaxUses:
		return 0, errors.New("este cupom já atingiu o limite de usos")
	case subtotal < c.MinSubtotal:
		return 0, errors.New("o valor das peças está abaixo do mínimo deste cupom (" + c.MinSubtotal.String() + ")")
	}
	var d Cents
	switch c.Kind {
	case CouponPercent:
		d = subtotal * Cents(c.Value) / 100
	case CouponFixed:
		d = Cents(c.Value)
	default:
		return 0, ErrCouponInvalid
	}
	return capDiscount(d, subtotal), nil
}

// ---------------------------------------------------------------------------
// Mirava Club
// ---------------------------------------------------------------------------

const (
	PointsPerBlock = 100 // pontos por bloco de resgate
	CentsPerBlock  = 500 // cada bloco vale R$5
)

// PointsEarned: 1 ponto por real inteiro em peças (já com desconto). Frete e
// embrulho não dão ponto.
func PointsEarned(piecesAfterDiscount Cents) int {
	if piecesAfterDiscount <= 0 {
		return 0
	}
	return int(piecesAfterDiscount / 100)
}

type ClubLevel string

const (
	ClubBrilho   ClubLevel = "brilho"
	ClubEncanto  ClubLevel = "encanto"
	ClubJoiaRara ClubLevel = "joia_rara"
)

// Faixas de nível pelos pontos já ganhos (não pelo saldo: usar pontos não
// derruba o nível).
const (
	ClubEncantoFrom  = 500
	ClubJoiaRaraFrom = 1500
)

func ClubLevelFor(earned int) ClubLevel {
	switch {
	case earned >= ClubJoiaRaraFrom:
		return ClubJoiaRara
	case earned >= ClubEncantoFrom:
		return ClubEncanto
	}
	return ClubBrilho
}

// ---------------------------------------------------------------------------
// Embrulho e total
// ---------------------------------------------------------------------------

// GiftWrapCents é o preço do embrulho para presente com cartão.
const GiftWrapCents Cents = 500

const MaxGiftMessage = 200

// GiftMessage limpa e valida a mensagem do cartão.
func GiftMessage(msg string) (string, error) {
	msg = strings.TrimSpace(msg)
	if utf8.RuneCountInString(msg) > MaxGiftMessage {
		return "", errors.New("a mensagem do cartão pode ter até 200 caracteres")
	}
	return msg, nil
}

type Totals struct {
	Subtotal Cents
	Discount Cents
	Shipping Cents
	GiftWrap Cents
	Total    Cents
}

// OrderTotal: peças − desconto + frete + embrulho. A mesma conta do CHECK
// ck_total_coherent em public.orders (db/schema.sql).
func OrderTotal(subtotal, discount, shipping Cents, giftWrap bool) Totals {
	t := Totals{Subtotal: subtotal, Discount: discount, Shipping: shipping}
	if giftWrap {
		t.GiftWrap = GiftWrapCents
	}
	t.Total = subtotal - discount + shipping + t.GiftWrap
	return t
}
