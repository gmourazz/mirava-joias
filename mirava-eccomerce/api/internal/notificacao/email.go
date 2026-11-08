package notificacao

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"net/http"
	"strings"
	"time"
)

// Canal de e-mail via Resend.
//
// POR QUE RESEND E NÃO SMTP DIRETO: mandar e-mail por SMTP a partir de um
// servidor comum quase garante cair no spam — falta SPF, DKIM e reputação de
// IP. Um provedor cuida disso. O plano gratuito cobre com folga o volume de
// uma loja começando.
//
// POR QUE HTTP NA MÃO E NÃO O SDK: é uma requisição POST com JSON. Puxar uma
// dependência para isso, num serviço que mexe com dinheiro, é aumentar a
// superfície de risco sem ganhar nada.

const resendAPI = "https://api.resend.com/emails"

type Email struct {
	apiKey    string
	remetente string
	http      *http.Client
}

// NovoEmail devolve nil quando não há chave configurada.
//
// Devolver nil em vez de erro é proposital: sem chave, a loja continua
// vendendo, só não avisa. `Novo` descarta canais nulos, então o sistema
// funciona igual em desenvolvimento, onde ninguém quer mandar e-mail de
// verdade a cada teste de checkout.
func NovoEmail(apiKey, remetente string) *Email {
	if apiKey == "" || remetente == "" {
		return nil
	}
	return &Email{
		apiKey:    apiKey,
		remetente: remetente,
		http:      &http.Client{Timeout: 15 * time.Second},
	}
}

func (e *Email) Nome() string { return "email" }

func (e *Email) Enviar(ctx context.Context, ev Evento, p Pedido) error {
	if p.Email == "" {
		return fmt.Errorf("pedido %d sem e-mail", p.Numero)
	}

	texto := corpoTexto(ev, p)
	body, _ := json.Marshal(map[string]any{
		"from":    e.remetente,
		"to":      []string{p.Email},
		"subject": Assunto(ev, p),
		"text":    texto,
		"html":    corpoHTML(ev, p, texto),
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, resendAPI, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+e.apiKey)
	req.Header.Set("Content-Type", "application/json")

	res, err := e.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode >= 300 {
		var msg bytes.Buffer
		msg.ReadFrom(res.Body)
		return fmt.Errorf("resend recusou (%d): %s", res.StatusCode, msg.String())
	}
	return nil
}

// corpoHTML embrulha o mesmo texto numa moldura simples com a paleta da
// marca. Estilo vai inline: cliente de e-mail ignora <style> no topo, e
// Gmail remove folha de estilo externa.
func corpoHTML(ev Evento, p Pedido, texto string) string {
	var b strings.Builder
	b.WriteString(`<div style="font-family:Georgia,serif;background:#F4F8F8;padding:32px 16px">`)
	b.WriteString(`<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">`)
	b.WriteString(`<p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:3px;color:#2A8C88;text-transform:uppercase">Mirava</p>`)
	b.WriteString(`<h1 style="margin:0 0 20px;font-size:22px;font-weight:normal;color:#0B4A4D">` +
		html.EscapeString(tituloHTML(ev)) + `</h1>`)

	// O texto puro já está pronto e revisado; aqui ele só é escapado e
	// quebrado em parágrafos. Manter uma redação só evita que a versão HTML e
	// a de texto digam coisas diferentes com o tempo.
	for _, par := range strings.Split(texto, "\n\n") {
		par = strings.TrimSpace(par)
		if par == "" {
			continue
		}
		b.WriteString(`<p style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#3E5556">` +
			strings.ReplaceAll(html.EscapeString(par), "\n", "<br>") + `</p>`)
	}

	link, rotulo := p.URLPedido, "Acompanhar pedido"
	if p.URLAcao != "" {
		link, rotulo = p.URLAcao, p.TextoAcao
	}
	if link != "" {
		b.WriteString(`<p style="margin:24px 0 0"><a href="` + html.EscapeString(link) +
			`" style="display:inline-block;background:#0F6E73;color:#ffffff;text-decoration:none;` +
			`padding:13px 28px;border-radius:999px;font-family:Helvetica,Arial,sans-serif;font-size:13px;` +
			`font-weight:bold;letter-spacing:1px">` + html.EscapeString(rotulo) + `</a></p>`)
	}

	b.WriteString(`</div></div>`)
	return b.String()
}

func tituloHTML(ev Evento) string {
	switch ev {
	case PedidoPago:
		return "Pedido confirmado"
	case PagamentoFalhou:
		return "O pagamento não foi concluído"
	case DonaPedidoPago:
		return "Novo pedido pago"
	case DonaPedidoCancelado:
		return "Pedido cancelado pela cliente"
	case PedidoCancelado:
		return "Pedido cancelado"
	case PedidoEstornado:
		return "Pedido cancelado e valor estornado"
	case PecaComprada:
		return "Sua peça já foi encomendada"
	case PedidoEnviado:
		return "Seu pedido está a caminho"
	case PagamentoPendente:
		return "Seu pedido está te esperando"
	case CarrinhoAbandonado:
		return "Suas peças ainda estão na sacola"
	case PedirAvaliacao:
		return "O que achou da sua peça?"
	case VoltouAoEstoque:
		return "A peça que você queria voltou"
	case TrocaAtualizada:
		return "Sua troca andou"
	case RecuperarSenha:
		return "Crie uma senha nova"
	case CupomEnviado:
		return "Um presente pra você"
	case BoasVindas:
		return "Bem-vinda à Mirava"
	case TesteAutomacao:
		return "E-mail de teste"
	}
	return "Novidade no seu pedido"
}
