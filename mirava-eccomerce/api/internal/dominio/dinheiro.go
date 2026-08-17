// Package dominio contém as regras de negócio da Mirava.
//
// Nada aqui importa banco de dados, HTTP ou biblioteca externa. É Go puro.
// Isso não é purismo: é o que permite testar a regra de preço em
// milissegundos, sem subir Postgres nem servidor.
package dominio

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// Cents é dinheiro. Sempre inteiro, nunca float.
//
// Por que tipo próprio e não int: em Go, `Cents(6900) + 50` compila, mas
// `priceInReais * quantity` com Cents do outro lado não. O compilador
// vira sua rede de proteção contra somar reais com centavos.
//
// Por que nunca float: 0.1 + 0.2 == 0.30000000000000004. Numa loja isso vira
// centavo faltando no fechamento do mês, e o erro se acumula silenciosamente.
type Cents int64

func (c Cents) String() string {
	sign := ""
	v := int64(c)
	if v < 0 {
		sign = "-"
		v = -v
	}
	return fmt.Sprintf("%sR$ %d,%02d", sign, v/100, v%100)
}

// ToReais converte para float apenas na fronteira com APIs que exigem
// (o Mercado Pago espera unit_price em reais). Nunca use internamente.
func (c Cents) ToReais() float64 { return float64(c) / 100 }

func FromReais(r float64) Cents { return Cents(math.Round(r * 100)) }

// ParseBRL lê "1.234,56" ou "R$ 48,00" e devolve centavos.
// Usado ao ler as páginas da Lilly.
func ParseBRL(s string) (Cents, error) {
	clean := strings.NewReplacer("R$", "", " ", "", " ", "", ".", "").Replace(s)
	clean = strings.Replace(clean, ",", ".", 1)
	clean = strings.TrimSpace(clean)
	if clean == "" {
		return 0, fmt.Errorf("valor vazio")
	}
	f, err := strconv.ParseFloat(clean, 64)
	if err != nil {
		return 0, fmt.Errorf("valor inválido %q: %w", s, err)
	}
	return FromReais(f), nil
}

// ApplyPercent aplica um percentual arredondando meio para cima.
// Ex.: ApplyPercent(2300, 200) = 4600 (o acréscimo de 200%).
func ApplyPercent(c Cents, pct float64) Cents {
	return Cents(math.Round(float64(c) * pct / 100))
}
