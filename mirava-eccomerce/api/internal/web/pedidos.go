package web

import "net/http"

// Pedidos da própria cliente.
//
// O id do pedido vem da URL, mas o dono vem do TOKEN — nunca de um campo na
// requisição. É a consulta que filtra por user_id (ver db.OrderForUser); aqui
// só passamos adiante quem o token diz que é.

func (s *Servidor) listOrders(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
		return
	}

	orders, err := s.db.OrdersForUser(r.Context(), user.ID)
	if err != nil {
		s.log.Error("falha ao listar pedidos", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar seus pedidos"})
		return
	}
	responder(w, http.StatusOK, orders)
}

func (s *Servidor) orderByID(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
		return
	}

	order, err := s.db.OrderForUser(r.Context(), user.ID, r.PathValue("id"))
	if err != nil {
		s.log.Error("falha ao buscar pedido", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar o pedido"})
		return
	}
	// Pedido de outra pessoa responde igual a pedido inexistente. Distinguir
	// os dois casos confirmaria, para quem ficasse tentando ids, quais
	// existem de verdade.
	if order == nil {
		responder(w, http.StatusNotFound, mapa{"error": "Pedido não encontrado"})
		return
	}
	responder(w, http.StatusOK, order)
}
