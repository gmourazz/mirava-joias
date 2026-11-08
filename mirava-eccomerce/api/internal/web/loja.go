package web

// Rotas do design v5 completo: loja (categorias, banners, galeria,
// novidades, cupons da cliente, esqueci minha senha) e painel
// (configurações, categorias, promoções, kits, banners, galeria, uploads,
// produto manual, fila da Lilly, sincronizar agora, clientes, sacolas,
// textos das automações e equipe). Decisões 21, 27 e 32 a 35.

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mirava/api/internal/auth"
	"github.com/mirava/api/internal/db"
	"github.com/mirava/api/internal/dominio"
	"github.com/mirava/api/internal/lilly"
	"github.com/mirava/api/internal/notificacao"
)

// WelcomeCoupon é o cupom do cadastro de novidades (decisão 34). As regras
// (10%, só primeira compra, uma vez por cliente) moram no próprio cupom, no
// banco — aqui é só o código que a tela mostra.
const WelcomeCoupon = "BEMVINDA10"

var emailRe = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)

// ---------------------------------------------------------------------------
// Loja
// ---------------------------------------------------------------------------

func (s *Servidor) categories(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.Categories(r.Context(), true)
	if err != nil {
		s.falha(w, err, "carregar as categorias")
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) banners(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.Banners(r.Context(), true)
	if err != nil {
		s.falha(w, err, "carregar os banners")
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) gallery(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.Gallery(r.Context())
	if err != nil {
		s.falha(w, err, "carregar a galeria")
		return
	}
	responder(w, http.StatusOK, list)
}

// subscribe: cadastro de novidades (pop-up, rodapé, cadastro de conta). Só
// manda o e-mail de boas-vindas na primeira vez; a resposta é a mesma sempre,
// com o cupom — quem já é cliente recebe o aviso de "só primeira compra" no
// checkout, que é quem decide.
func (s *Servidor) subscribe(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		WhatsApp string `json:"whatsapp"`
		Source   string `json:"source"`
	}
	if !decode(w, r, &req) {
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if !emailRe.MatchString(email) || len(email) > 200 {
		responder(w, http.StatusBadRequest, mapa{"error": "Informe um e-mail válido"})
		return
	}
	whatsapp := onlyDigits(req.WhatsApp)
	if whatsapp != "" && (len(whatsapp) < 10 || len(whatsapp) > 13) {
		responder(w, http.StatusBadRequest, mapa{"error": "Confira o número do WhatsApp"})
		return
	}
	source := req.Source
	switch source {
	case "popup", "rodape", "cadastro", "conta":
	default:
		source = "popup"
	}
	var userID *string
	if u, err := s.auth.DoRequest(r); err == nil {
		userID = &u.ID
	}
	created, err := s.db.Subscribe(r.Context(), email, whatsapp, source, userID)
	if err != nil {
		s.falha(w, err, "salvar seu cadastro")
		return
	}
	if created {
		s.notif.Avisar(r.Context(), notificacao.BoasVindas, notificacao.Pedido{
			Email: email, Cupom: WelcomeCoupon, URLAcao: s.cfg.SiteURL, TextoAcao: "Ver as joias",
		})
	}
	responder(w, http.StatusOK, mapa{"ok": true, "coupon": WelcomeCoupon})
}

func onlyDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func (s *Servidor) myCoupons(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
		return
	}
	list, err := s.db.CouponsForCustomer(r.Context(), user.ID)
	if err != nil {
		s.falha(w, err, "carregar seus cupons")
		return
	}
	responder(w, http.StatusOK, list)
}

// forgotPassword responde igual exista ou não a conta — não dá para usar a
// tela para descobrir quem é cliente. O token vai só por e-mail; no banco
// fica o hash dele, com validade de 1 hora.
func (s *Servidor) forgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if !decode(w, r, &req) {
		return
	}
	resposta := mapa{"ok": true, "nota": "Se houver uma conta com esse e-mail, mandamos o link para criar uma senha nova."}
	userID, name, err := s.db.UserIDByEmail(r.Context(), strings.TrimSpace(req.Email))
	if err != nil {
		s.falha(w, err, "processar o pedido")
		return
	}
	if userID == "" {
		responder(w, http.StatusOK, resposta)
		return
	}
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		s.falha(w, err, "gerar o link")
		return
	}
	token := hex.EncodeToString(raw)
	if err := s.db.CreatePasswordReset(r.Context(), userID, hashToken(token), time.Now().Add(time.Hour)); err != nil {
		s.falha(w, err, "gerar o link")
		return
	}
	s.notif.Avisar(r.Context(), notificacao.RecuperarSenha, notificacao.Pedido{
		Nome: name, Email: strings.TrimSpace(req.Email),
		URLAcao: s.cfg.SiteURL + "/redefinir-senha?t=" + token, TextoAcao: "Criar nova senha",
	})
	responder(w, http.StatusOK, resposta)
}

func hashToken(t string) string {
	sum := sha256.Sum256([]byte(t))
	return hex.EncodeToString(sum[:])
}

func (s *Servidor) resetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if !decode(w, r, &req) {
		return
	}
	if auth.WeakPassword(req.Password) {
		responder(w, http.StatusBadRequest, mapa{"error": "Senha precisa ter pelo menos 8 caracteres"})
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		s.falha(w, err, "trocar a senha")
		return
	}
	ok, err := s.db.UsePasswordReset(r.Context(), hashToken(strings.TrimSpace(req.Token)), hash)
	if err != nil {
		s.falha(w, err, "trocar a senha")
		return
	}
	if !ok {
		responder(w, http.StatusBadRequest, mapa{"error": "Este link venceu ou já foi usado. Peça um novo."})
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

// ---------------------------------------------------------------------------
// Painel: configurações, categorias, mapeamento
// ---------------------------------------------------------------------------

func (s *Servidor) adminSettings(w http.ResponseWriter, r *http.Request) {
	st, err := s.db.Settings(r.Context())
	if err != nil {
		s.falha(w, err, "carregar as configurações")
		return
	}
	responder(w, http.StatusOK, st)
}

func (s *Servidor) adminSaveSettings(w http.ResponseWriter, r *http.Request) {
	var st db.StoreSettings
	if !decode(w, r, &st) {
		return
	}
	switch {
	case !dominio.ValidMarkup(st.DefaultMarkupPct):
		responder(w, http.StatusBadRequest, mapa{"error": fmt.Sprintf("O markup padrão precisa ficar entre %d%% e %d%%", dominio.MinMarkupPct, dominio.MaxMarkupPct)})
		return
	case st.MinMarginPct < 0 || st.MinMarginPct > 90:
		responder(w, http.StatusBadRequest, mapa{"error": "O lucro mínimo precisa ficar entre 0% e 90%"})
		return
	case st.OutOfStockAction != "show" && st.OutOfStockAction != "hide":
		responder(w, http.StatusBadRequest, mapa{"error": "Escolha o que fazer quando esgotar"})
		return
	case st.SyncEveryHours != 3 && st.SyncEveryHours != 6 && st.SyncEveryHours != 12 && st.SyncEveryHours != 24:
		responder(w, http.StatusBadRequest, mapa{"error": "Frequência: 3, 6, 12 ou 24 horas"})
		return
	case st.SenderState != "" && !regexp.MustCompile(`^[A-Z]{2}$`).MatchString(st.SenderState):
		responder(w, http.StatusBadRequest, mapa{"error": "UF do remetente com 2 letras maiúsculas"})
		return
	case st.GoalRevenue < 0 || st.GoalOrders < 0 || st.GoalProfit < 0:
		responder(w, http.StatusBadRequest, mapa{"error": "Metas não podem ser negativas"})
		return
	case st.GiftWrapCost < 0 || st.GiftWrapCost > 5000:
		responder(w, http.StatusBadRequest, mapa{"error": "Custo do embrulho entre R$ 0 e R$ 50"})
		return
	case strings.TrimSpace(st.StoreName) == "" || !emailRe.MatchString(st.StoreEmail):
		responder(w, http.StatusBadRequest, mapa{"error": "Nome da loja e e-mail de atendimento são obrigatórios"})
		return
	}
	if err := s.db.SaveSettings(r.Context(), st); err != nil {
		s.falha(w, err, "salvar as configurações")
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

func (s *Servidor) adminRecalculatePrices(w http.ResponseWriter, r *http.Request) {
	n, err := s.db.RecalculatePrices(r.Context())
	if err != nil {
		s.falha(w, err, "recalcular os preços")
		return
	}
	s.log.Info("preços recalculados pelo markup", "pecas", n)
	responder(w, http.StatusOK, mapa{"ok": true, "updated": n})
}

func (s *Servidor) adminCategories(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.Categories(r.Context(), false)
	if err != nil {
		s.falha(w, err, "carregar as categorias")
		return
	}
	responder(w, http.StatusOK, list)
}

var slugRe = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

func (s *Servidor) adminCreateCategory(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Slug  string `json:"slug"`
		Label string `json:"label"`
	}
	if !decode(w, r, &req) {
		return
	}
	label := strings.TrimSpace(req.Label)
	if !slugRe.MatchString(req.Slug) || utf8.RuneCountInString(label) < 2 || utf8.RuneCountInString(label) > 40 {
		responder(w, http.StatusBadRequest, mapa{"error": "Nome de 2 a 40 letras; o endereço só com letras minúsculas, números e hífen"})
		return
	}
	err := s.db.CreateCategory(r.Context(), req.Slug, label)
	if errors.Is(err, db.ErrDuplicate) {
		responder(w, http.StatusConflict, mapa{"error": "Já existe uma categoria com esse endereço"})
		return
	}
	if err != nil {
		s.falha(w, err, "criar a categoria")
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

func (s *Servidor) adminUpdateCategory(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Label     string   `json:"label"`
		Position  int      `json:"position"`
		MarkupPct *float64 `json:"markup_pct"`
	}
	if !decode(w, r, &req) {
		return
	}
	label := strings.TrimSpace(req.Label)
	if utf8.RuneCountInString(label) < 2 || utf8.RuneCountInString(label) > 40 {
		responder(w, http.StatusBadRequest, mapa{"error": "O nome precisa ter de 2 a 40 letras"})
		return
	}
	if req.MarkupPct != nil && !dominio.ValidMarkup(*req.MarkupPct) {
		responder(w, http.StatusBadRequest, mapa{"error": fmt.Sprintf("O markup precisa ficar entre %d%% e %d%%", dominio.MinMarkupPct, dominio.MaxMarkupPct)})
		return
	}
	ok, err := s.db.UpdateCategory(r.Context(), r.PathValue("slug"), label, req.Position, req.MarkupPct)
	switch {
	case err != nil:
		s.falha(w, err, "salvar a categoria")
	case !ok:
		responder(w, http.StatusNotFound, mapa{"error": "Categoria não encontrada"})
	default:
		responder(w, http.StatusOK, mapa{"ok": true})
	}
}

func (s *Servidor) adminDeleteCategory(w http.ResponseWriter, r *http.Request) {
	err := s.db.DeleteCategory(r.Context(), r.PathValue("slug"))
	switch {
	case errors.Is(err, db.ErrNotAllowed):
		responder(w, http.StatusConflict, mapa{"error": "Só dá para excluir categoria sem peças (e \"Outros\" fica sempre)"})
	case err != nil:
		s.falha(w, err, "excluir a categoria")
	default:
		responder(w, http.StatusOK, mapa{"ok": true})
	}
}

func (s *Servidor) adminMappings(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.CategoryMappings(r.Context())
	if err != nil {
		s.falha(w, err, "carregar o mapeamento")
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) adminSetMappings(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Items []db.CategoryMapping `json:"items"`
	}
	if !decode(w, r, &req) {
		return
	}
	if len(req.Items) > 100 {
		responder(w, http.StatusBadRequest, mapa{"error": "No máximo 100 palavras"})
		return
	}
	seen := map[string]bool{}
	for i, m := range req.Items {
		k := strings.ToLower(strings.TrimSpace(m.Keyword))
		if utf8.RuneCountInString(k) < 2 || utf8.RuneCountInString(k) > 40 || seen[k] {
			responder(w, http.StatusBadRequest, mapa{"error": "Cada palavra com 2 a 40 letras, sem repetir"})
			return
		}
		seen[k] = true
		req.Items[i].Keyword = k
	}
	if err := s.db.SetCategoryMappings(r.Context(), req.Items); err != nil {
		s.falha(w, err, "salvar o mapeamento (confira se as categorias existem)")
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

// ---------------------------------------------------------------------------
// Painel: promoções e kits (decisão 32)
// ---------------------------------------------------------------------------

func (s *Servidor) adminPromotions(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.Promotions(r.Context())
	if err != nil {
		s.falha(w, err, "carregar as promoções")
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) adminCreatePromotion(w http.ResponseWriter, r *http.Request) {
	var p db.Promotion
	if !decode(w, r, &p) {
		return
	}
	p.Name = strings.TrimSpace(p.Name)
	switch {
	case utf8.RuneCountInString(p.Name) < 2 || utf8.RuneCountInString(p.Name) > 60:
		responder(w, http.StatusBadRequest, mapa{"error": "Dê um nome de 2 a 60 letras"})
		return
	case p.Pct < 1 || p.Pct > dominio.MaxPromoPct:
		responder(w, http.StatusBadRequest, mapa{"error": "O desconto precisa ficar entre 1% e 30%"})
		return
	case !p.EndsAt.After(p.StartsAt):
		responder(w, http.StatusBadRequest, mapa{"error": "O fim precisa ser depois do início"})
		return
	}
	switch p.Scope {
	case "all":
		p.Category, p.ProductIDs = nil, []string{}
	case "category":
		if p.Category == nil || *p.Category == "" {
			responder(w, http.StatusBadRequest, mapa{"error": "Escolha a categoria"})
			return
		}
		p.ProductIDs = []string{}
	case "products":
		if len(p.ProductIDs) == 0 || len(p.ProductIDs) > 500 {
			responder(w, http.StatusBadRequest, mapa{"error": "Escolha de 1 a 500 peças"})
			return
		}
		p.Category = nil
	default:
		responder(w, http.StatusBadRequest, mapa{"error": "Escolha onde a promoção vale"})
		return
	}
	id, err := s.db.CreatePromotion(r.Context(), p)
	if err != nil {
		s.falha(w, err, "agendar a promoção")
		return
	}
	s.log.Info("promoção agendada", "nome", p.Name, "pct", p.Pct)
	responder(w, http.StatusOK, mapa{"ok": true, "id": id})
}

func (s *Servidor) adminDeletePromotion(w http.ResponseWriter, r *http.Request) {
	ok, err := s.db.DeletePromotion(r.Context(), r.PathValue("id"))
	s.okOuNaoAchou(w, ok, err, "excluir a promoção", "Promoção não encontrada")
}

func (s *Servidor) okOuNaoAchou(w http.ResponseWriter, ok bool, err error, oQue, naoAchou string) {
	switch {
	case err != nil:
		s.falha(w, err, oQue)
	case !ok:
		responder(w, http.StatusNotFound, mapa{"error": naoAchou})
	default:
		responder(w, http.StatusOK, mapa{"ok": true})
	}
}

func (s *Servidor) adminKits(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.Kits(r.Context())
	if err != nil {
		s.falha(w, err, "carregar os kits")
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) adminCreateKit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		A   string `json:"product_a"`
		B   string `json:"product_b"`
		Pct int    `json:"pct"`
	}
	if !decode(w, r, &req) {
		return
	}
	if req.A == "" || req.A == req.B {
		responder(w, http.StatusBadRequest, mapa{"error": "Escolha duas peças diferentes"})
		return
	}
	if req.Pct < 1 || req.Pct > dominio.MaxPromoPct {
		responder(w, http.StatusBadRequest, mapa{"error": "O desconto do kit precisa ficar entre 1% e 30%"})
		return
	}
	err := s.db.CreateKit(r.Context(), req.A, req.B, req.Pct)
	if errors.Is(err, db.ErrDuplicate) {
		responder(w, http.StatusConflict, mapa{"error": "Esse kit já existe"})
		return
	}
	if err != nil {
		s.falha(w, err, "criar o kit")
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

func (s *Servidor) adminToggleKit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Active bool `json:"active"`
	}
	if !decode(w, r, &req) {
		return
	}
	ok, err := s.db.SetKitActive(r.Context(), r.PathValue("id"), req.Active)
	s.okOuNaoAchou(w, ok, err, "salvar o kit", "Kit não encontrado")
}

func (s *Servidor) adminDeleteKit(w http.ResponseWriter, r *http.Request) {
	ok, err := s.db.DeleteKit(r.Context(), r.PathValue("id"))
	s.okOuNaoAchou(w, ok, err, "excluir o kit", "Kit não encontrado")
}

// ---------------------------------------------------------------------------
// Painel: banners, galeria e uploads (decisão 35)
// ---------------------------------------------------------------------------

// imagemPropria: só caminhos que a própria API serve — nada de URL de fora
// entrando no site pelo painel.
func imagemPropria(p *string) bool {
	return p == nil || *p == "" || strings.HasPrefix(*p, "/images/")
}

// linkInterno: botões e links do painel só apontam para dentro da loja ou
// para o Instagram.
func linkInterno(u string) bool {
	return strings.HasPrefix(u, "/") && !strings.HasPrefix(u, "//") ||
		strings.HasPrefix(u, "https://www.instagram.com/") || strings.HasPrefix(u, "https://instagram.com/")
}

func (s *Servidor) adminBanners(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.Banners(r.Context(), false)
	if err != nil {
		s.falha(w, err, "carregar os banners")
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) adminSetBanners(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Items []db.Banner `json:"items"`
	}
	if !decode(w, r, &req) {
		return
	}
	if len(req.Items) > 8 {
		responder(w, http.StatusBadRequest, mapa{"error": "No máximo 8 banners"})
		return
	}
	for i, b := range req.Items {
		b.Title, b.Eyebrow, b.Subtitle, b.CTALabel = strings.TrimSpace(b.Title), strings.TrimSpace(b.Eyebrow),
			strings.TrimSpace(b.Subtitle), strings.TrimSpace(b.CTALabel)
		if b.CTAURL == "" {
			b.CTAURL = "/categoria/colecoes/todos"
		}
		switch {
		case utf8.RuneCountInString(b.Title) < 2 || utf8.RuneCountInString(b.Title) > 90:
			responder(w, http.StatusBadRequest, mapa{"error": "Título do banner com 2 a 90 letras"})
			return
		case utf8.RuneCountInString(b.Eyebrow) > 40 || utf8.RuneCountInString(b.Subtitle) > 200 || utf8.RuneCountInString(b.CTALabel) > 30:
			responder(w, http.StatusBadRequest, mapa{"error": "Texto do banner comprido demais"})
			return
		case !imagemPropria(b.Image) || !linkInterno(b.CTAURL):
			responder(w, http.StatusBadRequest, mapa{"error": "Use uma foto enviada pelo painel e um link da própria loja"})
			return
		}
		if b.CTALabel == "" {
			b.CTALabel = "Ver peças"
		}
		req.Items[i] = b
	}
	if err := s.db.SetBanners(r.Context(), req.Items); err != nil {
		s.falha(w, err, "salvar os banners")
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

func (s *Servidor) adminSetGallery(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Items []db.GalleryImage `json:"items"`
	}
	if !decode(w, r, &req) {
		return
	}
	if len(req.Items) > 12 {
		responder(w, http.StatusBadRequest, mapa{"error": "No máximo 12 fotos"})
		return
	}
	for _, g := range req.Items {
		img := g.Image
		if img == "" || !imagemPropria(&img) || (g.Link != nil && *g.Link != "" && !linkInterno(*g.Link)) {
			responder(w, http.StatusBadRequest, mapa{"error": "Use fotos enviadas pelo painel e links da loja ou do Instagram"})
			return
		}
	}
	if err := s.db.SetGallery(r.Context(), req.Items); err != nil {
		s.falha(w, err, "salvar a galeria")
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

// adminUpload recebe uma foto (multipart, campo "arquivo") e devolve o caminho
// público. O tipo é conferido pelo conteúdo em storage.SaveUpload.
func (s *Servidor) adminUpload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 6<<20)
	f, _, err := r.FormFile("arquivo")
	if err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Envie uma foto de até 5 MB"})
		return
	}
	defer f.Close()
	path, err := s.storage.SaveUpload(f, r.URL.Query().Get("pasta"))
	if err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": err.Error()})
		return
	}
	responder(w, http.StatusOK, mapa{"path": path})
}

// ---------------------------------------------------------------------------
// Painel: produto manual, fila da Lilly, sincronizar agora
// ---------------------------------------------------------------------------

func (s *Servidor) adminCreateProduct(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string   `json:"name"`
		Description string   `json:"description"`
		Category    string   `json:"category"`
		Metal       string   `json:"metal"`
		CostCents   int      `json:"cost_cents"`
		MarkupPct   *float64 `json:"markup_pct"`
		Images      []string `json:"images"`
		Published   bool     `json:"published"`
	}
	if !decode(w, r, &req) {
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	switch {
	case utf8.RuneCountInString(req.Name) < 3:
		responder(w, http.StatusBadRequest, mapa{"error": "O nome precisa ter pelo menos 3 letras"})
		return
	case req.Metal != "prata" && req.Metal != "ouro":
		responder(w, http.StatusBadRequest, mapa{"error": "Escolha o banho"})
		return
	case req.CostCents <= 0 || req.CostCents > 50000:
		responder(w, http.StatusBadRequest, mapa{"error": "Informe o preço de atacado (até R$ 500)"})
		return
	case req.MarkupPct != nil && !dominio.ValidMarkup(*req.MarkupPct):
		responder(w, http.StatusBadRequest, mapa{"error": fmt.Sprintf("O markup precisa ficar entre %d%% e %d%%", dominio.MinMarkupPct, dominio.MaxMarkupPct)})
		return
	case len(req.Images) > 10:
		responder(w, http.StatusBadRequest, mapa{"error": "No máximo 10 fotos"})
		return
	case req.Published && len(req.Images) == 0:
		responder(w, http.StatusBadRequest, mapa{"error": "Para publicar, envie ao menos uma foto"})
		return
	}
	for _, img := range req.Images {
		if !imagemPropria(&img) {
			responder(w, http.StatusBadRequest, mapa{"error": "Use fotos enviadas pelo painel"})
			return
		}
	}
	if req.Images == nil {
		req.Images = []string{}
	}
	id, err := s.db.CreateManualProduct(r.Context(), db.NewManualProduct{
		Name: req.Name, Description: strings.TrimSpace(req.Description), Category: req.Category, Metal: req.Metal,
		Cost: dominio.Cents(req.CostCents), MarkupPct: req.MarkupPct, Images: req.Images, Published: req.Published,
	})
	if err != nil {
		s.falha(w, err, "criar a peça (confira a categoria)")
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true, "id": id})
}

func (s *Servidor) categoryGuesser(ctx context.Context) func(string) string {
	var mappings []lilly.CategoryKeyword
	if ms, err := s.db.CategoryMappings(ctx); err == nil {
		for _, m := range ms {
			mappings = append(mappings, lilly.CategoryKeyword{Keyword: m.Keyword, Category: m.Category})
		}
	}
	return func(name string) string { return lilly.GuessCategoryWith(name, mappings) }
}

func (s *Servidor) adminQueue(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.SupplierQueue(r.Context(), s.categoryGuesser(r.Context()))
	if err != nil {
		s.falha(w, err, "carregar os novos da Lilly")
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) adminIgnoreQueued(w http.ResponseWriter, r *http.Request) {
	ok, err := s.db.IgnoreSupplierProduct(r.Context(), r.PathValue("id"))
	s.okOuNaoAchou(w, ok, err, "ignorar a peça", "Peça não encontrada na fila")
}

// importMirror cria a peça na loja a partir do espelho, baixando as fotos.
// Tamanhos chegam na próxima sincronização (o espelho não guarda variantes).
func (s *Servidor) importMirror(ctx context.Context, id string, guess func(string) string) error {
	m, err := s.db.MirrorByID(ctx, id)
	if err != nil {
		return err
	}
	if m == nil {
		return db.ErrNotAllowed
	}
	settings, err := s.db.Settings(ctx)
	if err != nil {
		return err
	}
	images := []string{}
	for i, src := range m.Images {
		if path, err := s.storage.SaveFromURL(ctx, imageHTTPClient, src, m.SKU, i+1); err == nil {
			images = append(images, path)
		}
	}
	if len(images) == 0 {
		return errors.New("não consegui baixar as fotos da Lilly")
	}
	_, _, err = s.db.EnsureProduct(ctx, id, db.EnsureProductInput{
		Settings: settings, Available: m.Available, ForceCreate: true,
		SKU: m.SKU, Name: m.Name, Description: m.Description, Cost: m.Cost,
		Category: guess(m.Name), Metal: lilly.GuessMetal(m.Name), Images: images,
		Rating: m.Rating, RatingCount: m.RatingCount, Reviews: []db.Review{},
	})
	return err
}

func (s *Servidor) adminImportQueued(w http.ResponseWriter, r *http.Request) {
	err := s.importMirror(r.Context(), r.PathValue("id"), s.categoryGuesser(r.Context()))
	switch {
	case errors.Is(err, db.ErrNotAllowed):
		responder(w, http.StatusNotFound, mapa{"error": "Peça não encontrada na fila"})
	case err != nil:
		s.log.Error("falha ao importar da Lilly", "erro", err)
		responder(w, http.StatusBadGateway, mapa{"error": "Não consegui importar: " + err.Error()})
	default:
		responder(w, http.StatusOK, mapa{"ok": true})
	}
}

// adminImportAll importa a fila inteira em segundo plano (cada peça baixa
// fotos; com muitas, não cabe numa requisição).
func (s *Servidor) adminImportAll(w http.ResponseWriter, r *http.Request) {
	ctx := context.WithoutCancel(r.Context())
	guess := s.categoryGuesser(ctx)
	list, err := s.db.SupplierQueue(ctx, guess)
	if err != nil {
		s.falha(w, err, "carregar a fila")
		return
	}
	responder(w, http.StatusAccepted, mapa{"ok": true, "queued": len(list)})
	go func() {
		ok := 0
		for _, q := range list {
			itemCtx, cancel := context.WithTimeout(ctx, 40*time.Second)
			if err := s.importMirror(itemCtx, q.ID, guess); err != nil {
				s.log.Warn("falha ao importar da fila", "sku", q.SKU, "erro", err)
			} else {
				ok++
			}
			cancel()
			time.Sleep(lilly.PageDelay)
		}
		s.log.Info("fila da Lilly importada", "importadas", ok, "de", len(list))
	}()
}

// adminSyncNow: botão "sincronizar agora". O próprio runSync tem a trava que
// impede duas leituras ao mesmo tempo (db.ErrSyncRunning).
func (s *Servidor) adminSyncNow(w http.ResponseWriter, r *http.Request) {
	s.syncCatalog(w, r)
}

// adminTestConnection: lê o sitemap da Lilly e diz quantas peças achou.
func (s *Servidor) adminTestConnection(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	entries, err := s.li.ReadSitemap(ctx)
	if err != nil {
		responder(w, http.StatusOK, mapa{"ok": false, "error": err.Error()})
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true, "urls": len(entries)})
}

// syncIfDue: a tarefa agendada roda a cada hora e só sincroniza quando
// passou a frequência escolhida no painel (3, 6, 12 ou 24 horas).
func (s *Servidor) syncIfDue(w http.ResponseWriter, r *http.Request) {
	st, err := s.db.Settings(r.Context())
	if err != nil {
		s.falha(w, err, "ler a frequência")
		return
	}
	last, err := s.db.LastSyncStarted(r.Context())
	if err != nil {
		s.falha(w, err, "ler a última sincronização")
		return
	}
	if last != nil && time.Since(*last) < time.Duration(st.SyncEveryHours)*time.Hour-5*time.Minute {
		responder(w, http.StatusOK, mapa{"ok": true, "nota": "ainda não deu a hora"})
		return
	}
	s.syncCatalog(w, r)
}

// ---------------------------------------------------------------------------
// Painel: clientes, sacolas, avise-me manual, novidades
// ---------------------------------------------------------------------------

func (s *Servidor) adminCustomerNotes(w http.ResponseWriter, r *http.Request) {
	n, err := s.db.CustomerNotes(r.Context(), r.PathValue("id"))
	if err != nil {
		s.falha(w, err, "carregar as anotações")
		return
	}
	responder(w, http.StatusOK, n)
}

func (s *Servidor) adminSaveCustomerNotes(w http.ResponseWriter, r *http.Request) {
	var n db.CustomerNotes
	if !decode(w, r, &n) {
		return
	}
	if utf8.RuneCountInString(n.Notes) > 2000 || len(n.Tags) > 10 {
		responder(w, http.StatusBadRequest, mapa{"error": "Até 10 etiquetas e 2000 caracteres de anotação"})
		return
	}
	tags := []string{}
	for _, t := range n.Tags {
		if t = strings.TrimSpace(t); t != "" && utf8.RuneCountInString(t) <= 24 {
			tags = append(tags, t)
		}
	}
	n.Tags = tags
	if err := s.db.SaveCustomerNotes(r.Context(), r.PathValue("id"), n); err != nil {
		s.falha(w, err, "salvar as anotações")
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

// adminSendCoupon manda por e-mail um cupom que já existe e está ativo.
func (s *Servidor) adminSendCoupon(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code string `json:"code"`
	}
	if !decode(w, r, &req) {
		return
	}
	code := dominio.NormalizeCouponCode(req.Code)
	c, _, err := s.db.CouponByCode(r.Context(), code)
	if err != nil {
		s.falha(w, err, "ler o cupom")
		return
	}
	if c == nil || !c.Active {
		responder(w, http.StatusBadRequest, mapa{"error": "Cupom não encontrado ou desligado"})
		return
	}
	email, name, err := s.db.UserEmailName(r.Context(), r.PathValue("id"))
	if err != nil || email == "" {
		responder(w, http.StatusNotFound, mapa{"error": "Cliente não encontrada"})
		return
	}
	if !s.notif.Ativo() {
		responder(w, http.StatusServiceUnavailable, mapa{"error": "O envio de e-mail ainda não está configurado"})
		return
	}
	s.notif.Avisar(r.Context(), notificacao.CupomEnviado, notificacao.Pedido{
		Nome: name, Email: email, Cupom: code, URLAcao: s.cfg.SiteURL, TextoAcao: "Escolher minha peça",
	})
	responder(w, http.StatusOK, mapa{"ok": true})
}

func (s *Servidor) adminCarts(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.AdminCarts(r.Context())
	if err != nil {
		s.falha(w, err, "carregar as sacolas")
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) adminRemindCart(w http.ResponseWriter, r *http.Request) {
	if !s.notif.Ativo() {
		responder(w, http.StatusServiceUnavailable, mapa{"error": "O envio de e-mail ainda não está configurado"})
		return
	}
	name, email, err := s.db.MarkCartNotified(r.Context(), r.PathValue("id"))
	if err != nil {
		s.falha(w, err, "mandar o lembrete")
		return
	}
	if email == "" {
		responder(w, http.StatusNotFound, mapa{"error": "Sacola vazia ou não encontrada"})
		return
	}
	p := notificacao.Pedido{Nome: name, Email: email, URLAcao: s.cfg.SiteURL + "/checkout", TextoAcao: "Voltar para a sacola"}
	s.aplicarTexto(r.Context(), "abandoned_cart", &p)
	s.notif.Avisar(r.Context(), notificacao.CarrinhoAbandonado, p)
	responder(w, http.StatusOK, mapa{"ok": true})
}

func (s *Servidor) adminNotifyStock(w http.ResponseWriter, r *http.Request) {
	if !s.notif.Ativo() {
		responder(w, http.StatusServiceUnavailable, mapa{"error": "O envio de e-mail ainda não está configurado"})
		return
	}
	list, err := s.db.StockAlertsNow(r.Context(), r.PathValue("id"))
	if err != nil {
		s.falha(w, err, "avisar as clientes")
		return
	}
	for _, n := range list {
		p := notificacao.Pedido{Email: n.Email, Produto: n.Product, URLAcao: s.cfg.SiteURL + "/produto/" + n.Slug, TextoAcao: "Ver a peça"}
		s.aplicarTexto(r.Context(), "stock_alert", &p)
		s.notif.Avisar(r.Context(), notificacao.VoltouAoEstoque, p)
	}
	responder(w, http.StatusOK, mapa{"ok": true, "sent": len(list)})
}

func (s *Servidor) adminSubscribers(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.Subscribers(r.Context())
	if err != nil {
		s.falha(w, err, "carregar os cadastros")
		return
	}
	responder(w, http.StatusOK, list)
}

// ---------------------------------------------------------------------------
// Painel: textos das automações
// ---------------------------------------------------------------------------

// aplicarTexto põe o texto editado no painel (se houver) no aviso.
func (s *Servidor) aplicarTexto(ctx context.Context, key string, p *notificacao.Pedido) {
	texts, err := s.db.AutomationTexts(ctx)
	if err != nil {
		return
	}
	if t, ok := texts[key]; ok {
		p.AssuntoPersonalizado, p.MioloPersonalizado = t.Subject, t.Body
	}
}

func (s *Servidor) adminAutomationTexts(w http.ResponseWriter, r *http.Request) {
	texts, err := s.db.AutomationTexts(r.Context())
	if err != nil {
		s.falha(w, err, "carregar os textos")
		return
	}
	responder(w, http.StatusOK, texts)
}

func (s *Servidor) adminSetAutomationText(w http.ResponseWriter, r *http.Request) {
	var t db.AutomationText
	if !decode(w, r, &t) {
		return
	}
	t.Subject, t.Body = strings.TrimSpace(t.Subject), strings.TrimSpace(t.Body)
	if utf8.RuneCountInString(t.Subject) > 120 || utf8.RuneCountInString(t.Body) > 2000 {
		responder(w, http.StatusBadRequest, mapa{"error": "Assunto até 120 e mensagem até 2000 caracteres"})
		return
	}
	ok, err := s.db.SetAutomationText(r.Context(), r.PathValue("key"), t)
	s.okOuNaoAchou(w, ok, err, "salvar o texto", "Automação não encontrada")
}

// adminTestAutomation manda a automação, com dados de exemplo, para o e-mail
// de quem está no painel.
func (s *Servidor) adminTestAutomation(w http.ResponseWriter, r *http.Request) {
	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "não autenticado"})
		return
	}
	if !s.notif.Ativo() {
		responder(w, http.StatusServiceUnavailable, mapa{"error": "O envio de e-mail ainda não está configurado"})
		return
	}
	key := r.PathValue("key")
	eventos := map[string]notificacao.Evento{
		"payment_reminder": notificacao.PagamentoPendente, "abandoned_cart": notificacao.CarrinhoAbandonado,
		"review_request": notificacao.PedirAvaliacao, "stock_alert": notificacao.VoltouAoEstoque,
		"return_update": notificacao.TrocaAtualizada,
	}
	ev, ok := eventos[key]
	if !ok {
		responder(w, http.StatusNotFound, mapa{"error": "Automação não encontrada"})
		return
	}
	p := notificacao.Pedido{Numero: 1042, Nome: "Marina Alves", Email: user.Email, Produto: "Anel Solitário Aura",
		Total: 12990, Etapa: "Aguardando envio", Cupom: WelcomeCoupon, URLAcao: s.cfg.SiteURL, TextoAcao: "Ver na loja"}
	s.aplicarTexto(r.Context(), key, &p)
	s.notif.Avisar(r.Context(), ev, p)
	responder(w, http.StatusOK, mapa{"ok": true, "to": user.Email})
}

// ---------------------------------------------------------------------------
// Painel: equipe e papéis (decisão 27)
// ---------------------------------------------------------------------------

// dispatchAllowed: o que o papel "despacho" pode abrir — pedidos, lotes e o
// próprio acesso. O resto (preço, financeiro, clientes, configurações) é da
// dona.
func dispatchAllowed(path string) bool {
	// Devolver dinheiro é da dona, mesmo dentro de pedidos.
	if strings.HasSuffix(path, "/reembolsar") {
		return false
	}
	for _, p := range []string{"/admin/eu", "/admin/pedidos", "/admin/lotes"} {
		if path == p || strings.HasPrefix(path, p+"/") {
			return true
		}
	}
	return false
}

func (s *Servidor) adminTeam(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.Team(r.Context())
	if err != nil {
		s.falha(w, err, "carregar a equipe")
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) adminAddTeam(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if !decode(w, r, &req) {
		return
	}
	err := s.db.AddTeamMember(r.Context(), strings.TrimSpace(req.Email))
	switch {
	case errors.Is(err, db.ErrNotAllowed):
		responder(w, http.StatusBadRequest, mapa{"error": "Essa pessoa precisa criar uma conta na loja antes (ou já tem acesso)"})
	case err != nil:
		s.falha(w, err, "dar acesso")
	default:
		responder(w, http.StatusOK, mapa{"ok": true})
	}
}

func (s *Servidor) adminRemoveTeam(w http.ResponseWriter, r *http.Request) {
	ok, err := s.db.RemoveTeamMember(r.Context(), r.PathValue("id"))
	s.okOuNaoAchou(w, ok, err, "tirar o acesso", "Só dá para tirar o acesso de quem é do despacho")
}

func (s *Servidor) adminOrderNotices(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.OrderNotices(r.Context(), r.PathValue("id"))
	if err != nil {
		s.falha(w, err, "carregar os avisos")
		return
	}
	responder(w, http.StatusOK, list)
}

func (s *Servidor) recentReviews(w http.ResponseWriter, r *http.Request) {
	list, err := s.db.RecentReviews(r.Context(), 6)
	if err != nil {
		s.falha(w, err, "carregar as avaliações")
		return
	}
	responder(w, http.StatusOK, list)
}
