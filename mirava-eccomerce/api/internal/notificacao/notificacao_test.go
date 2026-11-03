package notificacao

import (
	"context"
	"testing"
)

type logMudo struct{}

func (logMudo) Error(string, ...any) {}
func (logMudo) Info(string, ...any)  {}

// Sem RESEND_API_KEY, NovoEmail devolve *Email nulo. Dentro da interface
// Canal esse nulo NÃO é igual a nil (o valor tem tipo), e o canal passava pelo
// filtro de Novo — o primeiro aviso derrubava a requisição com pânico de
// ponteiro nulo. Aconteceu no despacho pelo painel em desenvolvimento.
func TestCanalDeEmailSemChaveEhDescartado(t *testing.T) {
	n := Novo(logMudo{}, NovoEmail("", ""))
	if len(n.canais) != 0 {
		t.Fatalf("esperava nenhum canal ativo, veio %d", len(n.canais))
	}
	// Não pode entrar em pânico.
	n.Avisar(context.Background(), PedidoEnviado, Pedido{Numero: 1, Email: "a@b.c"})
}
