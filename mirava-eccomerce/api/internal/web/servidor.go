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
)

type Config struct {
	SiteURL          string
	WebhookURL       string
	ModoTeste        bool
	ParcelasSemJuros int
	EmbalagemCentavos dominio.Centavos
	CronSecret       string
	// PagamentoPronto é false quando as credenciais do Mercado Pago não foram
	// configuradas. O serviço sobe assim mesmo — catálogo e sincronização não
	// dependem dele — mas checkout e webhook recusam com mensagem clara.
	PagamentoPronto bool
}

type Servidor struct {
	db   *db.DB
	mp   *mercadopago.Cliente
	auth *auth.Validador
	li   *lilly.Cliente
	cfg  Config
	log  *slog.Logger
}

func Novo(banco *db.DB, mp *mercadopago.Cliente, val *auth.Validador, cfg Config, log *slog.Logger) *Servidor {
	return &Servidor{db: banco, mp: mp, auth: val, li: lilly.NovoCliente(), cfg: cfg, log: log}
}

func (s *Servidor) Rotas() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /saude", s.saude)
	mux.HandleFunc("POST /checkout", s.criarPagamento)
	mux.HandleFunc("POST /webhook/mercadopago", s.webhookMP)
	mux.HandleFunc("POST /tarefas/sincronizar", s.protegidoPorCron(s.sincronizar))
	mux.HandleFunc("POST /tarefas/avaliar-lote", s.protegidoPorCron(s.avaliarLote))
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
			responder(w, http.StatusUnauthorized, mapa{"erro": "não autorizado"})
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
		responder(w, http.StatusServiceUnavailable, mapa{"ok": false, "erro": "banco indisponível"})
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}
