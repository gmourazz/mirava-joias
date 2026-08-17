// Package notificacao avisa a cliente quando o pedido dela anda.
//
// POR QUE UMA INTERFACE E NÃO UMA FUNÇÃO DE ENVIAR E-MAIL:
//
// hoje só existe e-mail. Amanhã pode existir WhatsApp pela API oficial da
// Meta, que cobra por mensagem e exige modelos aprovados. Quando esse dia
// chegar, entra outra implementação de Canal aqui e o resto do sistema não
// muda uma linha — o webhook continua dizendo "avise que o pedido foi pago",
// sem saber por onde o aviso sai.
//
// Nada aqui pode derrubar o que chamou. Um provedor de e-mail fora do ar não
// pode impedir um pagamento de ser confirmado: o pedido é o fato, o aviso é a
// cortesia. Por isso todo erro é registrado e engolido pelo chamador.
package notificacao

import (
	"context"
	"fmt"
	"strings"

	"github.com/mirava/api/internal/dominio"
)

// Evento é o que aconteceu com o pedido. Um por aviso que a cliente recebe.
type Evento string

const (
	// PedidoPago sai do webhook do Mercado Pago, depois de assinatura válida
	// e valor conferido — nunca do redirect de volta ao site.
	PedidoPago Evento = "pedido_pago"
	// PagamentoFalhou cobre recusado, cancelado e expirado. É o aviso que
	// recupera venda: sem ele, quem errou o cartão simplesmente some.
	PagamentoFalhou Evento = "pagamento_falhou"
	// PecaComprada é quando o lote fecha e a peça é encomendada na Lilly.
	PecaComprada Evento = "peca_comprada"
	// PedidoEnviado leva o código de rastreio dos Correios.
	PedidoEnviado Evento = "pedido_enviado"
)

// Pedido é o mínimo que um aviso precisa saber. Deliberadamente não é o
// struct do banco: o pacote de notificação não deve depender do formato das
// tabelas, senão mexer no schema quebra o e-mail.
type Pedido struct {
	ID           string
	Numero       int
	Nome         string
	Email        string
	Total        dominio.Cents
	Rastreio     string
	PrazoTexto   string // "10 a 20 dias úteis"
	URLPedido    string // link para a cliente acompanhar
	URLWhatsApp  string // conversa já preenchida com o número do pedido
}

// Canal é por onde o aviso sai. E-mail hoje; WhatsApp oficial no futuro.
type Canal interface {
	Enviar(ctx context.Context, e Evento, p Pedido) error
	Nome() string
}

// Notificador dispara o mesmo evento em todos os canais configurados.
type Notificador struct {
	canais []Canal
	log    Logger
}

// Logger é o mínimo de slog que este pacote usa — declarado aqui para o
// pacote não importar log/slog só por causa de dois métodos.
type Logger interface {
	Error(msg string, args ...any)
	Info(msg string, args ...any)
}

func Novo(log Logger, canais ...Canal) *Notificador {
	ativos := make([]Canal, 0, len(canais))
	for _, c := range canais {
		if c != nil {
			ativos = append(ativos, c)
		}
	}
	return &Notificador{canais: ativos, log: log}
}

// Avisar tenta todos os canais e NUNCA devolve erro.
//
// Quem chama está no meio de confirmar um pagamento ou fechar um lote. Se o
// envio pudesse falhar para cima, um provedor de e-mail instável viraria
// pedido não confirmado — trocaríamos um problema pequeno (cliente sem aviso)
// por um enorme (cliente pagou e o sistema não registrou).
func (n *Notificador) Avisar(ctx context.Context, e Evento, p Pedido) {
	if n == nil || len(n.canais) == 0 {
		return
	}
	for _, c := range n.canais {
		if err := c.Enviar(ctx, e, p); err != nil {
			n.log.Error("falha ao notificar",
				"canal", c.Nome(), "evento", string(e), "pedido", p.Numero, "erro", err)
			continue
		}
		n.log.Info("aviso enviado", "canal", c.Nome(), "evento", string(e), "pedido", p.Numero)
	}
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

// Assunto e Corpo ficam aqui, e não no canal, porque a mensagem é a mesma
// independentemente de sair por e-mail ou por WhatsApp. O canal cuida só do
// transporte.

func Assunto(e Evento, p Pedido) string {
	switch e {
	case PedidoPago:
		return fmt.Sprintf("Pedido #%d confirmado · Mirava", p.Numero)
	case PagamentoFalhou:
		return fmt.Sprintf("Não conseguimos confirmar o pagamento do pedido #%d", p.Numero)
	case PecaComprada:
		return fmt.Sprintf("Sua peça do pedido #%d já foi encomendada", p.Numero)
	case PedidoEnviado:
		return fmt.Sprintf("Pedido #%d a caminho ✨", p.Numero)
	}
	return fmt.Sprintf("Novidade no seu pedido #%d", p.Numero)
}

func corpoTexto(e Evento, p Pedido) string {
	primeiroNome := strings.Fields(p.Nome)
	saudacao := "Oi"
	if len(primeiroNome) > 0 {
		saudacao = "Oi, " + primeiroNome[0]
	}

	var miolo string
	switch e {
	case PedidoPago:
		miolo = fmt.Sprintf(
			"Recebemos o pagamento do seu pedido #%d, no valor de %s.\n\n"+
				"Agora a gente encomenda sua peça na produção, confere quando "+
				"chega e reembala na embalagem Mirava antes de enviar. "+
				"A entrega leva %s a partir de agora.",
			p.Numero, p.Total.String(), p.PrazoTexto)
	case PagamentoFalhou:
		miolo = fmt.Sprintf(
			"O pagamento do pedido #%d não foi concluído, então nada foi cobrado.\n\n"+
				"Se ainda quiser a peça, é só refazer o pedido — dá pra tentar "+
				"com Pix, que costuma cair na hora.",
			p.Numero)
	case PecaComprada:
		miolo = fmt.Sprintf(
			"Boa notícia: a peça do seu pedido #%d já foi encomendada na produção.\n\n"+
				"Assim que ela chegar até nós, conferimos, embalamos e despachamos — "+
				"e você recebe o código de rastreio por aqui.",
			p.Numero)
	case PedidoEnviado:
		miolo = fmt.Sprintf("Seu pedido #%d foi postado nos Correios.", p.Numero)
		if p.Rastreio != "" {
			miolo += fmt.Sprintf(
				"\n\nCódigo de rastreio: %s\n"+
					"Acompanhe em https://rastreamento.correios.com.br/app/index.php\n\n"+
					"O código costuma levar algumas horas até aparecer no site dos Correios.",
				p.Rastreio)
		}
	}

	rodape := ""
	if p.URLPedido != "" {
		rodape += "\n\nAcompanhe seu pedido: " + p.URLPedido
	}
	if p.URLWhatsApp != "" {
		rodape += "\nQualquer dúvida, chama no WhatsApp: " + p.URLWhatsApp
	}

	return saudacao + "!\n\n" + miolo + rodape + "\n\nCom carinho,\nMirava Joias"
}
