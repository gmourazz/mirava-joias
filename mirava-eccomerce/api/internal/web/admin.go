package web

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mirava/api/internal/db"
	"github.com/mirava/api/internal/dominio"
)

// Rotas do painel de gestão (/admin/* no front, design v5).
//
// Segurança: a dona entra com a mesma conta da loja, e o requireAdmin confere
// a tabela `admins` a cada requisição. Papel de admin mora em tabela própria,
// nunca num campo que o usuário edita. Esconder a tela no React é só
// usabilidade — quem protege o dado é este middleware.

func (s *Servidor) requireAdmin(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Sessão do painel, nunca a da loja (decisão 46).
		id, err := s.auth.AdminRequest(r)
		if err != nil {
			responder(w, http.StatusUnauthorized, mapa{"error": "Entre no painel para continuar"})
			return
		}
		u, err := s.db.AdminUserByID(r.Context(), id)
		if err != nil {
			s.log.Error("falha ao conferir admin", "erro", err)
			responder(w, http.StatusInternalServerError, mapa{"error": "Erro ao conferir acesso"})
			return
		}
		if u == nil || !u.Active {
			responder(w, http.StatusUnauthorized, mapa{"error": "Acesso ao painel encerrado"})
			return
		}
		// Papel de despacho (decisão 27): só pedidos e lote.
		if u.Role == "dispatch" && !dispatchAllowed(r.URL.Path) {
			responder(w, http.StatusForbidden, mapa{"error": "Seu acesso é só de despacho (pedidos e lote)"})
			return
		}
		h(w, r.WithContext(context.WithValue(r.Context(), chaveAdmin{}, u)))
	}
}

// adminMe: o front usa para saber se mostra o painel ou a tela de acesso
// restrito.
func (s *Servidor) adminMe(w http.ResponseWriter, r *http.Request) {
	u := adminAtual(r.Context())
	responder(w, http.StatusOK, mapa{"ok": true, "role": u.Role, "name": u.Name, "username": u.Username})
}

func (s *Servidor) adminSummary(w http.ResponseWriter, r *http.Request) {
	sum, err := s.db.AdminSummary(r.Context())
	if err != nil {
		s.log.Error("falha ao montar resumo do painel", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar o resumo"})
		return
	}
	// Cartões do design v5: peças esgotadas, mais vendidas do mês e a próxima
	// sincronização automática (frequência do painel).
	stock, err1 := s.db.UnavailablePublished(r.Context())
	top, err2 := s.db.TopSellers(r.Context())
	if err := errors.Join(err1, err2); err != nil {
		s.log.Error("falha ao montar resumo do painel", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar o resumo"})
		return
	}
	var nextSync *time.Time
	if st, err := s.db.Settings(r.Context()); err == nil {
		if last, err := s.db.LastSyncStarted(r.Context()); err == nil && last != nil {
			t := last.Add(time.Duration(st.SyncEveryHours) * time.Hour)
			nextSync = &t
		}
	}
	responder(w, http.StatusOK, struct {
		*db.AdminSummary
		StockAlerts []db.StockAlertItem `json:"stock_alerts"`
		TopSellers  []db.TopSeller      `json:"top_sellers"`
		NextSync    *time.Time          `json:"next_sync_at"`
	}{sum, stock, top, nextSync})
}

func (s *Servidor) adminOrders(w http.ResponseWriter, r *http.Request) {
	orders, err := s.db.AdminOrders(r.Context())
	if err != nil {
		s.log.Error("falha ao listar pedidos no painel", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar os pedidos"})
		return
	}
	responder(w, http.StatusOK, orders)
}

func (s *Servidor) adminOrder(w http.ResponseWriter, r *http.Request) {
	o, err := s.db.AdminOrderByID(r.Context(), r.PathValue("id"))
	if err != nil {
		s.log.Error("falha ao buscar pedido no painel", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar o pedido"})
		return
	}
	if o == nil {
		responder(w, http.StatusNotFound, mapa{"error": "Pedido não encontrado"})
		return
	}
	responder(w, http.StatusOK, o)
}

type transicaoRequest struct {
	From dominio.Status `json:"from"`
	To   dominio.Status `json:"to"`
}

// adminTransition move um pedido à mão. O front manda de onde e para onde:
// se o pedido mudou nesse meio-tempo (webhook, outra aba), nada acontece e a
// tela recarrega — melhor que aplicar a ação sobre um estado que a dona não
// viu.
func (s *Servidor) adminTransition(w http.ResponseWriter, r *http.Request) {
	var req transicaoRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&req); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Requisição inválida"})
		return
	}
	if !dominio.ManualTransitionAllowed(req.From, req.To) {
		responder(w, http.StatusBadRequest, mapa{"error": "Essa mudança de status não pode ser feita pelo painel"})
		return
	}
	ok, err := s.db.AdminTransition(r.Context(), r.PathValue("id"), req.From, req.To)
	if err != nil {
		s.log.Error("falha na transição pelo painel", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui salvar"})
		return
	}
	if !ok {
		responder(w, http.StatusConflict, mapa{"error": "O pedido mudou de status enquanto você olhava. Recarregue e tente de novo."})
		return
	}
	s.log.Info("transição pelo painel", "pedido", r.PathValue("id"), "de", req.From, "para", req.To)
	responder(w, http.StatusOK, mapa{"ok": true})
}

func (s *Servidor) adminBatches(w http.ResponseWriter, r *http.Request) {
	batches, err := s.db.AdminBatches(r.Context())
	if err != nil {
		s.log.Error("falha ao listar lotes", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar os lotes"})
		return
	}
	responder(w, http.StatusOK, batches)
}

type comprarLoteRequest struct {
	SupplierRef string `json:"supplier_order_ref"`
}

func (s *Servidor) adminPurchaseBatch(w http.ResponseWriter, r *http.Request) {
	var req comprarLoteRequest
	// Corpo opcional: o número do pedido na Lilly ajuda a conferir depois,
	// mas não pode travar a dona se ela não tiver à mão.
	_ = json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&req)

	err := s.db.PurchaseBatch(r.Context(), r.PathValue("id"), req.SupplierRef)
	s.respondBatchAction(w, err, "lote comprado", r.PathValue("id"))
}

func (s *Servidor) adminReceiveBatch(w http.ResponseWriter, r *http.Request) {
	err := s.db.ReceiveBatch(r.Context(), r.PathValue("id"))
	s.respondBatchAction(w, err, "lote recebido", r.PathValue("id"))
}

func (s *Servidor) respondBatchAction(w http.ResponseWriter, err error, msg, batchID string) {
	switch {
	case errors.Is(err, db.ErrBatchState):
		responder(w, http.StatusConflict, mapa{"error": "Este lote já mudou de etapa. Recarregue a página."})
	case err != nil:
		s.log.Error("falha na ação do lote", "erro", err, "lote", batchID)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui salvar"})
	default:
		s.log.Info(msg, "lote", batchID)
		responder(w, http.StatusOK, mapa{"ok": true})
	}
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------

const produtosPorPagina = 50

func (s *Servidor) adminProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	pagina, _ := strconv.Atoi(q.Get("pagina"))
	if pagina < 1 {
		pagina = 1
	}
	f := db.AdminProductFilter{
		Search:   strings.TrimSpace(q.Get("busca")),
		Category: q.Get("categoria"),
		Metal:    q.Get("banho"),
		Status:   q.Get("status"),
		Price:    q.Get("preco"),
		Vitrine:  q.Get("vitrine"),
		Sales:    q.Get("vendas"),
		Limit:    produtosPorPagina,
		Offset:   (pagina - 1) * produtosPorPagina,
	}
	items, total, err := s.db.AdminProducts(r.Context(), f)
	if err != nil {
		s.log.Error("falha ao listar produtos no painel", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar os produtos"})
		return
	}
	responder(w, http.StatusOK, mapa{"items": items, "total": total, "per_page": produtosPorPagina})
}

func (s *Servidor) adminProduct(w http.ResponseWriter, r *http.Request) {
	p, err := s.db.AdminProductByID(r.Context(), r.PathValue("id"))
	if err != nil {
		s.log.Error("falha ao buscar produto no painel", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar a peça"})
		return
	}
	if p == nil {
		responder(w, http.StatusNotFound, mapa{"error": "Peça não encontrada"})
		return
	}
	responder(w, http.StatusOK, p)
}

func (s *Servidor) adminUpdateProduct(w http.ResponseWriter, r *http.Request) {
	var u db.AdminProductUpdate
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&u); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Requisição inválida"})
		return
	}
	if u.Name != nil {
		nome := strings.TrimSpace(*u.Name)
		if len(nome) < 3 {
			responder(w, http.StatusBadRequest, mapa{"error": "O nome precisa ter pelo menos 3 letras"})
			return
		}
		u.Name = &nome
	}
	if u.Metal != nil && *u.Metal != "prata" && *u.Metal != "ouro" {
		responder(w, http.StatusBadRequest, mapa{"error": "Banho inválido"})
		return
	}
	if (u.SEOTitle != nil && utf8.RuneCountInString(*u.SEOTitle) > 70) ||
		(u.SEODescription != nil && utf8.RuneCountInString(*u.SEODescription) > 170) {
		responder(w, http.StatusBadRequest, mapa{"error": "Título do Google até 70 e descrição até 170 caracteres"})
		return
	}
	if u.Images != nil {
		if len(*u.Images) > 10 {
			responder(w, http.StatusBadRequest, mapa{"error": "No máximo 10 fotos"})
			return
		}
		for _, img := range *u.Images {
			if !strings.HasPrefix(img, "/images/") {
				responder(w, http.StatusBadRequest, mapa{"error": "Use fotos enviadas pelo painel ou já sincronizadas"})
				return
			}
		}
	}
	ok, err := s.db.UpdateProduct(r.Context(), r.PathValue("id"), u)
	if err != nil && u.Category != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Categoria inválida"})
		return
	}
	s.respondProductAction(w, ok, err, "peça atualizada", r.PathValue("id"))
}

// markupRequest: markup_pct nulo = voltar a herdar (decisão 21).
type markupRequest struct {
	MarkupPct *float64 `json:"markup_pct"`
}

func (s *Servidor) adminApplyMarkup(w http.ResponseWriter, r *http.Request) {
	var req markupRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&req); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Requisição inválida"})
		return
	}
	if req.MarkupPct != nil && !dominio.ValidMarkup(*req.MarkupPct) {
		responder(w, http.StatusBadRequest, mapa{"error": fmt.Sprintf(
			"O markup precisa ficar entre %d%% e %d%%", dominio.MinMarkupPct, dominio.MaxMarkupPct)})
		return
	}
	ok, err := s.db.ApplyMarkup(r.Context(), r.PathValue("id"), req.MarkupPct)
	s.respondProductAction(w, ok, err, "markup aplicado", r.PathValue("id"))
}

type sugestaoRequest struct {
	Accept bool `json:"accept"`
}

func (s *Servidor) adminResolveSuggestion(w http.ResponseWriter, r *http.Request) {
	var req sugestaoRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&req); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Requisição inválida"})
		return
	}
	ok, err := s.db.ResolveSuggestion(r.Context(), r.PathValue("id"), req.Accept)
	s.respondProductAction(w, ok, err, "alerta de preço resolvido", r.PathValue("id"))
}

func (s *Servidor) respondProductAction(w http.ResponseWriter, ok bool, err error, msg, id string) {
	switch {
	case err != nil:
		s.log.Error("falha ao salvar peça", "erro", err, "produto", id)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui salvar"})
	case !ok:
		responder(w, http.StatusConflict, mapa{"error": "A peça mudou enquanto você editava. Recarregue e tente de novo."})
	default:
		s.log.Info(msg, "produto", id)
		responder(w, http.StatusOK, mapa{"ok": true})
	}
}

// ---------------------------------------------------------------------------
// Financeiro e sincronização
// ---------------------------------------------------------------------------

// O mês é o do calendário da loja (Brasília), não o do servidor (UTC no Cloud
// Run): um pedido pago às 22h do dia 31 é venda do mês 31, não do seguinte.
var fusoLoja = func() *time.Location {
	if loc, err := time.LoadLocation("America/Sao_Paulo"); err == nil {
		return loc
	}
	return time.FixedZone("BRT", -3*60*60)
}()

func (s *Servidor) adminFinance(w http.ResponseWriter, r *http.Request) {
	agora := time.Now().In(fusoLoja)
	inicio := time.Date(agora.Year(), agora.Month(), 1, 0, 0, 0, 0, fusoLoja)
	if mes := r.URL.Query().Get("mes"); mes != "" {
		t, err := time.ParseInLocation("2006-01", mes, fusoLoja)
		if err != nil {
			responder(w, http.StatusBadRequest, mapa{"error": "Mês inválido (use AAAA-MM)"})
			return
		}
		inicio = t
	}
	fim := inicio.AddDate(0, 1, 0)

	data, err := s.db.FinanceMonth(r.Context(), inicio, fim, s.cfg.PackagingCents)
	if err != nil {
		s.log.Error("falha no financeiro", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui montar o financeiro"})
		return
	}
	settings, _ := s.db.Settings(r.Context())
	data.Input.GiftWrapCostEach = dominio.Cents(settings.GiftWrapCost)
	f := dominio.MonthlyFinance(data.Input)
	fees, err := s.db.FeesByMethod(r.Context(), inicio, fim)
	if err != nil {
		s.log.Error("falha nas taxas por forma", "erro", err)
		fees = []db.FeeByMethod{}
	}
	responder(w, http.StatusOK, mapa{
		"month":                inicio.Format("2006-01"),
		"orders_count":         f.Orders,
		"revenue_cents":        f.Revenue,
		"subtotal_cents":       f.Subtotal,
		"shipping_cents":       f.ShippingCharged,
		"discount_cents":       f.Discount,
		"gift_wrap_cents":      f.GiftWrap,
		"gift_wrap_cost_cents": f.GiftWrapCost,
		"gift_wraps":           f.GiftWraps,
		"cost_cents":           f.Cost,
		"fees_cents":           f.Fees,
		"packaging_cents":      f.Packaging,
		"packaging_each_cents": f.PackagingEach,
		"batch_freight_cents":  f.BatchFreight,
		"canceled_cost_cents":  f.CanceledCost,
		"gross_profit_cents":   f.GrossProfit,
		"net_profit_cents":     f.NetProfit,
		"net_margin_pct":       f.NetMarginPct,
		"orders":               data.Orders,
		"categories":           data.Categories,
		"top_pieces":           data.TopPieces,
		// Design v5: taxas reais por forma de pagamento e metas do mês.
		"fees_by_method": fees,
		"goals": mapa{
			"revenue_cents": settings.GoalRevenue,
			"orders":        settings.GoalOrders,
			"profit_cents":  settings.GoalProfit,
		},
	})
}

func (s *Servidor) adminSync(w http.ResponseWriter, r *http.Request) {
	o, err := s.db.SyncOverview(r.Context())
	if err != nil {
		s.log.Error("falha ao montar visão da sincronização", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar a sincronização"})
		return
	}
	responder(w, http.StatusOK, mapa{
		"overview": o,
		// Regras em vigor, vindas do domínio — a tela só mostra.
		"rules": mapa{
			"variation_limit_pct": dominio.PriceVariationLimit * 100,
			"batch_goal_cents":    dominio.FreeShippingGoal,
			"batch_days_cap":      dominio.DaysCap,
			"min_markup_pct":      dominio.MinMarkupPct,
			"max_markup_pct":      dominio.MaxMarkupPct,
		},
	})
}

// ---------------------------------------------------------------------------
// Clientes, atividades, configurações e ações em massa
// ---------------------------------------------------------------------------

func (s *Servidor) adminCustomers(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.AdminCustomers(r.Context(), strings.TrimSpace(r.URL.Query().Get("busca")))
	if err != nil {
		s.log.Error("falha ao listar clientes", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar as clientes"})
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) adminCustomerOrders(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.AdminCustomerOrders(r.Context(), r.PathValue("id"))
	if err != nil {
		s.log.Error("falha ao listar pedidos da cliente", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar os pedidos"})
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) adminActivities(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.AdminActivities(r.Context(), r.URL.Query().Get("origem"))
	if err != nil {
		s.log.Error("falha ao listar atividades", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar as atividades"})
		return
	}
	responder(w, http.StatusOK, list)
}

// adminConfig mostra as regras em vigor, só para leitura. Elas moram no
// código (domínio) e nas variáveis de ambiente de propósito: mudar regra de
// dinheiro é mudar código com teste, não clicar num formulário.
func (s *Servidor) adminConfig(w http.ResponseWriter, r *http.Request) {
	responder(w, http.StatusOK, mapa{
		"free_shipping_above_cents": dominio.FreeShippingAbove,
		"promised_business_days":    dominio.PromisedBusinessDays,
		"near_deadline_days":        dominio.NearDeadlineDays,
		"batch_goal_cents":          dominio.FreeShippingGoal,
		"batch_days_cap":            dominio.DaysCap,
		"batch_estimated_shipping":  dominio.EstimatedShipping,
		"variation_limit_pct":       dominio.PriceVariationLimit * 100,
		"min_markup_pct":            dominio.MinMarkupPct,
		"max_markup_pct":            dominio.MaxMarkupPct,
		"new_product_days":          dominio.NewProductDays,
		"installments_no_interest":  s.cfg.InstallmentsNoInterest,
		"packaging_cents":           s.cfg.PackagingCents,
		"site_url":                  s.cfg.SiteURL,
		"payment_ready":             s.cfg.PaymentReady,
		"payment_test_mode":         s.cfg.TestMode,
		"email_ready":               s.notif.Ativo(),
	})
}

type loteProdutosRequest struct {
	IDs       []string `json:"ids"`
	Published *bool    `json:"published"`
	Featured  *bool    `json:"featured"`
	MarkupPct *float64 `json:"markup_pct"`
	// "Aplicar markup padrão": as peças voltam a herdar (decisão 21).
	InheritMarkup bool `json:"inherit_markup"`
	// Promoção rápida nas peças escolhidas (decisão 32): % e dias a partir de agora.
	PromoPct  int `json:"promo_pct"`
	PromoDays int `json:"promo_days"`
}

// adminBulkProducts aplica a mesma mudança em várias peças (seleção em massa
// da tela de Produtos). Cada peça passa pelas mesmas regras da edição
// individual; as que falharem são contadas e devolvidas.
func (s *Servidor) adminBulkProducts(w http.ResponseWriter, r *http.Request) {
	var req loteProdutosRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&req); err != nil || len(req.IDs) == 0 {
		responder(w, http.StatusBadRequest, mapa{"error": "Selecione ao menos uma peça"})
		return
	}
	if len(req.IDs) > 200 {
		responder(w, http.StatusBadRequest, mapa{"error": "No máximo 200 peças por vez"})
		return
	}
	if req.MarkupPct != nil && !dominio.ValidMarkup(*req.MarkupPct) {
		responder(w, http.StatusBadRequest, mapa{"error": fmt.Sprintf(
			"O markup precisa ficar entre %d%% e %d%%", dominio.MinMarkupPct, dominio.MaxMarkupPct)})
		return
	}

	if req.PromoPct != 0 {
		if req.PromoPct < 1 || req.PromoPct > dominio.MaxPromoPct || req.PromoDays < 1 || req.PromoDays > 60 {
			responder(w, http.StatusBadRequest, mapa{"error": "Promoção: de 1% a 30%, por 1 a 60 dias"})
			return
		}
		now := time.Now()
		_, err := s.db.CreatePromotion(r.Context(), db.Promotion{
			Name: fmt.Sprintf("Promoção %d%% (%d peças)", req.PromoPct, len(req.IDs)), Pct: req.PromoPct,
			Scope: "products", ProductIDs: req.IDs, StartsAt: now, EndsAt: now.AddDate(0, 0, req.PromoDays),
		})
		if err != nil {
			s.falha(w, err, "criar a promoção")
			return
		}
		responder(w, http.StatusOK, mapa{"updated": len(req.IDs), "failed": 0})
		return
	}

	feitas, falhas := 0, 0
	for _, id := range req.IDs {
		ok, err := true, error(nil)
		if req.Published != nil || req.Featured != nil {
			ok, err = s.db.UpdateProduct(r.Context(), id, db.AdminProductUpdate{Published: req.Published, Featured: req.Featured})
		}
		if err == nil && ok && req.MarkupPct != nil {
			ok, err = s.db.ApplyMarkup(r.Context(), id, req.MarkupPct)
		}
		if err == nil && ok && req.InheritMarkup {
			ok, err = s.db.ApplyMarkup(r.Context(), id, nil)
		}
		if err != nil || !ok {
			falhas++
			continue
		}
		feitas++
	}
	s.log.Info("ação em massa nos produtos", "feitas", feitas, "falhas", falhas)
	responder(w, http.StatusOK, mapa{"updated": feitas, "failed": falhas})
}
