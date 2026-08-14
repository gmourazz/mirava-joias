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

type notificacaoMP struct {
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
	if !s.cfg.PagamentoPronto {
		s.log.Error("webhook recebido sem credenciais do Mercado Pago configuradas")
		responder(w, http.StatusServiceUnavailable, mapa{"erro": "não configurado"})
		return
	}

	corpo, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		responder(w, http.StatusOK, mapa{"ok": true})
		return
	}

	var n notificacaoMP
	if err := json.Unmarshal(corpo, &n); err != nil {
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
	if err := s.mp.AssinaturaValida(r.Header, dataID, time.Now()); err != nil {
		s.log.Error("assinatura de webhook inválida", "erro", err, "data_id", dataID)
		responder(w, http.StatusUnauthorized, mapa{"erro": "assinatura inválida"})
		return
	}

	// --- Defesa 2: a verdade vem da API, não do corpo recebido ---
	pag, err := s.mp.ConsultarPagamento(ctx, dataID)
	if err != nil {
		s.log.Error("falha ao consultar pagamento", "erro", err, "data_id", dataID)
		responder(w, http.StatusInternalServerError, mapa{"erro": "consulta falhou"})
		return
	}
	if pag.ExternalReference == "" {
		responder(w, http.StatusOK, mapa{"ok": true, "nota": "sem external_reference"})
		return
	}

	pedido, err := s.db.PedidoPorID(ctx, pag.ExternalReference)
	if err != nil {
		s.log.Error("falha ao buscar pedido", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"erro": "banco indisponível"})
		return
	}
	if pedido == nil {
		s.log.Error("pedido do webhook não existe", "pedido_id", pag.ExternalReference)
		responder(w, http.StatusOK, mapa{"ok": true, "nota": "pedido inexistente"})
		return
	}

	valor := dominio.DeReais(pag.TransactionAmount)
	liquido := dominio.DeReais(pag.TransactionDetails.NetReceivedAmount)

	// --- Defesa 4: idempotência ---
	err = s.db.RegistrarPagamento(ctx, db.RegistroPagamento{
		PedidoID: pedido.ID, MPPaymentID: fmt.Sprintf("%d", pag.ID),
		Status: pag.Status, Metodo: pag.PaymentMethodID, Parcelas: pag.Installments,
		Valor: valor, Taxa: dominio.Centavos(pag.TaxaCentavos()), Liquido: liquido,
		Payload: corpo,
	})
	if errors.Is(err, db.ErrDuplicado) {
		responder(w, http.StatusOK, mapa{"ok": true, "nota": "já processado"})
		return
	}
	if err != nil {
		s.log.Error("falha ao registrar pagamento", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"erro": "falha ao gravar"})
		return
	}

	// --- Defesa 3: o valor bate com o pedido? ---
	if pag.Status == "approved" && valor < pedido.Total {
		s.log.Error("valor pago menor que o pedido",
			"pedido", pedido.Numero, "esperado", pedido.Total, "recebido", valor)
		_ = s.db.RegistrarAlerta(ctx, pedido.ID,
			fmt.Sprintf("ALERTA: pago %v para um pedido de %v", valor, pedido.Total))
		responder(w, http.StatusOK, mapa{"ok": true, "nota": "valor divergente, revisar"})
		return
	}

	switch {
	case pag.Status == "approved":
		mudou, err := s.db.MarcarPago(ctx, pedido.ID)
		if err != nil {
			s.log.Error("falha ao marcar pago", "erro", err)
			responder(w, http.StatusInternalServerError, mapa{"erro": "falha ao atualizar"})
			return
		}
		if mudou {
			s.log.Info("pedido pago", "numero", pedido.Numero, "valor", valor.String())
		}

	case pag.Status == "refunded" || pag.Status == "charged_back":
		if dominio.PodeIr(pedido.Status, dominio.Estornado) {
			_ = s.db.AtualizarStatus(ctx, pedido.ID, dominio.Estornado)
		}

	case pag.Status == "cancelled" && pedido.Status == dominio.AguardandoPagamento:
		_ = s.db.AtualizarStatus(ctx, pedido.ID, dominio.Cancelado)
	}

	responder(w, http.StatusOK, mapa{"ok": true})
}
