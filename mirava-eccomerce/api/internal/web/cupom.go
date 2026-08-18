package web

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/mirava/api/internal/dominio"
)

// validateCoupon é só uma prévia para o resumo do carrinho — não cria pedido
// nem mexe em dinheiro de verdade. O desconto que vale é sempre o recalculado
// dentro de createPayment; esta rota existe só para a cliente ver o valor
// antes de ir pro pagamento.
type couponRequest struct {
	Code          string `json:"code"`
	SubtotalCents int64  `json:"subtotal_cents"`
}

func (s *Servidor) validateCoupon(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "Faça login para usar um cupom"})
		return
	}

	var req couponRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2<<10)).Decode(&req); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Requisição inválida"})
		return
	}

	code := strings.ToUpper(strings.TrimSpace(req.Code))
	if code != dominio.WelcomeCouponCode {
		responder(w, http.StatusOK, mapa{"valid": false, "error": "Cupom inválido"})
		return
	}

	eligible, err := s.db.WelcomeCouponEligible(ctx, user.ID)
	if err != nil {
		s.log.Error("falha ao checar cupom", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Erro ao checar o cupom"})
		return
	}
	if !eligible {
		responder(w, http.StatusOK, mapa{"valid": false, "error": "Esse cupom já foi usado nesta conta"})
		return
	}

	discount := dominio.WelcomeCouponDiscount(dominio.Cents(req.SubtotalCents))
	responder(w, http.StatusOK, mapa{"valid": true, "discount_cents": int64(discount)})
}
