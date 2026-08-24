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
	mux.HandleFunc("GET /avaliacoes", s.showcaseReviews)

	mux.HandleFunc("GET /enderecos", s.listAddresses)
	mux.HandleFunc("POST /enderecos", s.createAddress)
	mux.HandleFunc("DELETE /enderecos/{id}", s.deleteAddress)

	mux.HandleFunc("GET /favoritos", s.listFavorites)
	mux.HandleFunc("POST /favoritos/{productId}", s.addFavorite)
	mux.HandleFunc("DELETE /favoritos/{productId}", s.removeFavorite)

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

	// Gestão da loja (ver gestao.go) e painel administrativo (ver admin.go).
	// Login de admin de verdade agora — ver protegidoPorAdmin abaixo.
	mux.HandleFunc("GET /gestao/pedidos", s.protegidoPorAdmin(s.listOrdersToShip))
	mux.HandleFunc("POST /gestao/pedidos/{id}/despachar", s.protegidoPorAdmin(s.shipOrder))
	mux.HandleFunc("GET /admin/dashboard", s.protegidoPorAdmin(s.dashboard))
	mux.HandleFunc("GET /admin/pedidos", s.protegidoPorAdmin(s.listAllOrders))
	mux.HandleFunc("GET /admin/pedidos/{id}", s.protegidoPorAdmin(s.adminOrderDetail))
	mux.HandleFunc("POST /admin/pedidos/{id}/status", s.protegidoPorAdmin(s.advanceStatus))
	mux.HandleFunc("GET /admin/lote/lista-compra", s.protegidoPorAdmin(s.shoppingList))
	mux.HandleFunc("GET /admin/produtos", s.protegidoPorAdmin(s.adminListProducts))
	mux.HandleFunc("PUT /admin/produtos/{id}", s.protegidoPorAdmin(s.adminUpdateProduct))
	mux.HandleFunc("POST /admin/sincronizar", s.protegidoPorAdmin(s.syncCatalog))
	mux.HandleFunc("GET /admin/administradores", s.protegidoPorSystem(s.listAdmins))
	mux.HandleFunc("POST /admin/administradores", s.protegidoPorSystem(s.addAdmin))
	mux.HandleFunc("DELETE /admin/administradores/{userId}", s.protegidoPorSystem(s.removeAdmin))
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
		// PUT e DELETE já eram usados (favoritos, endereços) antes deste
		// comentário existir — só nunca funcionaram de verdade num navegador:
		// curl não faz preflight, então o teste manual sempre passava. Sem
		// os dois aqui, o preflight OPTIONS não autoriza o método e o
		// browser bloqueia a requisição real antes dela sair.
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

// protegidoPorAdmin: sessão de verdade (o mesmo JWT do login da cliente),
// mais a checagem na tabela `admins` — qualquer nível (system ou admin).
// Duas etapas de propósito — token inválido responde 401 (não autenticado),
// token válido mas sem linha em `admins` responde 403 (autenticado, mas sem
// permissão): são erros diferentes e a cliente comum nem deveria ver o
// segundo.
func (s *Servidor) protegidoPorAdmin(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, err := s.auth.DoRequest(r)
		if err != nil {
			responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
			return
		}
		role, err := s.db.AdminRole(r.Context(), user.ID)
		if err != nil {
			s.log.Error("falha ao checar admin", "erro", err)
			responder(w, http.StatusInternalServerError, mapa{"error": "erro ao checar permissão"})
			return
		}
		if role == "" {
			responder(w, http.StatusForbidden, mapa{"error": "sem permissão"})
			return
		}
		h(w, r)
	}
}

// protegidoPorSystem: só quem é "system" passa — hoje, gerenciar outros
// administradores. Um "admin" comum não pode promover nem remover ninguém,
// nem a si mesmo.
func (s *Servidor) protegidoPorSystem(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, err := s.auth.DoRequest(r)
		if err != nil {
			responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
			return
		}
		role, err := s.db.AdminRole(r.Context(), user.ID)
		if err != nil {
			s.log.Error("falha ao checar admin", "erro", err)
			responder(w, http.StatusInternalServerError, mapa{"error": "erro ao checar permissão"})
			return
		}
		if role != "system" {
			responder(w, http.StatusForbidden, mapa{"error": "só a administração master pode fazer isso"})
			return
		}
		h(w, r)
	}
}

type mapa map[string]any

// nullIfEmpty vira `null` no JSON em vez de string vazia — "admin_role": ""
// faria o front achar que existe um papel chamado "nada".
func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

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
