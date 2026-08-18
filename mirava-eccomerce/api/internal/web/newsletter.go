package web

import (
	"encoding/json"
	"net/http"
	"strings"
)

// O banner "Bem-vinda" da home captura só o e-mail. A conta em si (que é o
// que de fato libera o cupom no checkout) a pessoa cria depois, em /conta —
// esta rota só guarda o contato e dispara o e-mail com o código.

type newsletterRequest struct {
	Email string `json:"email"`
}

func (s *Servidor) subscribeNewsletter(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req newsletterRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2<<10)).Decode(&req); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Requisição inválida"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if !reEmail.MatchString(email) {
		responder(w, http.StatusBadRequest, mapa{"error": "E-mail inválido"})
		return
	}

	if err := s.db.AddNewsletterSubscriber(ctx, email); err != nil {
		s.log.Error("falha ao gravar inscrição na newsletter", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não foi possível concluir. Tente de novo."})
		return
	}

	// E-mail é cortesia, não o fato: se o Resend estiver fora do ar ou sem
	// chave configurada (normal em desenvolvimento), a inscrição já foi
	// gravada e a resposta continua sendo sucesso.
	if s.emailCupom != nil {
		if err := s.emailCupom.EnviarCupom(ctx, email); err != nil {
			s.log.Error("falha ao enviar e-mail de cupom", "erro", err, "email", email)
		}
	} else {
		s.log.Warn("e-mail não configurado — cupom não foi enviado, só a inscrição foi gravada", "email", email)
	}

	responder(w, http.StatusOK, mapa{"ok": true})
}
