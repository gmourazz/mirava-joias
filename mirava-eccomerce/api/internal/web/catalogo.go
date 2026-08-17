package web

import (
	"net/http"
	"strconv"

	"github.com/mirava/api/internal/db"
)

// Catálogo público — o front lia isso direto do Supabase via supabase-js;
// agora só fala com esta API. Sem autenticação: é a vitrine.

func (s *Servidor) listProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	limit := 0
	if v := q.Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limit = n
		}
	}

	products, err := s.db.ListProducts(r.Context(), db.ProductFilter{
		Category:    q.Get("category"),
		Metal:       q.Get("metal"),
		Featured:    q.Get("featured") == "true",
		BestSellers: q.Get("best_sellers") == "true",
		Search:      q.Get("search"),
		Limit:       limit,
	})
	if err != nil {
		s.log.Error("falha ao listar produtos", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar as peças"})
		return
	}
	responder(w, http.StatusOK, products)
}

func (s *Servidor) productBySlug(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")

	product, err := s.db.ProductBySlug(r.Context(), slug)
	if err != nil {
		s.log.Error("falha ao buscar produto", "erro", err, "slug", slug)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar a peça"})
		return
	}
	if product == nil {
		responder(w, http.StatusNotFound, mapa{"error": "Peça não encontrada"})
		return
	}
	responder(w, http.StatusOK, product)
}

// produtosRelacionados: mesma categoria de um produto, excluindo ele mesmo.
// Usado no fim da página de produto.
func (s *Servidor) relatedProducts(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	q := r.URL.Query()

	quantity := 4
	if v := q.Get("quantity"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			quantity = n
		}
	}

	product, err := s.db.ProductBySlug(r.Context(), slug)
	if err != nil || product == nil {
		responder(w, http.StatusOK, []db.CatalogProduct{}) // seção secundária: falha calada
		return
	}

	related, err := s.db.RelatedProducts(r.Context(), product.Category, product.ID, quantity)
	if err != nil {
		responder(w, http.StatusOK, []db.CatalogProduct{})
		return
	}
	responder(w, http.StatusOK, related)
}

func (s *Servidor) categoryCounts(w http.ResponseWriter, r *http.Request) {
	count, err := s.db.CountByCategory(r.Context())
	if err != nil {
		responder(w, http.StatusOK, mapa{}) // contadores: falha calada
		return
	}
	responder(w, http.StatusOK, count)
}
