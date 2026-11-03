package web

import (
	"encoding/json"
	"net/http"
	"strings"
)

// Favoritos da cliente e "acompanhar pedido" sem login.

func (s *Servidor) listFavorites(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
		return
	}
	products, err := s.db.FavoriteProducts(r.Context(), user.ID)
	if err != nil {
		s.log.Error("falha ao listar favoritos", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar seus favoritos"})
		return
	}
	responder(w, http.StatusOK, products)
}

func (s *Servidor) addFavorite(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "Entre na sua conta para salvar favoritos"})
		return
	}
	ok, err := s.db.AddFavorite(r.Context(), user.ID, r.PathValue("id"))
	if err != nil {
		s.log.Error("falha ao favoritar", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui salvar"})
		return
	}
	if !ok {
		responder(w, http.StatusNotFound, mapa{"error": "Peça não encontrada"})
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

func (s *Servidor) removeFavorite(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
		return
	}
	if err := s.db.RemoveFavorite(r.Context(), user.ID, r.PathValue("id")); err != nil {
		s.log.Error("falha ao remover favorito", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui remover"})
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

type rastrearRequest struct {
	Number int    `json:"number"`
	Email  string `json:"email"`
}

// trackOrder é o "Acompanhar pedido" da loja, sem login: número + e-mail da
// compra. Pedido inexistente e e-mail errado respondem igual, para a página
// não servir de confirmação de que um número existe.
func (s *Servidor) trackOrder(w http.ResponseWriter, r *http.Request) {
	var req rastrearRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&req); err != nil ||
		req.Number <= 0 || !strings.Contains(req.Email, "@") {
		responder(w, http.StatusBadRequest, mapa{"error": "Informe o número do pedido e o e-mail usado na compra"})
		return
	}
	o, err := s.db.OrderByNumberAndEmail(r.Context(), req.Number, req.Email)
	if err != nil {
		s.log.Error("falha ao rastrear pedido", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui buscar o pedido"})
		return
	}
	if o == nil {
		responder(w, http.StatusNotFound, mapa{"error": "Não encontramos um pedido com esse número e e-mail"})
		return
	}
	responder(w, http.StatusOK, o)
}
