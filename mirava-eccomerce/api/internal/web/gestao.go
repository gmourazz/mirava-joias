package web

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"

	"github.com/mirava/api/internal/dominio"
	"github.com/mirava/api/internal/notificacao"
)

// Despacho do pedido — a única mudança de status que depende de uma
// informação que só a dona tem (o código de rastreio dos Correios) e que
// dispara aviso à cliente. Fica numa rota própria do painel
// (POST /admin/pedidos/{id}/despachar, protegida por requireAdmin); as outras
// transições manuais estão em admin.go.

// Formato dos Correios: 2 letras + 9 dígitos + 2 letras (ex.: AA123456789BR).
var reRastreio = regexp.MustCompile(`^[A-Z]{2}[0-9]{9}[A-Z]{2}$`)

type despacharRequest struct {
	TrackingCode string `json:"tracking_code"`
}

func (s *Servidor) shipOrder(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	orderID := r.PathValue("id")

	var req despacharRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&req); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Requisição inválida"})
		return
	}

	code := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(req.TrackingCode), " ", ""))
	if !reRastreio.MatchString(code) {
		// Validar aqui evita o pior caso: e-mail enviado com código torto, a
		// cliente tentando rastrear e não achando nada. Melhor recusar agora.
		responder(w, http.StatusBadRequest, mapa{
			"error": "Código de rastreio fora do formato dos Correios (ex.: AA123456789BR)"})
		return
	}

	order, err := s.db.OrderForNotification(ctx, orderID)
	if err != nil {
		s.log.Error("falha ao buscar pedido para despacho", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Erro ao buscar o pedido"})
		return
	}
	if order == nil {
		responder(w, http.StatusNotFound, mapa{"error": "Pedido não encontrado"})
		return
	}
	if order.Status == dominio.Shipped {
		// Repetir o despacho não pode reenviar o aviso: a cliente receberia o
		// mesmo "seu pedido está a caminho" duas vezes.
		responder(w, http.StatusOK, mapa{"ok": true, "nota": "pedido já estava postado"})
		return
	}
	if !dominio.CanGo(order.Status, dominio.Shipped) {
		responder(w, http.StatusConflict, mapa{
			"error": "Este pedido não está pronto para ser postado (status atual: " +
				string(order.Status) + ")"})
		return
	}

	if err := s.db.MarkShipped(ctx, orderID, code); err != nil {
		s.log.Error("falha ao marcar como postado", "erro", err, "pedido", order.Number)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui salvar"})
		return
	}

	s.log.Info("pedido postado", "numero", order.Number, "rastreio", code)
	s.avisar(ctx, orderID, notificacao.PedidoEnviado)

	responder(w, http.StatusOK, mapa{"ok": true, "tracking_code": code})
}
