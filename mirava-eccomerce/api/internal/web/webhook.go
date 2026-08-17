package web

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/mirava/api/internal/db"
	"github.com/mirava/api/internal/dominio"
	"github.com/mirava/api/internal/notificacao"
)

// ESTE ARQUIVO É A FONTE DA VERDADE DO PAGAMENTO.
//
// O redirect que traz a cliente de volta ao site não confirma nada — qualquer
// pessoa digita aquela URL. Só o que chega aqui, com assinatura válida e
// confirmado por consulta à API, vira pedido pago.
//
// Quatro defesas, nesta ordem:
//   1. assinatura x-signature (HMAC-SHA256) válida e dentro da janela de tempo
//   2. status reconsultado na API do MP pelo ID — o corpo recebido pode mentir
//   3. valor conferido contra o total do pedido
//   4. unique(mp_payment_id) no banco — webhook repetido não duplica nada
//
// Devolve 200 nos casos ignorados de propósito: status de erro faz o Mercado
// Pago reenviar em loop por horas. Só devolve 500 quando o erro é nosso e
// vale a pena receber de novo.

type mpNotification struct {
	Type   string `json:"type"`
	Action string `json:"action"`
	Data   struct {
		ID json.RawMessage `json:"id"`
	} `json:"data"`
}

func (s *Servidor) webhookMP(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Sem segredo configurado não há como validar assinatura. Recusar é a
	// única resposta segura: aceitar seria confiar em qualquer um que
	// descobrisse a URL.
	if !s.cfg.PaymentReady {
		s.log.Error("webhook recebido sem credenciais do Mercado Pago configuradas")
		responder(w, http.StatusServiceUnavailable, mapa{"error": "não configurado"})
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		responder(w, http.StatusOK, mapa{"ok": true})
		return
	}

	var n mpNotification
	if err := json.Unmarshal(body, &n); err != nil {
		responder(w, http.StatusOK, mapa{"ok": true, "nota": "corpo ilegível"})
		return
	}

	// data.id às vezes vem string, às vezes número.
	dataID := ""
	if len(n.Data.ID) > 0 {
		if err := json.Unmarshal(n.Data.ID, &dataID); err != nil {
			var num int64
			if err := json.Unmarshal(n.Data.ID, &num); err == nil {
				dataID = fmt.Sprintf("%d", num)
			}
		}
	}
	if dataID == "" {
		responder(w, http.StatusOK, mapa{"ok": true, "nota": "sem data.id"})
		return
	}
	if n.Type != "" && n.Type != "payment" {
		responder(w, http.StatusOK, mapa{"ok": true, "nota": "tipo ignorado: " + n.Type})
		return
	}

	// --- Defesa 1: assinatura ---
	if err := s.mp.ValidSignature(r.Header, dataID, time.Now()); err != nil {
		s.log.Error("assinatura de webhook inválida", "erro", err, "data_id", dataID)
		responder(w, http.StatusUnauthorized, mapa{"error": "assinatura inválida"})
		return
	}

	// --- Defesa 2: a verdade vem da API, não do corpo recebido ---
	payment, err := s.mp.GetPayment(ctx, dataID)
	if err != nil {
		s.log.Error("falha ao consultar pagamento", "erro", err, "data_id", dataID)
		responder(w, http.StatusInternalServerError, mapa{"error": "consulta falhou"})
		return
	}
	if payment.ExternalReference == "" {
		responder(w, http.StatusOK, mapa{"ok": true, "nota": "sem external_reference"})
		return
	}

	order, err := s.db.OrderByID(ctx, payment.ExternalReference)
	if err != nil {
		s.log.Error("falha ao buscar pedido", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "banco indisponível"})
		return
	}
	if order == nil {
		s.log.Error("pedido do webhook não existe", "pedido_id", payment.ExternalReference)
		responder(w, http.StatusOK, mapa{"ok": true, "nota": "pedido inexistente"})
		return
	}

	amount := dominio.FromReais(payment.TransactionAmount)
	net := dominio.FromReais(payment.TransactionDetails.NetReceivedAmount)

	// --- Defesa 4: idempotência ---
	err = s.db.RegisterPayment(ctx, db.PaymentRecord{
		OrderID: order.ID, MPPaymentID: fmt.Sprintf("%d", payment.ID),
		Status: payment.Status, Method: payment.PaymentMethodID, Installments: payment.Installments,
		Amount: amount, Fee: dominio.Cents(payment.FeeCents()), Net: net,
		Payload: body,
	})
	if errors.Is(err, db.ErrDuplicate) {
		responder(w, http.StatusOK, mapa{"ok": true, "nota": "já processado"})
		return
	}
	if err != nil {
		s.log.Error("falha ao registrar pagamento", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "falha ao gravar"})
		return
	}

	// --- Defesa 3: o valor bate com o pedido? ---
	if payment.Status == "approved" && amount < order.Total {
		s.log.Error("valor pago menor que o pedido",
			"pedido", order.Number, "esperado", order.Total, "recebido", amount)
		_ = s.db.RegisterAlert(ctx, order.ID,
			fmt.Sprintf("ALERTA: pago %v para um pedido de %v", amount, order.Total))
		responder(w, http.StatusOK, mapa{"ok": true, "nota": "valor divergente, revisar"})
		return
	}

	switch {
	case payment.Status == "approved":
		changed, err := s.db.MarkPaid(ctx, order.ID)
		if err != nil {
			s.log.Error("falha ao marcar pago", "erro", err)
			responder(w, http.StatusInternalServerError, mapa{"error": "falha ao atualizar"})
			return
		}
		if changed {
			s.log.Info("pedido pago", "numero", order.Number, "valor", amount.String())
			// Só avisa quando a transição realmente aconteceu. O Mercado Pago
			// reenvia webhook do mesmo pagamento; sem esse "changed" a cliente
			// receberia o mesmo e-mail de confirmação várias vezes.
			s.avisar(ctx, order.ID, notificacao.PedidoPago)
		}

	case payment.Status == "refunded" || payment.Status == "charged_back":
		if dominio.CanGo(order.Status, dominio.Refunded) {
			_ = s.db.UpdateStatus(ctx, order.ID, dominio.Refunded)
		}

	case payment.Status == "cancelled" && order.Status == dominio.AwaitingPayment:
		_ = s.db.UpdateStatus(ctx, order.ID, dominio.Cancelled)
		s.avisar(ctx, order.ID, notificacao.PagamentoFalhou)

	// Recusado não muda o status: o pedido continua aguardando pagamento e a
	// cliente ainda pode tentar de novo. Mas ela precisa saber que não passou,
	// senão fica esperando uma peça que nunca foi paga.
	case payment.Status == "rejected" && order.Status == dominio.AwaitingPayment:
		s.avisar(ctx, order.ID, notificacao.PagamentoFalhou)
	}

	responder(w, http.StatusOK, mapa{"ok": true})
}
