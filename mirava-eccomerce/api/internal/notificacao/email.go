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

	"github.com/mirava/api/internal/dominio"
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
	apiKey     string
	remetente  string
	http       *http.Client
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
	return e.send(ctx, p.Email, Assunto(ev, p), texto, corpoHTML(ev, p, texto))
}

// EnviarCupom manda o e-mail de boas-vindas com o código do cupom de
// primeira compra, capturado pelo formulário da home. Não usa Enviar/Pedido
// porque não existe pedido nenhum por trás ainda — é só a promessa da
// promoção, antes de a pessoa criar conta.
func (e *Email) EnviarCupom(ctx context.Context, destinatario string) error {
	texto := fmt.Sprintf(
		"Oi!\n\nQue bom te ver por aqui. Seu cupom de boas-vindas já está liberado:\n\n"+
			"%s\n\n10%% de desconto na sua primeira encomenda. É só criar sua conta, "+
			"montar sua sacola e digitar o código na hora de fechar o pedido.\n\n"+
			"Com carinho,\nMirava Joias", dominio.WelcomeCouponCode)

	return e.send(ctx, destinatario, "Seu cupom de 10% de boas-vindas · Mirava",
		texto, corpoCupomHTML(texto))
}

// send é o transporte HTTP compartilhado por Enviar e EnviarCupom — a
// diferença entre os dois é só o conteúdo da mensagem, nunca como ela sai.
func (e *Email) send(ctx context.Context, destinatario, assunto, texto, htmlCorpo string) error {
	body, _ := json.Marshal(map[string]any{
		"from":    e.remetente,
		"to":      []string{destinatario},
		"subject": assunto,
		"text":    texto,
		"html":    htmlCorpo,
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
	b.WriteString(`<div style="font-family:Georgia,serif;background:#fff7fb;padding:32px 16px">`)
	b.WriteString(`<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">`)
	b.WriteString(`<p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:3px;color:#b49aa6;text-transform:uppercase">Mirava</p>`)
	b.WriteString(`<h1 style="margin:0 0 20px;font-size:22px;font-weight:normal;color:#8e3b6b">` +
		html.EscapeString(tituloHTML(ev)) + `</h1>`)

	// O texto puro já está pronto e revisado; aqui ele só é escapado e
	// quebrado em parágrafos. Manter uma redação só evita que a versão HTML e
	// a de texto digam coisas diferentes com o tempo.
	for _, par := range strings.Split(texto, "\n\n") {
		par = strings.TrimSpace(par)
		if par == "" {
			continue
		}
		b.WriteString(`<p style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#6e5a64">` +
			strings.ReplaceAll(html.EscapeString(par), "\n", "<br>") + `</p>`)
	}

	if p.URLPedido != "" {
		b.WriteString(`<p style="margin:24px 0 0"><a href="` + html.EscapeString(p.URLPedido) +
			`" style="display:inline-block;background:#d46a9f;color:#ffffff;text-decoration:none;` +
			`padding:13px 28px;border-radius:999px;font-family:Georgia,serif;font-size:13px;` +
			`letter-spacing:2px;text-transform:uppercase">Acompanhar pedido</a></p>`)
	}

	b.WriteString(`</div></div>`)
	return b.String()
}

// corpoCupomHTML segue a mesma moldura visual de corpoHTML, mas sem Evento
// nem Pedido — o e-mail de boas-vindas sai antes de existir pedido.
func corpoCupomHTML(texto string) string {
	var b strings.Builder
	b.WriteString(`<div style="font-family:Georgia,serif;background:#fff7fb;padding:32px 16px">`)
	b.WriteString(`<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">`)
	b.WriteString(`<p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:3px;color:#b49aa6;text-transform:uppercase">Mirava</p>`)
	b.WriteString(`<h1 style="margin:0 0 20px;font-size:22px;font-weight:normal;color:#8e3b6b">Bem-vinda à Mirava</h1>`)

	for _, par := range strings.Split(texto, "\n\n") {
		par = strings.TrimSpace(par)
		if par == "" {
			continue
		}
		b.WriteString(`<p style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#6e5a64">` +
			strings.ReplaceAll(html.EscapeString(par), "\n", "<br>") + `</p>`)
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
	case PecaComprada:
		return "Sua peça já foi encomendada"
	case PedidoEnviado:
		return "Seu pedido está a caminho"
	}
	return "Novidade no seu pedido"
}
