package web

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/mirava/api/internal/db"
	"github.com/mirava/api/internal/dominio"
)

// Mirava Club (conta da cliente) e cupons (painel) — decisão 31.

func (s *Servidor) clubStatus(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
		return
	}
	balance, earned, err := s.db.PointsBalance(r.Context(), user.ID)
	if err != nil {
		s.log.Error("falha ao ler pontos", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar seus pontos"})
		return
	}
	statement, err := s.db.ClubStatement(r.Context(), user.ID)
	if err != nil {
		s.log.Error("falha ao ler extrato de pontos", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar seus pontos"})
		return
	}
	level := dominio.ClubLevelFor(earned)
	next := 0
	switch level {
	case dominio.ClubBrilho:
		next = dominio.ClubEncantoFrom
	case dominio.ClubEncanto:
		next = dominio.ClubJoiaRaraFrom
	}
	// Quanto o saldo vale em desconto (sem o teto de 30%, que depende do pedido).
	value := dominio.Cents(balance / dominio.PointsPerBlock * dominio.CentsPerBlock)
	responder(w, http.StatusOK, mapa{
		"balance":          balance,
		"earned":           earned,
		"level":            level,
		"next_level_at":    next,
		"balance_value":    value,
		"points_per_block": dominio.PointsPerBlock,
		"cents_per_block":  dominio.CentsPerBlock,
		"statement":        statement,
	})
}

func (s *Servidor) adminCoupons(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.AdminCoupons(r.Context())
	if err != nil {
		s.log.Error("falha ao listar cupons", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar os cupons"})
		return
	}
	responder(w, http.StatusOK, list)
}

type cupomRequest struct {
	Code        string     `json:"code"`
	Kind        string     `json:"kind"`
	Value       int        `json:"value"`
	MinSubtotal int        `json:"min_subtotal_cents"`
	StartsAt    *time.Time `json:"starts_at"`
	EndsAt      *time.Time `json:"ends_at"`
	MaxUses     int        `json:"max_uses"`
	Description string     `json:"description"`
}

func (s *Servidor) adminCreateCoupon(w http.ResponseWriter, r *http.Request) {
	var req cupomRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&req); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Requisição inválida"})
		return
	}
	c := dominio.Coupon{
		Code: dominio.NormalizeCouponCode(req.Code), Kind: dominio.CouponKind(req.Kind), Value: req.Value,
		MinSubtotal: dominio.Cents(req.MinSubtotal), StartsAt: req.StartsAt, EndsAt: req.EndsAt,
		MaxUses: req.MaxUses, Active: true,
	}
	if err := c.Validate(); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": err.Error()})
		return
	}
	err := s.db.CreateCoupon(r.Context(), c, strings.TrimSpace(req.Description))
	if errors.Is(err, db.ErrDuplicate) {
		responder(w, http.StatusConflict, mapa{"error": "Já existe um cupom com esse código"})
		return
	}
	if err != nil {
		s.log.Error("falha ao criar cupom", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui criar o cupom"})
		return
	}
	s.log.Info("cupom criado", "codigo", c.Code)
	responder(w, http.StatusOK, mapa{"ok": true, "code": c.Code})
}

func (s *Servidor) adminToggleCoupon(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Active bool `json:"active"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<10)).Decode(&req); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Requisição inválida"})
		return
	}
	ok, err := s.db.SetCouponActive(r.Context(), dominio.NormalizeCouponCode(r.PathValue("code")), req.Active)
	if err != nil || !ok {
		responder(w, http.StatusNotFound, mapa{"error": "Cupom não encontrado"})
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}
