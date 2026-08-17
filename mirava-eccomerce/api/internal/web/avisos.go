package web

import (
	"context"
	"fmt"
	"net/url"

	"github.com/mirava/api/internal/db"
	"github.com/mirava/api/internal/dominio"
	"github.com/mirava/api/internal/notificacao"
)

// Ponte entre o mundo do banco e o pacote de notificação.
//
// O pacote notificacao não conhece as tabelas de propósito — é aqui que a
// tradução acontece, num lugar só. Assim mexer no schema não quebra o texto
// dos e-mails.

// avisar monta o Pedido de notificação a partir do id e dispara o evento.
//
// Nunca devolve erro: quem chama está confirmando pagamento ou despachando
// encomenda, e nenhuma dessas coisas pode falhar porque um e-mail não saiu.
func (s *Servidor) avisar(ctx context.Context, orderID string, ev notificacao.Evento) {
	if s.notif == nil {
		return
	}
	o, err := s.db.OrderForNotification(ctx, orderID)
	if err != nil || o == nil {
		if err != nil {
			s.log.Error("falha ao carregar pedido para aviso", "erro", err, "pedido_id", orderID)
		}
		return
	}
	s.notif.Avisar(ctx, ev, s.paraNotificacao(o))
}

func (s *Servidor) paraNotificacao(o *db.OrderNotification) notificacao.Pedido {
	rastreio := ""
	if o.TrackingCode != nil {
		rastreio = *o.TrackingCode
	}
	return notificacao.Pedido{
		ID:          o.ID,
		Numero:      o.Number,
		Nome:        o.Name,
		Email:       o.Email,
		Total:       o.Total,
		Rastreio:    rastreio,
		PrazoTexto:  prazoTexto(),
		URLPedido:   fmt.Sprintf("%s/pedido/%s", s.cfg.SiteURL, o.ID),
		URLWhatsApp: s.linkWhatsApp(o.Number),
	}
}

// prazoTexto formata o prazo prometido: "10 a 20 dias úteis". Os números vêm
// do domínio (EstimatedDeadline), não daqui — o texto do site e o do e-mail
// precisam dizer a mesma coisa.
func prazoTexto() string {
	min, max := dominio.EstimatedDeadline()
	return fmt.Sprintf("%d a %d dias úteis", min, max)
}

// linkWhatsApp monta o wa.me com a mensagem já escrita.
//
// É o substituto grátis do WhatsApp automático: a Meta cobra por mensagem que
// a LOJA inicia, mas responder é de graça nas 24h seguintes a uma mensagem da
// cliente. Deixando o texto pronto, o clique dela abre a janela gratuita — e
// a dona ainda recebe o número do pedido junto, sem precisar perguntar.
func (s *Servidor) linkWhatsApp(numero int) string {
	if s.cfg.WhatsApp == "" {
		return ""
	}
	texto := fmt.Sprintf("Oi! Queria falar sobre o meu pedido #%d", numero)
	return fmt.Sprintf("https://wa.me/%s?text=%s", s.cfg.WhatsApp, url.QueryEscape(texto))
}
