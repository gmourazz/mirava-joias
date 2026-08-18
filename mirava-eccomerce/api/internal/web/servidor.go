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
	db         *db.DB
	mp         *mercadopago.Client
	auth       *auth.Validator
	li         *lilly.Client
	storage    *storage.Store
	notif      *notificacao.Notificador
	emailCupom *notificacao.Email
	cfg        Config
	log        *slog.Logger
}

// emailCupom vem separado do Notificador porque o e-mail de boas-vindas não
// tem pedido por trás — Notificador.Avisar exige um Pedido, e forçar um
// pedido falso só para mandar esse e-mail seria pior que um segundo campo.
// Nulo é o normal em desenvolvimento (sem RESEND_API_KEY): o cadastro na
// newsletter continua funcionando, só não dispara e-mail de verdade.
func Novo(banco *db.DB, mp *mercadopago.Client, val *auth.Validator, store *storage.Store,
	notif *notificacao.Notificador, emailCupom *notificacao.Email, cfg Config, log *slog.Logger) *Servidor {
	return &Servidor{db: banco, mp: mp, auth: val, li: lilly.NewClient(),
		storage: store, notif: notif, emailCupom: emailCupom, cfg: cfg, log: log}
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
	mux.HandleFunc("GET /categorias/contagem", s.categoryCounts)

	mux.HandleFunc("GET /enderecos", s.listAddresses)
	mux.HandleFunc("POST /enderecos", s.createAddress)
	mux.HandleFunc("DELETE /enderecos/{id}", s.deleteAddress)

	mux.HandleFunc("GET /frete", s.shippingQuote)

	mux.HandleFunc("GET /pedidos", s.listOrders)
	mux.HandleFunc("GET /pedidos/{id}", s.orderByID)

	mux.HandleFunc("POST /checkout", s.createPayment)
	mux.HandleFunc("POST /cupom/validar", s.validateCoupon)
	mux.HandleFunc("POST /newsletter/inscrever", s.subscribeNewsletter)
	mux.HandleFunc("POST /webhook/mercadopago", s.webhookMP)
	mux.HandleFunc("POST /tarefas/sincronizar", s.protegidoPorCron(s.syncCatalog))
	mux.HandleFunc("POST /tarefas/avaliar-lote", s.protegidoPorCron(s.evaluateBatch))
	mux.HandleFunc("POST /tarefas/atualizar-mais-vendidos", s.protegidoPorCron(s.refreshBestSellers))

	// Gestão da loja (ver gestao.go). Protegida pelo mesmo segredo das
	// tarefas até o painel com login de admin existir.
	mux.HandleFunc("GET /gestao/pedidos", s.protegidoPorCron(s.listOrdersToShip))
	mux.HandleFunc("POST /gestao/pedidos/{id}/despachar", s.protegidoPorCron(s.shipOrder))
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
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
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
