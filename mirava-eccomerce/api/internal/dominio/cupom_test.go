package dominio

import "testing"

func TestWelcomeCouponDiscount(t *testing.T) {
	cases := []struct {
		subtotal Cents
		want     Cents
	}{
		{6900, 690},   // R$69,00 -> R$6,90
		{13560, 1356}, // R$135,60 -> R$13,56
		{100, 10},
		{0, 0},
	}
	for _, c := range cases {
		if got := WelcomeCouponDiscount(c.subtotal); got != c.want {
			t.Errorf("WelcomeCouponDiscount(%v) = %v, esperado %v", c.subtotal, got, c.want)
		}
	}
}
