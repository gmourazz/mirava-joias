package web

import (
	"net/http"
	"strconv"

	"github.com/mirava/api/internal/dominio"
)

// Cotação de frete.
//
// Rota pública de propósito: a cliente precisa ver quanto custa entregar antes
// de criar conta. Não expõe nada sensível — é tabela de preço, a mesma que
// estaria impressa numa página de "prazos e entregas".
//
// O que ela devolve NÃO é promessa: o valor cobrado é recalculado no checkout,
// a partir da UF do endereço salvo e do subtotal lido do banco. Esta rota
// existe para mostrar, não para decidir.
func (s *Servidor) shippingQuote(w http.ResponseWriter, r *http.Request) {
	uf := r.URL.Query().Get("uf")
	subtotal, _ := strconv.ParseInt(r.URL.Query().Get("subtotal_cents"), 10, 64)
	if subtotal < 0 {
		subtotal = 0
	}

	// Sem UF ainda (a cliente abriu o carrinho e não escolheu endereço), devolve
	// só a regra — é o que a barrinha de "faltam X para o frete grátis" precisa.
	// Com sessão, o nível Encanto do Club entra na conta (PAC grátis,
	// decisão 34). Sem sessão, é a tabela comum.
	clubFree := false
	if u, err := s.auth.DoRequest(r); err == nil {
		if _, earned, err := s.db.PointsBalance(r.Context(), u.ID); err == nil {
			clubFree = dominio.ClubFreeShipping(earned)
		}
	}

	var options []dominio.ShippingOption
	if uf != "" {
		options = dominio.ShippingOptionsFor(uf, dominio.Cents(subtotal), clubFree)
	}

	responder(w, http.StatusOK, mapa{
		"free_above_cents":   int64(dominio.FreeShippingAbove),
		"options":            options,
		"club_free_shipping": clubFree,
	})
}
