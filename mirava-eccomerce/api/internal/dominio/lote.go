package dominio

import "time"

// Regras do lote de compra na Lilly.
//
// A Mirava compra sob encomenda: os pedidos pagos se acumulam e viram uma
// única compra no atacado. Isso economiza frete, mas faz a primeira cliente
// do lote esperar mais que a última — e é por isso que existe o teto de dias.
const (
	// Frete grátis no atacado da Lilly, Sudeste (a dona está em Minas).
	FreeShippingGoal Cents = 30000 // R$300

	// Teto de espera. Batendo isso, o lote fecha mesmo sem atingir a meta e
	// a Mirava paga o frete.
	//
	// A conta que justifica: um lote fechado em R$150 leva ~7 peças e o frete
	// (~R$30) sai a R$4,29 por peça — 16% do lucro de uma peça. Uma cliente
	// irritada, um estorno ou uma avaliação ruim custam bem mais que isso.
	// Frete rateado é barato; atraso é caro.
	DaysCap = 5

	// Frete estimado quando o lote fecha abaixo da meta.
	EstimatedShipping Cents = 3000
)

// CloseReason explica por que o lote deve (ou não) fechar.
type CloseReason string

const (
	ReasonGoal         CloseReason = "meta de frete grátis atingida"
	ReasonCap          CloseReason = "teto de dias úteis atingido"
	ReasonAccumulating CloseReason = "ainda acumulando"
)

// BatchEvaluation é o resultado da decisão de fechar ou não.
type BatchEvaluation struct {
	ShouldClose       bool
	Reason            CloseReason
	MissingForGoal    Cents
	OldestDays        int
	EstimatedShipping Cents
}

// EvaluateBatch decide se o lote fecha agora.
func EvaluateBatch(accumulatedCost Cents, oldestPaidAt time.Time, now time.Time) BatchEvaluation {
	days := 0
	if !oldestPaidAt.IsZero() {
		days = BusinessDaysBetween(oldestPaidAt, now)
	}

	missing := FreeShippingGoal - accumulatedCost
	if missing < 0 {
		missing = 0
	}

	switch {
	case accumulatedCost >= FreeShippingGoal:
		return BatchEvaluation{true, ReasonGoal, 0, days, 0}
	case days >= DaysCap:
		return BatchEvaluation{true, ReasonCap, missing, days, EstimatedShipping}
	default:
		return BatchEvaluation{false, ReasonAccumulating, missing, days, EstimatedShipping}
	}
}

// BusinessDaysBetween conta dias úteis completos entre dois instantes.
//
// LIMITAÇÃO: ignora feriados. Para a regra do lote isso é aceitável — errar
// por um dia a favor da cliente não causa dano. Se um dia precisar de
// precisão, troque por uma tabela de feriados.
func BusinessDaysBetween(start, end time.Time) int {
	if end.Before(start) {
		return 0
	}
	d := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())
	final := time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, end.Location())

	n := 0
	for d.Before(final) {
		d = d.AddDate(0, 0, 1)
		if wd := d.Weekday(); wd != time.Saturday && wd != time.Sunday {
			n++
		}
	}
	return n
}

// EstimatedDeadline devolve a faixa de dias úteis prometida à cliente,
// contando a partir do pagamento.
//
// Composição: até 5 dias esperando o lote + 4 dias de postagem da Lilly +
// 3 a 6 do transporte até Minas + 1 a 2 para reembalar + 3 a 7 até a cliente.
func EstimatedDeadline() (min, max int) { return 10, 20 }
