package web

import (
	"context"
	"errors"
	"net"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/mirava/api/internal/auth"
	"github.com/mirava/api/internal/db"
)

// Login do painel (decisão 46): por nome de usuário e senha, separado das
// contas da loja.

var reUsuarioPainel = regexp.MustCompile(`^[a-z0-9._-]{3,40}$`)

// Contra tentativa e erro: 5 senhas erradas para o mesmo usuário (ou do mesmo
// endereço) travam por 15 minutos. Fica na memória: reiniciar a API zera.
const (
	maxTentativasPainel = 5
	travaPainel         = 15 * time.Minute
)

type tentativas struct {
	mu    sync.Mutex
	falha map[string][]time.Time
}

var tentativasPainel = &tentativas{falha: map[string][]time.Time{}}

func (t *tentativas) travado(chaves ...string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	agora := time.Now()
	for _, k := range chaves {
		recentes := t.falha[k][:0]
		for _, em := range t.falha[k] {
			if agora.Sub(em) < travaPainel {
				recentes = append(recentes, em)
			}
		}
		t.falha[k] = recentes
		if len(recentes) >= maxTentativasPainel {
			return true
		}
	}
	return false
}

func (t *tentativas) errou(chaves ...string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	for _, k := range chaves {
		t.falha[k] = append(t.falha[k], time.Now())
	}
}

func (t *tentativas) acertou(chave string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.falha, chave)
}

func ipDe(r *http.Request) string {
	if f := r.Header.Get("X-Forwarded-For"); f != "" {
		return strings.TrimSpace(strings.Split(f, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// hashFalso: com usuário inexistente a resposta demora o mesmo que com senha
// errada, para não revelar quais usuários existem.
var hashFalso, _ = auth.HashPassword("senha-que-nao-existe-no-painel")

func (s *Servidor) adminLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if !decode(w, r, &req) {
		return
	}
	usuario := strings.ToLower(strings.TrimSpace(req.Username))
	chaveUsuario, chaveIP := "u:"+usuario, "ip:"+ipDe(r)
	if tentativasPainel.travado(chaveUsuario, chaveIP) {
		responder(w, http.StatusTooManyRequests, mapa{"error": "Muitas tentativas. Espere 15 minutos e tente de novo."})
		return
	}

	u, err := s.db.AdminUserByUsername(r.Context(), usuario)
	if err != nil {
		s.falha(w, err, "entrar no painel")
		return
	}
	hash := hashFalso
	if u != nil {
		hash = u.PasswordHash
	}
	if auth.CheckPassword(hash, req.Password) != nil || u == nil || !u.Active {
		tentativasPainel.errou(chaveUsuario, chaveIP)
		responder(w, http.StatusUnauthorized, mapa{"error": "Usuário ou senha incorretos"})
		return
	}
	tentativasPainel.acertou(chaveUsuario)

	token, err := s.auth.IssueAdminToken(u.ID)
	if err != nil {
		s.falha(w, err, "entrar no painel")
		return
	}
	s.db.TouchAdminLogin(r.Context(), u.ID)
	s.log.Info("entrada no painel", "usuario", u.Username)
	responder(w, http.StatusOK, mapa{"token": token, "name": u.Name, "username": u.Username, "role": u.Role})
}

type chaveAdmin struct{}

// adminAtual é quem está no painel nesta requisição (posto por requireAdmin).
func adminAtual(ctx context.Context) *db.AdminUser {
	u, _ := ctx.Value(chaveAdmin{}).(*db.AdminUser)
	return u
}

func (s *Servidor) adminTeamCreate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	if !decode(w, r, &req) {
		return
	}
	usuario := strings.ToLower(strings.TrimSpace(req.Username))
	nome := strings.TrimSpace(req.Name)
	switch {
	case !reUsuarioPainel.MatchString(usuario):
		responder(w, http.StatusBadRequest, mapa{"error": "Usuário com 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado"})
		return
	case nome == "":
		responder(w, http.StatusBadRequest, mapa{"error": "Informe o nome"})
		return
	case auth.WeakPassword(req.Password):
		responder(w, http.StatusBadRequest, mapa{"error": "A senha precisa ter pelo menos 8 caracteres"})
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		s.falha(w, err, "criar o acesso")
		return
	}
	_, err = s.db.CreateAdminUser(r.Context(), usuario, nome, hash, "dispatch")
	switch {
	case errors.Is(err, db.ErrDuplicate):
		responder(w, http.StatusConflict, mapa{"error": "Esse usuário já existe"})
	case err != nil:
		s.falha(w, err, "criar o acesso")
	default:
		responder(w, http.StatusOK, mapa{"ok": true})
	}
}
