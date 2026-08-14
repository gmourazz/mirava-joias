package dominio

import (
	"testing"
	"time"
)

func TestTransicoesLegais(t *testing.T) {
	casos := []struct {
		de, para Status
		ok       bool
	}{
		{AguardandoPagamento, Pago, true},
		{AguardandoPagamento, Cancelado, true},
		{Pago, NoLote, true},
		{NoLote, CompradoFornecedor, true},
		{CompradoFornecedor, RecebidoPorMim, true},
		{RecebidoPorMim, Enviado, true},
		{Enviado, Entregue, true},
		{FalhaEstoque, Estornado, true},

		// Os caminhos que precisam ser impossíveis:
		{AguardandoPagamento, Enviado, false},  // despachar sem receber
		{AguardandoPagamento, Entregue, false},
		{Entregue, Enviado, false},             // voltar no tempo
		{Cancelado, Pago, false},
		{Estornado, Enviado, false},            // despachar depois de devolver
		{Pago, Entregue, false},                // pular a operação inteira
	}

	for _, c := range casos {
		if got := PodeIr(c.de, c.para); got != c.ok {
			t.Errorf("PodeIr(%s, %s) = %v, esperado %v", c.de, c.para, got, c.ok)
		}
	}
}

// Este teste existe para lembrar que a mesma tabela vive em SQL, na função
// public.transicao_valida (migration 06). Se alguém adicionar um status aqui
// sem adicionar lá, o banco vai recusar a transição em produção.
func TestTodoStatusTemEntradaNaTabela(t *testing.T) {
	todos := []Status{
		AguardandoPagamento, Pago, NoLote, CompradoFornecedor, RecebidoPorMim,
		Enviado, Entregue, Cancelado, Estornado, FalhaEstoque,
	}
	for _, s := range todos {
		if _, ok := transicoes[s]; !ok {
			t.Errorf("status %s sem entrada em transicoes — o banco vai recusar", s)
		}
		if s.Rotulo() == string(s) {
			t.Errorf("status %s sem rótulo amigável para a cliente", s)
		}
	}
}

func TestContaParaFaturamento(t *testing.T) {
	naoConta := []Status{AguardandoPagamento, Cancelado, Estornado, FalhaEstoque}
	for _, s := range naoConta {
		if s.ContaParaFaturamento() {
			t.Errorf("%s não deveria entrar no faturamento", s)
		}
	}
	if !Pago.ContaParaFaturamento() {
		t.Error("pago deveria contar no faturamento")
	}
}

func TestDiasUteis(t *testing.T) {
	// 2026-08-03 é uma segunda-feira.
	seg := time.Date(2026, 8, 3, 10, 0, 0, 0, time.UTC)

	casos := []struct {
		dias  int
		quero int
		nota  string
	}{
		{0, 0, "mesmo dia"},
		{1, 1, "terça"},
		{4, 4, "sexta"},
		{5, 4, "sábado: de segunda até aqui passaram ter, qua, qui, sex"},
		{7, 5, "segunda seguinte: fim de semana não conta"},
	}
	for _, c := range casos {
		got := DiasUteisEntre(seg, seg.AddDate(0, 0, c.dias))
		if got != c.quero {
			t.Errorf("%s: %d dias corridos = %d úteis, esperado %d", c.nota, c.dias, got, c.quero)
		}
	}
}

func TestAvaliarLote(t *testing.T) {
	agora := time.Date(2026, 8, 11, 12, 0, 0, 0, time.UTC) // terça
	seisDiasUteisAtras := time.Date(2026, 8, 3, 12, 0, 0, 0, time.UTC)

	// Bateu R$300: fecha com frete grátis.
	av := AvaliarLote(30000, agora, agora)
	if !av.Deve || av.Motivo != MotivoMeta || av.FreteEstimado != 0 {
		t.Errorf("meta atingida deveria fechar sem frete: %+v", av)
	}

	// Só R$150, mas o pedido mais antigo já esperou demais: fecha e paga.
	av = AvaliarLote(15000, seisDiasUteisAtras, agora)
	if !av.Deve || av.Motivo != MotivoTeto {
		t.Errorf("teto de dias deveria fechar o lote: %+v", av)
	}
	if av.FreteEstimado == 0 {
		t.Error("fechando abaixo da meta, o frete precisa ser previsto")
	}

	// Pouco dinheiro e pouco tempo: continua acumulando.
	av = AvaliarLote(5000, agora, agora)
	if av.Deve {
		t.Errorf("não deveria fechar ainda: %+v", av)
	}
	if av.FaltaParaMeta != 25000 {
		t.Errorf("FaltaParaMeta = %v, esperado R$ 250,00", av.FaltaParaMeta)
	}
}
