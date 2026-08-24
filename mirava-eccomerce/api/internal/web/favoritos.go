package web

import (
	"errors"
	"net/http"

	"github.com/mirava/api/internal/db"
)

// Favoritos exigem login — a tabela `favorites` não aceita user_id nulo.
// Sem conta, a cliente vê o coração mas o clique manda pra tela de entrar
// (essa decisão fica no front, ver FavoritesContext).

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
		responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
		return
	}

	productID := r.PathValue("productId")
	if err := s.db.AddFavorite(r.Context(), user.ID, productID); err != nil {
		if errors.Is(err, db.ErrProductNotFound) {
			responder(w, http.StatusNotFound, mapa{"error": "Peça não encontrada"})
			return
		}
		s.log.Error("falha ao favoritar", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui favoritar essa peça"})
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

	productID := r.PathValue("productId")
	if err := s.db.RemoveFavorite(r.Context(), user.ID, productID); err != nil {
		s.log.Error("falha ao desfavoritar", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui desfavoritar essa peça"})
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}
