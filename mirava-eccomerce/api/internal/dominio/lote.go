package dominio

import "time"

// Regras do lote de compra na Lilly.
//
// A Mirava compra sob encomenda: os pedidos pagos se acumulam e viram uma
// única compra no atacado. Isso economiza frete, mas faz a primeira cliente
// do lote esperar mais que a última — e é por isso que existe o teto de dias.
const (
	// Frete grátis no atacado da Lilly, Sudeste (a dona está em Minas).
	MetaFreteGratis Centavos = 30000 // R$300

	// Teto de espera. Batendo isso, o lote fecha mesmo sem atingir a meta e
	// a Mirava paga o frete.
	//
	// A conta que justifica: um lote fechado em R$150 leva ~7 peças e o frete
	// (~R$30) sai a R$4,29 por peça — 16% do lucro de uma peça. Uma cliente
	// irritada, um estorno ou uma avaliação ruim custam bem mais que isso.
	// Frete rateado é barato; atraso é caro.
	TetoDiasUteis = 5

	// Frete estimado quando o lote fecha abaixo da meta.
	FreteEstimado Centavos = 3000
)

// MotivoFechamento explica por que o lote deve (ou não) fechar.
type MotivoFechamento string

const (
	MotivoMeta      MotivoFechamento = "meta de frete grátis atingida"
	MotivoTeto      MotivoFechamento = "teto de dias úteis atingido"
	MotivoAcumulando MotivoFechamento = "ainda acumulando"
)

// AvaliacaoLote é o resultado da decisão de fechar ou não.
type AvaliacaoLote struct {
	Deve            bool
	Motivo          MotivoFechamento
	FaltaParaMeta   Centavos
	DiasMaisAntigo  int
	FreteEstimado   Centavos
}

// AvaliarLote decide se o lote fecha agora.
func AvaliarLote(custoAcumulado Centavos, pagoMaisAntigo time.Time, agora time.Time) AvaliacaoLote {
	dias := 0
	if !pagoMaisAntigo.IsZero() {
		dias = DiasUteisEntre(pagoMaisAntigo, agora)
	}

	falta := MetaFreteGratis - custoAcumulado
	if falta < 0 {
		falta = 0
	}

	switch {
	case custoAcumulado >= MetaFreteGratis:
		return AvaliacaoLote{true, MotivoMeta, 0, dias, 0}
	case dias >= TetoDiasUteis:
		return AvaliacaoLote{true, MotivoTeto, falta, dias, FreteEstimado}
	default:
		return AvaliacaoLote{false, MotivoAcumulando, falta, dias, FreteEstimado}
	}
}

// DiasUteisEntre conta dias úteis completos entre dois instantes.
//
// LIMITAÇÃO: ignora feriados. Para a regra do lote isso é aceitável — errar
// por um dia a favor da cliente não causa dano. Se um dia precisar de
// precisão, troque por uma tabela de feriados.
func DiasUteisEntre(inicio, fim time.Time) int {
	if fim.Before(inicio) {
		return 0
	}
	d := time.Date(inicio.Year(), inicio.Month(), inicio.Day(), 0, 0, 0, 0, inicio.Location())
	final := time.Date(fim.Year(), fim.Month(), fim.Day(), 0, 0, 0, 0, fim.Location())

	n := 0
	for d.Before(final) {
		d = d.AddDate(0, 0, 1)
		if wd := d.Weekday(); wd != time.Saturday && wd != time.Sunday {
			n++
		}
	}
	return n
}

// PrazoEstimado devolve a faixa de dias úteis prometida à cliente,
// contando a partir do pagamento.
//
// Composição: até 5 dias esperando o lote + 4 dias de postagem da Lilly +
// 3 a 6 do transporte até Minas + 1 a 2 para reembalar + 3 a 7 até a cliente.
func PrazoEstimado() (min, max int) { return 10, 20 }
