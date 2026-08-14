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

// Centavos é dinheiro. Sempre inteiro, nunca float.
//
// Por que tipo próprio e não int: em Go, `Centavos(6900) + 50` compila, mas
// `precoEmReais * quantidade` com Centavos do outro lado não. O compilador
// vira sua rede de proteção contra somar reais com centavos.
//
// Por que nunca float: 0.1 + 0.2 == 0.30000000000000004. Numa loja isso vira
// centavo faltando no fechamento do mês, e o erro se acumula silenciosamente.
type Centavos int64

func (c Centavos) String() string {
	sinal := ""
	v := int64(c)
	if v < 0 {
		sinal = "-"
		v = -v
	}
	return fmt.Sprintf("%sR$ %d,%02d", sinal, v/100, v%100)
}

// Reais converte para float apenas na fronteira com APIs que exigem
// (o Mercado Pago espera unit_price em reais). Nunca use internamente.
func (c Centavos) Reais() float64 { return float64(c) / 100 }

func DeReais(r float64) Centavos { return Centavos(math.Round(r * 100)) }

// ParseBRL lê "1.234,56" ou "R$ 48,00" e devolve centavos.
// Usado ao ler as páginas da Lilly.
func ParseBRL(s string) (Centavos, error) {
	limpo := strings.NewReplacer("R$", "", " ", "", " ", "", ".", "").Replace(s)
	limpo = strings.Replace(limpo, ",", ".", 1)
	limpo = strings.TrimSpace(limpo)
	if limpo == "" {
		return 0, fmt.Errorf("valor vazio")
	}
	f, err := strconv.ParseFloat(limpo, 64)
	if err != nil {
		return 0, fmt.Errorf("valor inválido %q: %w", s, err)
	}
	return DeReais(f), nil
}

// AplicarPct aplica um percentual arredondando meio para cima.
// Ex.: AplicarPct(2300, 200) = 4600 (o acréscimo de 200%).
func AplicarPct(c Centavos, pct float64) Centavos {
	return Centavos(math.Round(float64(c) * pct / 100))
}
