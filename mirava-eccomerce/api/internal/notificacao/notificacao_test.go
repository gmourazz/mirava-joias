package notificacao

import (
	"context"
	"strings"
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

// Texto editado no painel (Automações): as variáveis viram os dados da cliente.
func TestTextoPersonalizado(t *testing.T) {
	p := Pedido{Numero: 42, Nome: "Juliana Alves", Produto: "Anel Aura", Cupom: "VOLTA10",
		URLAcao: "https://mirava.com.br/x", Total: 12990,
		AssuntoPersonalizado: "{nome}, seu {produto} te espera",
		MioloPersonalizado:   "Pedido #{pedido} de {total}. Use {cupom}: {link}"}
	if got := Assunto(CarrinhoAbandonado, p); got != "Juliana, seu Anel Aura te espera" {
		t.Errorf("assunto: %q", got)
	}
	corpo := corpoTexto(CarrinhoAbandonado, p)
	if !strings.Contains(corpo, "Pedido #42 de R$ 129,90. Use VOLTA10: https://mirava.com.br/x") {
		t.Errorf("corpo: %q", corpo)
	}
	// Sem texto próprio, continua o padrão.
	p.AssuntoPersonalizado, p.MioloPersonalizado = "", ""
	if got := Assunto(CarrinhoAbandonado, p); got != "Suas peças ainda estão na sacola ✦" {
		t.Errorf("padrão: %q", got)
	}
}

func TestAvisosDeConta(t *testing.T) {
	p := Pedido{Nome: "Ana", URLAcao: "https://mirava.com.br/redefinir?t=abc", TextoAcao: "Criar nova senha", Cupom: "BEMVINDA10"}
	if !strings.Contains(corpoTexto(RecuperarSenha, p), "https://mirava.com.br/redefinir?t=abc") {
		t.Error("recuperar senha precisa levar o link")
	}
	if !strings.Contains(corpoTexto(BoasVindas, p), "BEMVINDA10") || !strings.Contains(corpoTexto(CupomEnviado, p), "BEMVINDA10") {
		t.Error("boas-vindas e cupom enviado precisam mostrar o código")
	}
}

// Texto livre editado no painel vira texto, nunca HTML do e-mail.
func TestTextoPersonalizadoEscapadoNoHTML(t *testing.T) {
	p := Pedido{Nome: "Ana", MioloPersonalizado: "<script>alert(1)</script>"}
	h := corpoHTML(CarrinhoAbandonado, p, corpoTexto(CarrinhoAbandonado, p))
	if strings.Contains(h, "<script>") {
		t.Error("HTML do texto personalizado não foi escapado")
	}
}

func TestAvisosDaDona(t *testing.T) {
	p := Pedido{Numero: 42, Nome: "Marina", Total: 12990, Etapa: "comprado, esperando chegar", Produto: "A peça já tinha sido comprada na Lilly e fica com você."}
	if a := Assunto(DonaPedidoPago, p); !strings.Contains(a, "#42") || !strings.Contains(a, "129,90") {
		t.Errorf("assunto do pedido pago: %q", a)
	}
	m := corpoTexto(DonaPedidoCancelado, p)
	if !strings.Contains(m, "Marina") || !strings.Contains(m, "comprado, esperando chegar") || !strings.Contains(m, "fica com você") {
		t.Errorf("miolo do cancelamento: %q", m)
	}
}
