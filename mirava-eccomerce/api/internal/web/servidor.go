// Package web expõe a API HTTP.
package web

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/mirava/api/internal/auth"
	"github.com/mirava/api/internal/db"
	"github.com/mirava/api/internal/dominio"
	"github.com/mirava/api/internal/lilly"
	"github.com/mirava/api/internal/mercadopago"
	"github.com/mirava/api/internal/notificacao"
	"github.com/mirava/api/internal/storage"
)

type Config struct {
	SiteURL                string
	WebhookURL             string
	TestMode               bool
	InstallmentsNoInterest int
	PackagingCents         dominio.Cents
	CronSecret             string
	// WhatsApp da loja, só dígitos com DDI (ex.: 5519998604004). Usado para
	// montar o link wa.me que vai nos avisos e na página do pedido.
	WhatsApp string
	// PaymentReady é false quando as credenciais do Mercado Pago não foram
	// configuradas. O serviço sobe assim mesmo — catálogo e sincronização não
	// dependem dele — mas checkout e webhook recusam com mensagem clara.
	PaymentReady bool
}

type Servidor struct {
	db      *db.DB
	mp      *mercadopago.Client
	auth    *auth.Validator
	li      *lilly.Client
	storage *storage.Store
	notif   *notificacao.Notificador
	cfg     Config
	log     *slog.Logger
}

func Novo(banco *db.DB, mp *mercadopago.Client, val *auth.Validator, store *storage.Store,
	notif *notificacao.Notificador, cfg Config, log *slog.Logger) *Servidor {
	return &Servidor{db: banco, mp: mp, auth: val, li: lilly.NewClient(),
		storage: store, notif: notif, cfg: cfg, log: log}
}

func (s *Servidor) Rotas() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /saude", s.saude)

	// Fotos de produto, servidas direto do disco (ver internal/storage).
	mux.Handle("GET /images/", http.StripPrefix("/images/", s.storage.Handler()))
	mux.HandleFunc("POST /auth/cadastrar", s.signup)
	mux.HandleFunc("POST /auth/entrar", s.login)
	mux.HandleFunc("GET /auth/eu", s.me)
	mux.HandleFunc("PUT /auth/perfil", s.updateProfile)

	mux.HandleFunc("GET /produtos", s.listProducts)
	mux.HandleFunc("GET /produtos/{slug}", s.productBySlug)
	mux.HandleFunc("GET /produtos/{slug}/relacionados", s.relatedProducts)

	mux.HandleFunc("GET /enderecos", s.listAddresses)
	mux.HandleFunc("POST /enderecos", s.createAddress)
	mux.HandleFunc("DELETE /enderecos/{id}", s.deleteAddress)

	mux.HandleFunc("GET /frete", s.shippingQuote)

	mux.HandleFunc("GET /pedidos", s.listOrders)
	mux.HandleFunc("POST /pedidos/rastrear", s.trackOrder)

	mux.HandleFunc("GET /favoritos", s.listFavorites)
	mux.HandleFunc("POST /favoritos/{id}", s.addFavorite)
	mux.HandleFunc("DELETE /favoritos/{id}", s.removeFavorite)
	mux.HandleFunc("GET /clube", s.clubStatus)
	mux.HandleFunc("GET /produtos/{slug}/avaliacoes", s.productReviews)
	mux.HandleFunc("GET /produtos/{slug}/extras", s.productExtras)
	mux.HandleFunc("GET /categorias", s.categories)
	mux.HandleFunc("GET /banners", s.banners)
	mux.HandleFunc("GET /galeria", s.gallery)
	mux.HandleFunc("GET /avaliacoes/recentes", s.recentReviews)
	mux.HandleFunc("POST /novidades", s.subscribe)
	mux.HandleFunc("GET /cupons", s.myCoupons)
	mux.HandleFunc("POST /auth/esqueci", s.forgotPassword)
	mux.HandleFunc("POST /auth/redefinir", s.resetPassword)
	mux.HandleFunc("GET /avaliacoes/pendentes", s.reviewables)
	mux.HandleFunc("POST /avaliacoes", s.createReview)
	mux.HandleFunc("POST /avise-me", s.createStockAlert)
	mux.HandleFunc("GET /trocas", s.myReturns)
	mux.HandleFunc("POST /trocas", s.createReturn)
	mux.HandleFunc("GET /vitrine", s.showcase)
	mux.HandleFunc("GET /avisos", s.announcements)
	mux.HandleFunc("PUT /carrinho", s.saveCart)
	mux.HandleFunc("GET /pedidos/{id}", s.orderByID)

	mux.HandleFunc("POST /checkout", s.createPayment)
	mux.HandleFunc("POST /checkout/previa", s.checkoutPreview)
	mux.HandleFunc("POST /webhook/mercadopago", s.webhookMP)
	mux.HandleFunc("POST /tarefas/sincronizar", s.protegidoPorCron(s.syncCatalog))
	mux.HandleFunc("POST /tarefas/avaliar-lote", s.protegidoPorCron(s.evaluateBatch))
	mux.HandleFunc("POST /tarefas/automacoes", s.protegidoPorCron(s.runAutomations))
	// Agendada a cada hora: só sincroniza quando passou a frequência do painel.
	mux.HandleFunc("POST /tarefas/sincronizar-se-devido", s.protegidoPorCron(s.syncIfDue))

	// Painel de gestão (ver admin.go): login da loja + tabela `admins`.
	mux.HandleFunc("GET /admin/eu", s.requireAdmin(s.adminMe))
	mux.HandleFunc("GET /admin/resumo", s.requireAdmin(s.adminSummary))
	mux.HandleFunc("GET /admin/pedidos", s.requireAdmin(s.adminOrders))
	mux.HandleFunc("GET /admin/pedidos/{id}", s.requireAdmin(s.adminOrder))
	mux.HandleFunc("POST /admin/pedidos/{id}/transicao", s.requireAdmin(s.adminTransition))
	mux.HandleFunc("POST /admin/pedidos/{id}/despachar", s.requireAdmin(s.shipOrder))
	mux.HandleFunc("GET /admin/lotes", s.requireAdmin(s.adminBatches))
	mux.HandleFunc("POST /admin/lotes/{id}/comprar", s.requireAdmin(s.adminPurchaseBatch))
	mux.HandleFunc("POST /admin/lotes/{id}/receber", s.requireAdmin(s.adminReceiveBatch))
	mux.HandleFunc("GET /admin/produtos", s.requireAdmin(s.adminProducts))
	mux.HandleFunc("GET /admin/produtos/{id}", s.requireAdmin(s.adminProduct))
	mux.HandleFunc("PUT /admin/produtos/{id}", s.requireAdmin(s.adminUpdateProduct))
	mux.HandleFunc("POST /admin/produtos/{id}/markup", s.requireAdmin(s.adminApplyMarkup))
	mux.HandleFunc("POST /admin/produtos/{id}/sugestao", s.requireAdmin(s.adminResolveSuggestion))
	mux.HandleFunc("GET /admin/financeiro", s.requireAdmin(s.adminFinance))
	mux.HandleFunc("GET /admin/sincronizacao", s.requireAdmin(s.adminSync))
	mux.HandleFunc("POST /admin/produtos/lote", s.requireAdmin(s.adminBulkProducts))
	mux.HandleFunc("GET /admin/clientes", s.requireAdmin(s.adminCustomers))
	mux.HandleFunc("GET /admin/clientes/{id}/pedidos", s.requireAdmin(s.adminCustomerOrders))
	mux.HandleFunc("GET /admin/atividades", s.requireAdmin(s.adminActivities))
	mux.HandleFunc("GET /admin/configuracoes", s.requireAdmin(s.adminConfig))
	mux.HandleFunc("GET /admin/cupons", s.requireAdmin(s.adminCoupons))
	mux.HandleFunc("POST /admin/cupons", s.requireAdmin(s.adminCreateCoupon))
	mux.HandleFunc("PUT /admin/cupons/{code}", s.requireAdmin(s.adminToggleCoupon))
	mux.HandleFunc("GET /admin/avaliacoes", s.requireAdmin(s.adminReviews))
	mux.HandleFunc("PUT /admin/avaliacoes/{id}", s.requireAdmin(s.adminDecideReview))
	mux.HandleFunc("GET /admin/avise-me", s.requireAdmin(s.adminStockAlerts))
	mux.HandleFunc("GET /admin/trocas", s.requireAdmin(s.adminReturns))
	mux.HandleFunc("PUT /admin/trocas/{id}", s.requireAdmin(s.adminAdvanceReturn))
	mux.HandleFunc("PUT /admin/vitrine/{slot}", s.requireAdmin(s.adminSetShowcase))
	mux.HandleFunc("GET /admin/avisos", s.requireAdmin(s.adminAnnouncements))
	mux.HandleFunc("PUT /admin/avisos", s.requireAdmin(s.adminSetAnnouncements))
	mux.HandleFunc("GET /admin/automacoes", s.requireAdmin(s.adminAutomations))
	mux.HandleFunc("PUT /admin/automacoes/{key}", s.requireAdmin(s.adminSetAutomation))

	// Design v5 completo (decisões 21, 27 e 32 a 35) — ver loja.go.
	mux.HandleFunc("GET /admin/loja", s.requireAdmin(s.adminSettings))
	mux.HandleFunc("PUT /admin/loja", s.requireAdmin(s.adminSaveSettings))
	mux.HandleFunc("POST /admin/precos/recalcular", s.requireAdmin(s.adminRecalculatePrices))
	mux.HandleFunc("GET /admin/categorias", s.requireAdmin(s.adminCategories))
	mux.HandleFunc("POST /admin/categorias", s.requireAdmin(s.adminCreateCategory))
	mux.HandleFunc("PUT /admin/categorias/{slug}", s.requireAdmin(s.adminUpdateCategory))
	mux.HandleFunc("DELETE /admin/categorias/{slug}", s.requireAdmin(s.adminDeleteCategory))
	mux.HandleFunc("GET /admin/mapeamento", s.requireAdmin(s.adminMappings))
	mux.HandleFunc("PUT /admin/mapeamento", s.requireAdmin(s.adminSetMappings))
	mux.HandleFunc("GET /admin/promocoes", s.requireAdmin(s.adminPromotions))
	mux.HandleFunc("POST /admin/promocoes", s.requireAdmin(s.adminCreatePromotion))
	mux.HandleFunc("DELETE /admin/promocoes/{id}", s.requireAdmin(s.adminDeletePromotion))
	mux.HandleFunc("GET /admin/kits", s.requireAdmin(s.adminKits))
	mux.HandleFunc("POST /admin/kits", s.requireAdmin(s.adminCreateKit))
	mux.HandleFunc("PUT /admin/kits/{id}", s.requireAdmin(s.adminToggleKit))
	mux.HandleFunc("DELETE /admin/kits/{id}", s.requireAdmin(s.adminDeleteKit))
	mux.HandleFunc("GET /admin/banners", s.requireAdmin(s.adminBanners))
	mux.HandleFunc("PUT /admin/banners", s.requireAdmin(s.adminSetBanners))
	mux.HandleFunc("PUT /admin/galeria", s.requireAdmin(s.adminSetGallery))
	mux.HandleFunc("POST /admin/upload", s.requireAdmin(s.adminUpload))
	mux.HandleFunc("POST /admin/produtos", s.requireAdmin(s.adminCreateProduct))
	mux.HandleFunc("GET /admin/fila-lilly", s.requireAdmin(s.adminQueue))
	mux.HandleFunc("POST /admin/fila-lilly/importar-tudo", s.requireAdmin(s.adminImportAll))
	mux.HandleFunc("POST /admin/fila-lilly/{id}/importar", s.requireAdmin(s.adminImportQueued))
	mux.HandleFunc("POST /admin/fila-lilly/{id}/ignorar", s.requireAdmin(s.adminIgnoreQueued))
	mux.HandleFunc("POST /admin/sincronizar", s.requireAdmin(s.adminSyncNow))
	mux.HandleFunc("GET /admin/sincronizacao/teste", s.requireAdmin(s.adminTestConnection))
	mux.HandleFunc("GET /admin/clientes/{id}/notas", s.requireAdmin(s.adminCustomerNotes))
	mux.HandleFunc("PUT /admin/clientes/{id}/notas", s.requireAdmin(s.adminSaveCustomerNotes))
	mux.HandleFunc("POST /admin/clientes/{id}/cupom", s.requireAdmin(s.adminSendCoupon))
	mux.HandleFunc("GET /admin/carrinhos", s.requireAdmin(s.adminCarts))
	mux.HandleFunc("POST /admin/carrinhos/{id}/lembrar", s.requireAdmin(s.adminRemindCart))
	mux.HandleFunc("POST /admin/avise-me/{id}/avisar", s.requireAdmin(s.adminNotifyStock))
	mux.HandleFunc("GET /admin/novidades", s.requireAdmin(s.adminSubscribers))
	mux.HandleFunc("GET /admin/automacoes/textos", s.requireAdmin(s.adminAutomationTexts))
	mux.HandleFunc("PUT /admin/automacoes/{key}/texto", s.requireAdmin(s.adminSetAutomationText))
	mux.HandleFunc("POST /admin/automacoes/{key}/teste", s.requireAdmin(s.adminTestAutomation))
	mux.HandleFunc("GET /admin/equipe", s.requireAdmin(s.adminTeam))
	mux.HandleFunc("POST /admin/equipe", s.requireAdmin(s.adminAddTeam))
	mux.HandleFunc("DELETE /admin/equipe/{id}", s.requireAdmin(s.adminRemoveTeam))
	mux.HandleFunc("GET /admin/pedidos/{id}/avisos", s.requireAdmin(s.adminOrderNotices))
	return s.comCORS(s.comLog(mux))
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

func (s *Servidor) comCORS(prox http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origem := s.cfg.SiteURL
		if origem == "" {
			origem = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origem)
		w.Header().Set("Access-Control-Allow-Headers", "authorization, content-type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		prox.ServeHTTP(w, r)
	})
}

func (s *Servidor) comLog(prox http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		inicio := time.Now()
		prox.ServeHTTP(w, r)
		s.log.Info("requisição", "metodo", r.Method, "rota", r.URL.Path,
			"duracao", time.Since(inicio).String())
	})
}

// protegidoPorCron: as tarefas agendadas não têm usuário logado, então a
// autorização é um segredo compartilhado com o Cloud Scheduler.
func (s *Servidor) protegidoPorCron(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		enviado := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if s.cfg.CronSecret == "" || enviado != s.cfg.CronSecret {
			responder(w, http.StatusUnauthorized, mapa{"error": "não autorizado"})
			return
		}
		h(w, r)
	}
}

type mapa map[string]any

func responder(w http.ResponseWriter, status int, corpo any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(corpo)
}

func (s *Servidor) saude(w http.ResponseWriter, r *http.Request) {
	if err := s.db.Ping(r.Context()); err != nil {
		responder(w, http.StatusServiceUnavailable, mapa{"ok": false, "error": "banco indisponível"})
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}
