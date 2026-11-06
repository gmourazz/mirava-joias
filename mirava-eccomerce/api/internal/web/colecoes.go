package web

// Coleções (menu "Coleções") e importar peça da Lilly por link (decisão 37).

import (
	"context"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mirava/api/internal/db"
	"github.com/mirava/api/internal/lilly"
)

// ---------------------------------------------------------------------------
// Loja
// ---------------------------------------------------------------------------

func (s *Servidor) collections(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.Collections(r.Context(), true)
	if err != nil {
		s.falha(w, err, "carregar as coleções")
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) collection(w http.ResponseWriter, r *http.Request) {
	c, err := s.db.CollectionBySlug(r.Context(), r.PathValue("slug"), true)
	if err != nil {
		s.falha(w, err, "carregar a coleção")
		return
	}
	if c == nil || c.Count == 0 {
		responder(w, http.StatusNotFound, mapa{"error": "Coleção não encontrada"})
		return
	}
	ids, err := s.db.CollectionProductIDs(r.Context(), c.ID, true)
	if err != nil {
		s.falha(w, err, "carregar a coleção")
		return
	}
	products, err := s.db.ProductsByIDs(r.Context(), ids)
	if err != nil {
		s.falha(w, err, "carregar a coleção")
		return
	}
	responder(w, http.StatusOK, mapa{"collection": c, "products": products})
}

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------

func (s *Servidor) adminCollections(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.Collections(r.Context(), false)
	if err != nil {
		s.falha(w, err, "carregar as coleções")
		return
	}
	responder(w, http.StatusOK, list)
}

// adminCollection traz a coleção com as peças (publicadas ou não) na ordem.
func (s *Servidor) adminCollection(w http.ResponseWriter, r *http.Request) {
	c, err := s.db.CollectionBySlug(r.Context(), r.PathValue("slug"), false)
	if err != nil {
		s.falha(w, err, "carregar a coleção")
		return
	}
	if c == nil {
		responder(w, http.StatusNotFound, mapa{"error": "Coleção não encontrada"})
		return
	}
	ids, err := s.db.CollectionProductIDs(r.Context(), c.ID, false)
	if err != nil {
		s.falha(w, err, "carregar a coleção")
		return
	}
	items := []db.AdminProduct{}
	for _, id := range ids {
		if p, err := s.db.AdminProductByID(r.Context(), id); err == nil && p != nil {
			items = append(items, *p)
		}
	}
	responder(w, http.StatusOK, mapa{"collection": c, "products": items})
}

var collectionSlugRe = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

// slugFrom: "It Girl Era" → "it-girl-era" (sem acento, só a-z, 0-9 e hífen).
func slugFrom(name string) string {
	repl := strings.NewReplacer("á", "a", "à", "a", "â", "a", "ã", "a", "é", "e", "ê", "e", "í", "i",
		"ó", "o", "ô", "o", "õ", "o", "ú", "u", "ç", "c")
	s := repl.Replace(strings.ToLower(strings.TrimSpace(name)))
	s = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

func (s *Servidor) adminCreateCollection(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}
	if !decode(w, r, &req) {
		return
	}
	name := strings.TrimSpace(req.Name)
	slug := slugFrom(name)
	if utf8.RuneCountInString(name) < 2 || utf8.RuneCountInString(name) > 60 || !collectionSlugRe.MatchString(slug) {
		responder(w, http.StatusBadRequest, mapa{"error": "Dê um nome de 2 a 60 letras"})
		return
	}
	id, err := s.db.CreateCollection(r.Context(), slug, name)
	if errors.Is(err, db.ErrDuplicate) {
		responder(w, http.StatusConflict, mapa{"error": "Já existe uma coleção com esse nome"})
		return
	}
	if err != nil {
		s.falha(w, err, "criar a coleção")
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true, "id": id, "slug": slug})
}

func (s *Servidor) adminUpdateCollection(w http.ResponseWriter, r *http.Request) {
	var u db.CollectionUpdate
	if !decode(w, r, &u) {
		return
	}
	u.Name, u.Tagline, u.Description = strings.TrimSpace(u.Name), strings.TrimSpace(u.Tagline), strings.TrimSpace(u.Description)
	switch {
	case utf8.RuneCountInString(u.Name) < 2 || utf8.RuneCountInString(u.Name) > 60:
		responder(w, http.StatusBadRequest, mapa{"error": "O nome precisa ter de 2 a 60 letras"})
		return
	case utf8.RuneCountInString(u.Tagline) > 90 || utf8.RuneCountInString(u.Description) > 600:
		responder(w, http.StatusBadRequest, mapa{"error": "Frase até 90 e descrição até 600 caracteres"})
		return
	case !imagemPropria(u.Image):
		responder(w, http.StatusBadRequest, mapa{"error": "Use uma foto enviada pelo painel"})
		return
	}
	ok, err := s.db.UpdateCollection(r.Context(), r.PathValue("id"), u)
	s.okOuNaoAchou(w, ok, err, "salvar a coleção", "Coleção não encontrada")
}

func (s *Servidor) adminDeleteCollection(w http.ResponseWriter, r *http.Request) {
	ok, err := s.db.DeleteCollection(r.Context(), r.PathValue("id"))
	s.okOuNaoAchou(w, ok, err, "excluir a coleção", "Coleção não encontrada")
}

func (s *Servidor) adminSetCollectionProducts(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProductIDs []string `json:"product_ids"`
	}
	if !decode(w, r, &req) {
		return
	}
	if len(req.ProductIDs) > 200 {
		responder(w, http.StatusBadRequest, mapa{"error": "No máximo 200 peças por coleção"})
		return
	}
	if err := s.db.SetCollectionProducts(r.Context(), r.PathValue("id"), req.ProductIDs); err != nil {
		s.falha(w, err, "salvar as peças da coleção")
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

// adminImportLink traz UMA peça da Lilly pelo link da página dela (ou devolve
// a que já está na loja). É chamada uma vez por link, para o painel mostrar o
// progresso e para o ritmo de leitura ficar gentil com o site da fornecedora.
func (s *Servidor) adminImportLink(w http.ResponseWriter, r *http.Request) {
	var req struct {
		URL string `json:"url"`
	}
	if !decode(w, r, &req) {
		return
	}
	link, err := lilly.ProductURL(req.URL)
	if err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": err.Error()})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
	defer cancel()

	if id, err := s.db.ProductIDBySupplierURL(ctx, link); err != nil {
		s.falha(w, err, "conferir a peça")
		return
	} else if id != "" {
		responder(w, http.StatusOK, mapa{"product_id": id, "created": false})
		return
	}

	supplierID, _, ratio, err := s.db.ActiveSupplier(ctx)
	if err != nil {
		s.falha(w, err, "achar a fornecedora")
		return
	}
	if ratio <= 0 {
		ratio = lilly.DefaultWholesaleRatio
	}
	time.Sleep(lilly.PageDelay)
	html, err := s.li.FetchPage(ctx, link)
	if err != nil {
		responder(w, http.StatusBadGateway, mapa{"error": "Não consegui abrir a página da Lilly: " + err.Error()})
		return
	}
	p := lilly.Extract(html, link, ratio)
	if p == nil {
		responder(w, http.StatusUnprocessableEntity, mapa{"error": "Não consegui ler esta página como uma peça. O site da Lilly pode ter barrado as leituras seguidas — espere um pouco e tente de novo, com poucos links por vez"})
		return
	}
	if err := p.Validate(); err != nil {
		responder(w, http.StatusUnprocessableEntity, mapa{"error": "Peça recusada pelas salvaguardas: " + err.Error()})
		return
	}
	_, mirrorID, err := s.db.UpsertMirror(ctx, db.MirrorProduct{
		SupplierID: supplierID, SKU: p.SKU, URL: p.URL, Name: p.Name, Description: p.Description, Warranty: p.Warranty,
		Cost: p.Wholesale, Retail: p.Retail, CostConfirmed: p.WholesaleConfirmed, Available: p.Available, Images: p.Images,
		Rating: p.Rating, RatingCount: p.RatingCount, Reviews: toDBReviews(p.Reviews),
	})
	if err != nil {
		s.falha(w, err, "guardar a peça")
		return
	}
	settings, err := s.db.Settings(ctx)
	if err != nil {
		s.falha(w, err, "ler as regras")
		return
	}
	images := []string{}
	for i, src := range p.Images {
		if path, err := s.storage.SaveFromURL(ctx, imageHTTPClient, src, p.SKU, i+1); err == nil {
			images = append(images, path)
		}
	}
	if len(images) == 0 {
		responder(w, http.StatusBadGateway, mapa{"error": "Não consegui baixar as fotos da peça"})
		return
	}
	id, created, err := s.db.EnsureProduct(ctx, mirrorID, db.EnsureProductInput{
		Settings: settings, Available: p.Available, ForceCreate: true,
		SKU: p.SKU, Name: p.Name, Description: p.Description, Cost: p.Wholesale,
		Category: s.categoryGuesser(ctx)(p.Name), Metal: lilly.GuessMetal(p.Name), Images: images,
		Rating: p.Rating, RatingCount: p.RatingCount, Reviews: toDBReviews(p.Reviews),
		VariantLabel: p.VariantLabel, Variants: p.Variants,
	})
	if err != nil {
		s.falha(w, err, "publicar a peça")
		return
	}
	s.log.Info("peça importada por link", "sku", p.SKU, "nome", p.Name)
	responder(w, http.StatusOK, mapa{"product_id": id, "created": created, "name": p.Name})
}
