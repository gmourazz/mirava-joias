package web

import (
	"encoding/json"
	"net/http"

	"github.com/mirava/api/internal/db"
)

// Dados da própria conta — sempre a partir do usuário do token, nunca de um
// id no corpo da requisição. É o mesmo motivo pelo que RLS existia: sem
// filtrar por dono, a cliente A leria ou apagaria dado da cliente B.

func (s *Servidor) updateProfile(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
		return
	}

	var p db.Profile
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&p); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Requisição inválida"})
		return
	}
	if p.Name == "" {
		responder(w, http.StatusBadRequest, mapa{"error": "Informe seu nome"})
		return
	}

	if err := s.db.UpdateProfile(r.Context(), user.ID, p); err != nil {
		s.log.Error("falha ao atualizar perfil", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui salvar"})
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

func (s *Servidor) listAddresses(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
		return
	}
	addresses, err := s.db.AddressesForUser(r.Context(), user.ID)
	if err != nil {
		s.log.Error("falha ao listar endereços", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar seus endereços"})
		return
	}
	responder(w, http.StatusOK, addresses)
}

func (s *Servidor) createAddress(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
		return
	}

	var a db.Address
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&a); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Requisição inválida"})
		return
	}
	if a.Recipient == "" || a.ZipCode == "" || a.Street == "" || a.Number == "" ||
		a.Neighborhood == "" || a.City == "" || a.State == "" {
		responder(w, http.StatusBadRequest, mapa{"error": "Preencha todos os campos obrigatórios"})
		return
	}

	id, err := s.db.CreateAddress(r.Context(), user.ID, a)
	if err != nil {
		s.log.Error("falha ao criar endereço", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui salvar o endereço"})
		return
	}
	responder(w, http.StatusCreated, mapa{"id": id})
}

func (s *Servidor) deleteAddress(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
		return
	}

	id := r.PathValue("id")
	ok, err := s.db.DeleteAddress(r.Context(), user.ID, id)
	if err != nil {
		s.log.Error("falha ao excluir endereço", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui excluir"})
		return
	}
	if !ok {
		responder(w, http.StatusNotFound, mapa{"error": "Endereço não encontrado"})
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}
