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
	s.registrarAviso(ctx, orderID, ev)
}

// avisarDona manda o aviso para o e-mail da loja (Configurações → Dados da
// loja). Não entra na lista de avisos da cliente. `etapa` e `extra` só servem
// ao cancelamento.
func (s *Servidor) avisarDona(ctx context.Context, orderID string, ev notificacao.Evento, etapa, extra string) {
	if s.notif == nil {
		return
	}
	cfg, err := s.db.Settings(ctx)
	if err != nil || cfg.StoreEmail == "" {
		return
	}
	o, err := s.db.OrderForNotification(ctx, orderID)
	if err != nil || o == nil {
		return
	}
	p := s.paraNotificacao(o)
	p.Email = cfg.StoreEmail
	p.Etapa = etapa
	p.Produto = extra
	p.URLAcao = s.cfg.SiteURL + "/admin/pedidos"
	p.TextoAcao = "Abrir no painel"
	s.notif.Avisar(ctx, ev, p)
}

// registrarAviso guarda que o aviso saiu (lista "Avisos para a cliente" no
// drawer do pedido). Sem e-mail configurado, nada saiu — nada é registrado.
func (s *Servidor) registrarAviso(ctx context.Context, orderID string, ev notificacao.Evento) {
	if orderID != "" && s.notif.Ativo() {
		s.db.LogOrderNotice(ctx, orderID, string(ev))
	}
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

// prazoTexto formata o prazo prometido: "até 20 dias úteis" (decisão 22). O
// número vem do domínio (PromisedBusinessDays), não daqui — o texto do site e
// o do e-mail precisam dizer a mesma coisa.
func prazoTexto() string {
	return fmt.Sprintf("até %d dias úteis", dominio.PromisedBusinessDays)
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
