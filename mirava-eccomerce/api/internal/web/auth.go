package web

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"

	"github.com/mirava/api/internal/auth"
	"github.com/mirava/api/internal/db"
)

// Login e cadastro próprios — antes disso era o Supabase Auth.
//
// A REGRA CENTRAL: nunca dizer "e-mail já cadastrado" numa mensagem de erro
// pública. Isso permite que qualquer pessoa descubra quem tem conta na loja
// testando e-mails, um por um (enumeração de usuário). A resposta de
// cadastro com e-mail repetido é IDÊNTICA à de sucesso — só o e-mail de
// verdade recebe algo. Aqui, como não há e-mail de verificação ainda, a
// mensagem de erro fica genérica em vez de confirmar.

var reEmail = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

type signupRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Servidor) signup(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req signupRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&req); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Requisição inválida"})
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Name = strings.TrimSpace(req.Name)

	if !reEmail.MatchString(req.Email) {
		responder(w, http.StatusBadRequest, mapa{"error": "E-mail inválido"})
		return
	}
	if auth.WeakPassword(req.Password) {
		responder(w, http.StatusBadRequest, mapa{"error": "Senha precisa ter pelo menos 8 caracteres"})
		return
	}
	if req.Name == "" {
		responder(w, http.StatusBadRequest, mapa{"error": "Informe seu nome"})
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		s.log.Error("falha ao gerar hash de senha", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não foi possível criar a conta"})
		return
	}

	userID, err := s.db.CreateUser(ctx, db.NewUser{
		Name: req.Name, Email: req.Email, PasswordHash: hash,
	})
	if err != nil {
		if err == db.ErrDuplicate {
			// Mensagem genérica de propósito — ver comentário no topo do arquivo.
			responder(w, http.StatusBadRequest, mapa{
				"error": "Não foi possível criar a conta com esses dados. Tente entrar, ou use outro e-mail."})
			return
		}
		s.log.Error("falha ao criar usuário", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não foi possível criar a conta"})
		return
	}

	token, err := s.auth.IssueToken(userID, req.Email)
	if err != nil {
		s.log.Error("falha ao emitir token", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Conta criada, mas o login falhou. Tente entrar."})
		return
	}

	responder(w, http.StatusCreated, mapa{"token": token, "name": req.Name, "email": req.Email})
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Servidor) login(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req loginRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&req); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Requisição inválida"})
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	user, passwordHash, err := s.db.UserByEmail(ctx, req.Email)
	if err != nil {
		// Mesma mensagem para "não existe" e "senha errada" — não vazar qual
		// dos dois estava certo é o que impede o ataque de enumeração.
		responder(w, http.StatusUnauthorized, mapa{"error": "E-mail ou senha incorretos"})
		return
	}
	if err := auth.CheckPassword(passwordHash, req.Password); err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "E-mail ou senha incorretos"})
		return
	}

	token, err := s.auth.IssueToken(user.ID, user.Email)
	if err != nil {
		s.log.Error("falha ao emitir token", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não foi possível entrar. Tente de novo."})
		return
	}

	responder(w, http.StatusOK, mapa{"token": token, "name": user.Name, "email": user.Email})
}

// eu devolve os dados de quem está logada — o front usa isso pra saber se a
// sessão salva ainda é válida, sem precisar guardar nome/e-mail em duplicado.
func (s *Servidor) me(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
		return
	}
	profile, err := s.db.GetProfile(r.Context(), user.ID)
	if err != nil {
		responder(w, http.StatusInternalServerError, mapa{"error": "falha ao buscar perfil"})
		return
	}
	// adminRole vai junto pro front saber se mostra o link do painel (e qual
	// nível) — a proteção de verdade é o middleware em cima das rotas
	// /admin/*, isto aqui é só pra não oferecer um link que vai dar 403.
	adminRole, err := s.db.AdminRole(r.Context(), user.ID)
	if err != nil {
		s.log.Error("falha ao checar admin", "erro", err)
	}
	// Telefone e CPF vão junto para o checkout já vir preenchido. São dados da
	// própria cliente, lidos a partir do usuário do token — nunca de um id no
	// corpo da requisição.
	responder(w, http.StatusOK, mapa{
		"id": user.ID, "email": user.Email, "name": profile.Name,
		"phone": profile.Phone, "cpf": profile.CPF,
		"is_admin": adminRole != "", "admin_role": nullIfEmpty(adminRole),
	})
}
