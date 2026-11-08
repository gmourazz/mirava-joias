package web

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/mirava/api/internal/db"
	"github.com/mirava/api/internal/dominio"
	"github.com/mirava/api/internal/notificacao"
)

// Cancelamento pela cliente e reembolso pelo painel (decisão 43). Os dois
// passam por encerrarPedido: primeiro o Mercado Pago devolve o dinheiro, e só
// com a resposta de sucesso o status muda. Se o estorno falhar, o pedido fica
// como estava.

var (
	errNaoPermitido  = errors.New("status não permite")
	errSemPagamento  = errors.New("pedido sem pagamento aprovado")
	errEstornoFalhou = errors.New("estorno recusado")
)

// prazoEstorno limita a espera pelo Mercado Pago com o pedido travado.
const prazoEstorno = 25 * time.Second

func (s *Servidor) encerrarPedido(ctx context.Context, orderID, userID, origem string, permitido func(dominio.Status) bool, destino func(dominio.Status) dominio.Status) (dominio.Status, error) {
	// A cliente fechar a aba não pode cortar um estorno no meio.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), prazoEstorno)
	defer cancel()

	return s.db.CloseOrder(ctx, orderID, userID, origem, func(st dominio.Status, pagamento string) (dominio.Status, error) {
		if !permitido(st) {
			return "", errNaoPermitido
		}
		to := destino(st)
		if pagamento == "" {
			if to == dominio.Refunded {
				return "", errSemPagamento
			}
			return to, nil
		}
		if _, err := s.mp.RefundPayment(ctx, pagamento, "reembolso-"+orderID); err != nil {
			s.log.Error("estorno falhou", "erro", err, "pedido_id", orderID)
			return "", fmt.Errorf("%w: %v", errEstornoFalhou, err)
		}
		return to, nil
	})
}

func (s *Servidor) responderEncerramento(w http.ResponseWriter, r *http.Request, orderID string, to dominio.Status, err error, naoPermitido string) {
	switch {
	case err == nil:
		s.log.Info("pedido encerrado", "pedido_id", orderID, "status", to)
		if to == dominio.Refunded {
			s.avisar(r.Context(), orderID, notificacao.PedidoEstornado)
		} else {
			s.avisar(r.Context(), orderID, notificacao.PedidoCancelado)
		}
		responder(w, http.StatusOK, mapa{"ok": true, "status": to})
	case errors.Is(err, db.ErrOrderNotFound):
		responder(w, http.StatusNotFound, mapa{"error": "Pedido não encontrado"})
	case errors.Is(err, errNaoPermitido):
		responder(w, http.StatusConflict, mapa{"error": naoPermitido})
	case errors.Is(err, errSemPagamento):
		responder(w, http.StatusConflict, mapa{"error": "Não encontramos um pagamento aprovado neste pedido. Fale com a gente."})
	case errors.Is(err, errEstornoFalhou):
		responder(w, http.StatusBadGateway, mapa{"error": "O Mercado Pago não fez o estorno agora. O pedido continua como estava: tente de novo em alguns minutos."})
	default:
		s.log.Error("falha ao encerrar pedido", "erro", err, "pedido_id", orderID)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui concluir agora. Tente de novo."})
	}
}

// cancelOrder: a cliente cancela o próprio pedido até ele ser despachado.
func (s *Servidor) cancelOrder(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
		return
	}
	id := r.PathValue("id")
	to, err := s.encerrarPedido(r.Context(), id, user.ID, "customer", dominio.CustomerCanCancel, dominio.CustomerCancelTarget)
	s.responderEncerramento(w, r, id, to, err, "Este pedido não pode mais ser cancelado.")
}

// adminRefund: a dona devolve o pagamento em qualquer etapa depois de pago.
func (s *Servidor) adminRefund(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	to, err := s.encerrarPedido(r.Context(), id, "", "admin", dominio.CanRefund,
		func(dominio.Status) dominio.Status { return dominio.Refunded })
	s.responderEncerramento(w, r, id, to, err, "Este pedido não pode ser reembolsado.")
}

// estornarPagamentoTardio devolve um pagamento que chegou depois do pedido
// cancelado. Se falhar, o alerta fica na linha do tempo para a dona resolver.
func (s *Servidor) estornarPagamentoTardio(ctx context.Context, orderID, pagamento string, numero int) {
	if _, err := s.mp.RefundPayment(ctx, pagamento, "reembolso-"+orderID); err != nil {
		s.log.Error("estorno de pagamento tardio falhou", "erro", err, "pedido", numero)
		_ = s.db.RegisterAlert(ctx, orderID, "ALERTA: pagamento chegou depois do cancelamento e o estorno automático falhou. Estorne pelo painel do Mercado Pago.")
		return
	}
	s.log.Info("pagamento tardio estornado", "pedido", numero)
	_ = s.db.RegisterAlert(ctx, orderID, "Pagamento chegou depois do cancelamento e foi estornado automaticamente.")
}
