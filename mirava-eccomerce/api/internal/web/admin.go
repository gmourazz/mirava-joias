package web

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/mirava/api/internal/db"
	"github.com/mirava/api/internal/dominio"
)

// Painel administrativo — visão de pedidos, receita e catálogo.
//
// Substitui o CRON_SECRET provisório que protegia /gestao/* (ver
// servidor.go): agora é sessão de verdade, e "admin" é quem está na tabela
// `admins` (nunca um campo em `users` que a própria cliente edita).

func (s *Servidor) dashboard(w http.ResponseWriter, r *http.Request) {
	stats, err := s.db.DashboardStats(r.Context(), s.cfg.PackagingCents)
	if err != nil {
		s.log.Error("falha ao montar painel", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar o painel"})
		return
	}
	responder(w, http.StatusOK, stats)
}

func (s *Servidor) listAllOrders(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	orders, err := s.db.AllOrders(r.Context(), status, 200)
	if err != nil {
		s.log.Error("falha ao listar pedidos (admin)", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar os pedidos"})
		return
	}
	responder(w, http.StatusOK, orders)
}

// ---------------------------------------------------------------------------
// Gestão de administradores — só "system" chega aqui (ver protegidoPorSystem
// em servidor.go). Promove conta que já existe; nunca cria conta nova por
// aqui, e nunca aceita papel vindo do corpo sem validar contra a lista fixa.
// ---------------------------------------------------------------------------

func (s *Servidor) listAdmins(w http.ResponseWriter, r *http.Request) {
	admins, err := s.db.ListAdmins(r.Context())
	if err != nil {
		s.log.Error("falha ao listar administradores", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar a lista"})
		return
	}
	responder(w, http.StatusOK, admins)
}

type addAdminRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

func (s *Servidor) addAdmin(w http.ResponseWriter, r *http.Request) {
	var req addAdminRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2<<10)).Decode(&req); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Requisição inválida"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if !reEmail.MatchString(email) {
		responder(w, http.StatusBadRequest, mapa{"error": "E-mail inválido"})
		return
	}
	role := req.Role
	if role != "system" && role != "admin" {
		responder(w, http.StatusBadRequest, mapa{"error": "Papel precisa ser \"system\" ou \"admin\""})
		return
	}

	if err := s.db.AddAdmin(r.Context(), email, role); err != nil {
		if errors.Is(err, db.ErrAdminUserNotFound) {
			responder(w, http.StatusNotFound, mapa{
				"error": "Não existe conta com esse e-mail. A pessoa precisa criar a conta dela no site primeiro."})
			return
		}
		s.log.Error("falha ao promover administrador", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui salvar"})
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

func (s *Servidor) removeAdmin(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	targetID := r.PathValue("userId")

	requester, err := s.auth.DoRequest(r)
	if err == nil && requester.ID == targetID {
		responder(w, http.StatusBadRequest, mapa{"error": "Você não pode remover a si mesma"})
		return
	}

	// Nunca deixa a loja sem nenhuma conta "system": sem isso, um clique
	// errado tira o acesso de todo mundo ao mesmo tempo, sem ninguém que
	// consiga devolver.
	targetRole, err := s.db.AdminRole(ctx, targetID)
	if err != nil {
		s.log.Error("falha ao checar papel do alvo", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Erro ao verificar"})
		return
	}
	if targetRole == "system" {
		n, err := s.db.CountSystemAdmins(ctx)
		if err != nil {
			s.log.Error("falha ao contar administradores system", "erro", err)
			responder(w, http.StatusInternalServerError, mapa{"error": "Erro ao verificar"})
			return
		}
		if n <= 1 {
			responder(w, http.StatusBadRequest, mapa{
				"error": "Esta é a única conta master — remova depois de promover outra pessoa"})
			return
		}
	}

	if err := s.db.RemoveAdmin(ctx, targetID); err != nil {
		s.log.Error("falha ao remover administrador", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui remover"})
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

// ---------------------------------------------------------------------------
// Detalhe do pedido e transição manual de status.
// ---------------------------------------------------------------------------

func (s *Servidor) adminOrderDetail(w http.ResponseWriter, r *http.Request) {
	order, err := s.db.AdminOrderDetail(r.Context(), r.PathValue("id"))
	if err != nil {
		s.log.Error("falha ao buscar pedido (admin)", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar o pedido"})
		return
	}
	if order == nil {
		responder(w, http.StatusNotFound, mapa{"error": "Pedido não encontrado"})
		return
	}
	responder(w, http.StatusOK, order)
}

type advanceStatusRequest struct {
	To string `json:"to"`
}

// advanceStatus é pra qualquer transição MENOS "shipped" — essa exige
// código de rastreio e continua passando por POST /gestao/pedidos/{id}/despachar
// (shipOrder), que já valida o formato dos Correios. Duplicar aquela regra
// aqui só criaria dois lugares pra ela divergir.
func (s *Servidor) advanceStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	orderID := r.PathValue("id")

	var req advanceStatusRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<10)).Decode(&req); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Requisição inválida"})
		return
	}
	to := dominio.Status(req.To)
	if to == dominio.Shipped {
		responder(w, http.StatusBadRequest, mapa{
			"error": "Postagem precisa do código de rastreio — use o despacho, não esta rota"})
		return
	}

	order, err := s.db.OrderByID(ctx, orderID)
	if err != nil {
		s.log.Error("falha ao buscar pedido para avançar status", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Erro ao buscar o pedido"})
		return
	}
	if order == nil {
		responder(w, http.StatusNotFound, mapa{"error": "Pedido não encontrado"})
		return
	}
	if !dominio.CanGo(order.Status, to) {
		responder(w, http.StatusConflict, mapa{
			"error": "Não dá pra ir de \"" + string(order.Status) + "\" pra \"" + string(to) + "\""})
		return
	}

	if err := s.db.AdminAdvanceStatus(ctx, orderID, order.Status, to); err != nil {
		if errors.Is(err, db.ErrStatusChanged) {
			responder(w, http.StatusConflict, mapa{"error": err.Error()})
			return
		}
		s.log.Error("falha ao avançar status", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui salvar"})
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}

// ---------------------------------------------------------------------------
// Lista de compra do lote aberto.
// ---------------------------------------------------------------------------

func (s *Servidor) shoppingList(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	batch, err := s.db.GetOpenBatch(ctx)
	if err != nil {
		s.log.Error("falha ao buscar lote aberto", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Erro ao buscar o lote"})
		return
	}
	if batch == nil {
		responder(w, http.StatusOK, mapa{"batch_id": nil, "items": []db.ShoppingItem{}})
		return
	}
	items, err := s.db.ShoppingList(ctx, batch.ID)
	if err != nil {
		s.log.Error("falha ao montar lista de compra", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Erro ao montar a lista"})
		return
	}
	responder(w, http.StatusOK, mapa{"batch_id": batch.ID, "items": items})
}

// ---------------------------------------------------------------------------
// Gestão de produtos.
// ---------------------------------------------------------------------------

func (s *Servidor) adminListProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	pending := q.Get("pending") == "true"
	products, err := s.db.AdminListProducts(r.Context(), q.Get("search"), pending, 200)
	if err != nil {
		s.log.Error("falha ao listar produtos (admin)", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui carregar os produtos"})
		return
	}
	responder(w, http.StatusOK, products)
}

func (s *Servidor) adminUpdateProduct(w http.ResponseWriter, r *http.Request) {
	var patch db.AdminProductPatch
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2<<10)).Decode(&patch); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Requisição inválida"})
		return
	}
	if patch.PriceCents != nil && *patch.PriceCents <= 0 {
		responder(w, http.StatusBadRequest, mapa{"error": "Preço precisa ser maior que zero"})
		return
	}
	if err := s.db.AdminUpdateProduct(r.Context(), r.PathValue("id"), patch); err != nil {
		s.log.Error("falha ao atualizar produto", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não consegui salvar"})
		return
	}
	responder(w, http.StatusOK, mapa{"ok": true})
}
