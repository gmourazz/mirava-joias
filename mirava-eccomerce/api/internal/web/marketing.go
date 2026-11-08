package web

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mirava/api/internal/db"
	"github.com/mirava/api/internal/dominio"
	"github.com/mirava/api/internal/notificacao"
)

// Avaliações, avise-me, trocas, vitrine, avisos, sacola salva e automações
// (decisão 31). Rotas de cliente sempre a partir do usuário do token; rotas
// /admin/* atrás do requireAdmin.

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(v); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Requisição inválida"})
		return false
	}
	return true
}

func (s *Servidor) falha(w http.ResponseWriter, err error, oQue string) {
	s.log.Error("falha: "+oQue, "erro", err)
	responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui " + oQue})
}

// ---------------------------------------------------------------------------
// Avaliações
// ---------------------------------------------------------------------------

func (s *Servidor) productReviews(w http.ResponseWriter, r *http.Request) {
	list, avg, count, err := s.db.ProductReviews(r.Context(), r.PathValue("slug"))
	if err != nil {
		s.falha(w, err, "carregar as avaliações")
		return
	}
	responder(w, http.StatusOK, mapa{"reviews": list, "average": avg, "count": count, "recommend_pct": db.RecommendShare(list)})
}

func (s *Servidor) reviewables(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
		return
	}
	list, err := s.db.Reviewables(r.Context(), user.ID)
	if err != nil {
		s.falha(w, err, "carregar as peças para avaliar")
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) createReview(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "Entre na sua conta para avaliar"})
		return
	}
	var req struct {
		ProductID string `json:"product_id"`
		Rating    int    `json:"rating"`
		Text      string `json:"text"`
	}
	if !decode(w, r, &req) {
		return
	}
	text := strings.TrimSpace(req.Text)
	if req.Rating < 1 || req.Rating > 5 || utf8.RuneCountInString(text) > 1000 {
		responder(w, http.StatusBadRequest, mapa{"error": "Dê uma nota de 1 a 5 e escreva até 1000 caracteres"})
		return
	}
	err = s.db.CreateReview(r.Context(), user.ID, req.ProductID, req.Rating, text)
	switch {
	case errors.Is(err, db.ErrNotAllowed):
		responder(w, http.StatusForbidden, mapa{"error": "Só dá para avaliar peças que você já recebeu"})
	case errors.Is(err, db.ErrDuplicate):
		responder(w, http.StatusConflict, mapa{"error": "Você já avaliou esta peça"})
	case err != nil:
		s.falha(w, err, "salvar a avaliação")
	default:
		responder(w, http.StatusOK, mapa{"ok": true})
	}
}

func (s *Servidor) adminReviews(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.AdminReviews(r.Context(), r.URL.Query().Get("status"))
	if err != nil {
		s.falha(w, err, "carregar as avaliações")
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) adminDecideReview(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Status string `json:"status"`
	}
	if !decode(w, r, &req) {
		return
	}
	if req.Status != "approved" && req.Status != "rejected" && req.Status != "pending" {
		responder(w, http.StatusBadRequest, mapa{"error": "Status inválido"})
		return
	}
	ok, err := s.db.DecideReview(r.Context(), r.PathValue("id"), req.Status)
	if err != nil || !ok {
		responder(w, http.StatusNotFound, mapa{"error": "Avaliação não encontrada"})
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

// ---------------------------------------------------------------------------
// Avise-me
// ---------------------------------------------------------------------------

func (s *Servidor) createStockAlert(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProductID string `json:"product_id"`
		Email     string `json:"email"`
	}
	if !decode(w, r, &req) {
		return
	}
	var userID *string
	email := strings.TrimSpace(req.Email)
	if u, err := s.auth.DoRequest(r); err == nil {
		userID = &u.ID
		if email == "" {
			email = u.Email
		}
	}
	if !strings.Contains(email, "@") || len(email) > 200 {
		responder(w, http.StatusBadRequest, mapa{"error": "Informe um e-mail válido"})
		return
	}
	err := s.db.CreateStockAlert(r.Context(), req.ProductID, email, userID)
	switch {
	case errors.Is(err, db.ErrNotAllowed):
		responder(w, http.StatusConflict, mapa{"error": "Esta peça já está disponível"})
	case err != nil:
		s.falha(w, err, "salvar o aviso")
	default:
		responder(w, http.StatusOK, mapa{"ok": true})
	}
}

func (s *Servidor) adminStockAlerts(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.AdminStockAlerts(r.Context())
	if err != nil {
		s.falha(w, err, "carregar os avise-me")
		return
	}
	responder(w, http.StatusOK, list)
}

// ---------------------------------------------------------------------------
// Trocas
// ---------------------------------------------------------------------------

func (s *Servidor) myReturns(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
		return
	}
	list, err := s.db.ReturnsForUser(r.Context(), user.ID)
	if err != nil {
		s.falha(w, err, "carregar suas trocas")
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) createReturn(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "Entre na sua conta para pedir a troca"})
		return
	}
	var req struct {
		OrderID string `json:"order_id"`
		Kind    string `json:"kind"`
		Reason  string `json:"reason"`
	}
	if !decode(w, r, &req) {
		return
	}
	reason := strings.TrimSpace(req.Reason)
	if (req.Kind != "troca" && req.Kind != "reembolso") || utf8.RuneCountInString(reason) < 3 || utf8.RuneCountInString(reason) > 1000 {
		responder(w, http.StatusBadRequest, mapa{"error": "Escolha troca ou reembolso e conte o motivo"})
		return
	}
	id, err := s.db.CreateReturn(r.Context(), user.ID, req.OrderID, req.Kind, reason, time.Now())
	switch {
	case errors.Is(err, db.ErrNotAllowed):
		responder(w, http.StatusForbidden, mapa{"error": fmt.Sprintf(
			"A troca pode ser pedida em até %d dias depois que o pedido é entregue. Se precisar, fale com a gente por e-mail.", dominio.ReturnWindowDays)})
	case errors.Is(err, db.ErrDuplicate):
		responder(w, http.StatusConflict, mapa{"error": "Já existe uma troca em andamento para este pedido"})
	case err != nil:
		s.falha(w, err, "registrar a troca")
	default:
		responder(w, http.StatusOK, mapa{"ok": true, "id": id})
	}
}

func (s *Servidor) adminReturns(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.AdminReturns(r.Context())
	if err != nil {
		s.falha(w, err, "carregar as trocas")
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) adminAdvanceReturn(w http.ResponseWriter, r *http.Request) {
	var req struct {
		From string `json:"from"`
		To   string `json:"to"`
		Note string `json:"note"`
	}
	if !decode(w, r, &req) {
		return
	}
	from, to := dominio.ReturnStage(req.From), dominio.ReturnStage(req.To)
	if !dominio.ReturnCanGo(from, to) {
		responder(w, http.StatusBadRequest, mapa{"error": "Essa mudança de etapa não é permitida"})
		return
	}
	ret, err := s.db.AdvanceReturn(r.Context(), r.PathValue("id"), from, to, strings.TrimSpace(req.Note))
	if err != nil {
		s.falha(w, err, "salvar a etapa")
		return
	}
	if ret == nil {
		responder(w, http.StatusConflict, mapa{"error": "A troca mudou de etapa enquanto você olhava. Recarregue."})
		return
	}
	if s.db.AutomationEnabled(r.Context(), "return_update") {
		p := notificacao.Pedido{
			Numero: ret.OrderNumber, Nome: ret.Customer, Email: ret.Email,
			Etapa:   dominio.ReturnStageLabel(to),
			URLAcao: s.cfg.SiteURL + "/conta?aba=trocas", TextoAcao: "Ver minha troca",
		}
		s.aplicarTexto(r.Context(), "return_update", &p)
		s.notif.Avisar(r.Context(), notificacao.TrocaAtualizada, p)
		s.registrarAviso(r.Context(), ret.OrderID, notificacao.TrocaAtualizada)
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

// ---------------------------------------------------------------------------
// Vitrine e avisos do topo
// ---------------------------------------------------------------------------

func (s *Servidor) showcase(w http.ResponseWriter, r *http.Request) {
	ids, err := s.db.ShowcaseIDs(r.Context(), true)
	if err != nil {
		s.falha(w, err, "carregar a vitrine")
		return
	}
	out := mapa{}
	for slot, list := range ids {
		ps, err := s.db.ProductsByIDs(r.Context(), list)
		if err != nil {
			s.falha(w, err, "carregar a vitrine")
			return
		}
		out[slot] = ps
	}
	responder(w, http.StatusOK, out)
}

func (s *Servidor) adminSetShowcase(w http.ResponseWriter, r *http.Request) {
	slot := r.PathValue("slot")
	limit, ok := db.ShowcaseLimits[slot]
	if !ok {
		responder(w, http.StatusNotFound, mapa{"error": "Espaço da vitrine não existe"})
		return
	}
	var req struct {
		ProductIDs []string `json:"product_ids"`
	}
	if !decode(w, r, &req) {
		return
	}
	if len(req.ProductIDs) > limit {
		responder(w, http.StatusBadRequest, mapa{"error": fmt.Sprintf("Este espaço comporta até %d peças", limit)})
		return
	}
	if err := s.db.SetShowcase(r.Context(), slot, req.ProductIDs); err != nil {
		s.falha(w, err, "salvar a vitrine")
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

func (s *Servidor) announcements(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.Announcements(r.Context(), true)
	if err != nil {
		s.falha(w, err, "carregar os avisos")
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) adminAnnouncements(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.Announcements(r.Context(), false)
	if err != nil {
		s.falha(w, err, "carregar os avisos")
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) adminSetAnnouncements(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Items []db.Announcement `json:"items"`
	}
	if !decode(w, r, &req) {
		return
	}
	if len(req.Items) > 10 {
		responder(w, http.StatusBadRequest, mapa{"error": "No máximo 10 avisos"})
		return
	}
	for _, a := range req.Items {
		n := utf8.RuneCountInString(strings.TrimSpace(a.Text))
		if n < 3 || n > 120 {
			responder(w, http.StatusBadRequest, mapa{"error": "Cada aviso precisa ter de 3 a 120 caracteres"})
			return
		}
	}
	if err := s.db.SetAnnouncements(r.Context(), req.Items); err != nil {
		s.falha(w, err, "salvar os avisos")
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

// ---------------------------------------------------------------------------
// Sacola salva
// ---------------------------------------------------------------------------

func (s *Servidor) saveCart(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
		return
	}
	var req struct {
		Items []db.CartLine `json:"items"`
	}
	if !decode(w, r, &req) {
		return
	}
	if len(req.Items) > maxItems {
		req.Items = req.Items[:maxItems]
	}
	if err := s.db.SaveCart(r.Context(), user.ID, req.Items); err != nil {
		s.falha(w, err, "salvar a sacola")
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

// ---------------------------------------------------------------------------
// Automações
// ---------------------------------------------------------------------------

func (s *Servidor) adminAutomations(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.AutomationStatuses(r.Context())
	if err != nil {
		s.falha(w, err, "carregar as automações")
		return
	}
	responder(w, http.StatusOK, mapa{"items": list, "email_ready": s.notif.Ativo()})
}

func (s *Servidor) adminSetAutomation(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if !decode(w, r, &req) {
		return
	}
	ok, err := s.db.SetAutomation(r.Context(), r.PathValue("key"), req.Enabled)
	if err != nil || !ok {
		responder(w, http.StatusNotFound, mapa{"error": "Automação não encontrada"})
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

// runAutomations é a tarefa agendada (POST /tarefas/automacoes, a cada hora):
// lembrete de pagamento, carrinho abandonado, pedido de avaliação e avise-me.
// Cada fila marca como enviado na mesma consulta que lê — rodar duas vezes
// não manda o mesmo e-mail duas vezes. Sem e-mail configurado, não marca
// nada: os avisos ficam esperando o Resend ser ligado.
func (s *Servidor) runAutomations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !s.notif.Ativo() {
		responder(w, http.StatusOK, mapa{"ok": true, "nota": "e-mail não configurado, nada enviado"})
		return
	}
	site := s.cfg.SiteURL
	enviados := mapa{}

	type fila struct {
		chave  string
		buscar func() ([]db.PendingNotice, error)
		montar func(n db.PendingNotice) (notificacao.Evento, notificacao.Pedido)
	}
	filas := []fila{
		{"payment_reminder", func() ([]db.PendingNotice, error) { return s.db.DuePaymentReminders(ctx) },
			func(n db.PendingNotice) (notificacao.Evento, notificacao.Pedido) {
				return notificacao.PagamentoPendente, notificacao.Pedido{ID: n.OrderID, Numero: n.Number, Nome: n.Name, Email: n.Email,
					URLAcao: site + "/checkout", TextoAcao: "Finalizar o pagamento"}
			}},
		{"abandoned_cart", func() ([]db.PendingNotice, error) { return s.db.DueAbandonedCarts(ctx) },
			func(n db.PendingNotice) (notificacao.Evento, notificacao.Pedido) {
				return notificacao.CarrinhoAbandonado, notificacao.Pedido{Nome: n.Name, Email: n.Email,
					URLAcao: site + "/checkout", TextoAcao: "Voltar para a sacola"}
			}},
		{"review_request", func() ([]db.PendingNotice, error) { return s.db.DueReviewRequests(ctx) },
			func(n db.PendingNotice) (notificacao.Evento, notificacao.Pedido) {
				return notificacao.PedirAvaliacao, notificacao.Pedido{ID: n.OrderID, Numero: n.Number, Nome: n.Name, Email: n.Email,
					URLAcao: site + "/conta?aba=avaliar", TextoAcao: "Avaliar minha peça"}
			}},
		{"stock_alert", func() ([]db.PendingNotice, error) { return s.db.DueStockAlerts(ctx) },
			func(n db.PendingNotice) (notificacao.Evento, notificacao.Pedido) {
				return notificacao.VoltouAoEstoque, notificacao.Pedido{Email: n.Email, Produto: n.Product,
					URLAcao: site + "/produto/" + n.Slug, TextoAcao: "Ver a peça"}
			}},
	}
	textos, _ := s.db.AutomationTexts(ctx)
	for _, f := range filas {
		if !s.db.AutomationEnabled(ctx, f.chave) {
			continue
		}
		lista, err := f.buscar()
		if err != nil {
			s.log.Error("falha na fila de automação", "fila", f.chave, "erro", err)
			continue
		}
		for _, n := range lista {
			ev, p := f.montar(n)
			if t, ok := textos[f.chave]; ok {
				p.AssuntoPersonalizado, p.MioloPersonalizado = t.Subject, t.Body
			}
			s.notif.Avisar(ctx, ev, p)
			s.registrarAviso(ctx, p.ID, ev)
		}
		enviados[f.chave] = len(lista)
	}
	s.log.Info("automações executadas", "enviados", enviados)
	responder(w, http.StatusOK, mapa{"ok": true, "enviados": enviados})
}

// productExtras: o que a página do produto mostra além da peça — venda real
// da semana e o kit "compre junto" (decisões 28 e 32).
func (s *Servidor) productExtras(w http.ResponseWriter, r *http.Request) {
	sold, kit, err := s.db.ProductExtras(r.Context(), r.PathValue("slug"))
	if err != nil {
		s.falha(w, err, "carregar a peça")
		return
	}
	responder(w, http.StatusOK, mapa{"sold_week": sold, "kit": kit})
}
