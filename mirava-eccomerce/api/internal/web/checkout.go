package web

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/mirava/api/internal/db"
	"github.com/mirava/api/internal/dominio"
	"github.com/mirava/api/internal/mercadopago"
)

// A REGRA CENTRAL DESTE ARQUIVO:
// o front-end diz O QUE a cliente quer comprar; o servidor decide QUANTO custa.
//
// Nenhum preço vindo da requisição é usado em lugar nenhum. Se o checkout
// aceitasse preço do cliente, bastaria abrir o DevTools e trocar 6900 por 100
// para comprar a joia por um real — é a primeira coisa que se testa numa loja.

const maxItems = 30

type checkoutItemRequest struct {
	ProductID string `json:"product_id"`
	Size      string `json:"size"`
	Quantity  int    `json:"quantity"`
	// Repare que NÃO existe campo de preço aqui. É proposital.
}

type checkoutRequest struct {
	Items     []checkoutItemRequest `json:"items"`
	AddressID string                `json:"address_id"`
	Engraving string                `json:"engraving"`
	Phone     string                `json:"phone"`
	CPF       string                `json:"cpf"`
	// Qual opção de frete a cliente escolheu. Só o NOME do serviço vem daqui —
	// o preço é olhado na tabela do domínio, a partir do estado do endereço
	// salvo. Mandar "economico" num pedido de R$10 não torna o frete grátis.
	Shipping string `json:"shipping"`
	// Código do cupom de boas-vindas, opcional. O DESCONTO nunca vem daqui —
	// só o código; o valor é recalculado do zero a partir do banco, ver abaixo.
	CouponCode string `json:"coupon_code"`
}

func (s *Servidor) createPayment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Recusa cedo se o Mercado Pago não está configurado. Sem isto, o pedido
	// seria gravado no banco e só depois a criação da preferência falharia,
	// deixando pedido órfão em `awaiting_payment`.
	if !s.cfg.PaymentReady {
		s.log.Error("checkout chamado sem credenciais do Mercado Pago")
		responder(w, http.StatusServiceUnavailable, mapa{
			"error": "Pagamento indisponível no momento. Tente novamente em instantes."})
		return
	}

	user, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"error": "Faça login para finalizar a compra"})
		return
	}

	var req checkoutRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&req); err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Requisição inválida"})
		return
	}
	if len(req.Items) == 0 {
		responder(w, http.StatusBadRequest, mapa{"error": "Carrinho vazio"})
		return
	}
	if len(req.Items) > maxItems {
		responder(w, http.StatusBadRequest, mapa{"error": "Pedido com itens demais"})
		return
	}
	if req.AddressID == "" {
		responder(w, http.StatusBadRequest, mapa{"error": "Escolha um endereço de entrega"})
		return
	}

	// Endereço precisa ser da própria cliente — o filtro por user_id está
	// dentro da consulta.
	address, err := s.db.AddressForUser(ctx, user.ID, req.AddressID)
	if err != nil {
		responder(w, http.StatusBadRequest, mapa{"error": "Endereço não encontrado"})
		return
	}

	profile, _ := s.db.GetProfile(ctx, user.ID)

	ids := make([]string, 0, len(req.Items))
	seen := map[string]bool{}
	for _, i := range req.Items {
		if !seen[i.ProductID] {
			seen[i.ProductID] = true
			ids = append(ids, i.ProductID)
		}
	}

	// Preço REAL, do banco.
	products, err := s.db.ProductsForCheckout(ctx, ids)
	if err != nil {
		s.log.Error("falha ao buscar produtos", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Erro ao montar o pedido"})
		return
	}
	if len(products) != len(ids) {
		responder(w, http.StatusConflict, mapa{
			"error": "Alguma peça saiu do ar enquanto você comprava. Revise o carrinho."})
		return
	}

	var subtotal dominio.Cents
	orderItems := make([]db.OrderItem, 0, len(req.Items))
	mpItems := make([]mercadopago.Item, 0, len(req.Items))

	// Só isenta de frete quando o carrinho é SÓ o produto de teste — assim o
	// desconto some sozinho no dia em que você despublicar ele, sem precisar
	// lembrar de tirar esta linha depois.
	somenteTeste := true

	for _, item := range req.Items {
		p, ok := products[item.ProductID]
		if !ok {
			responder(w, http.StatusBadRequest, mapa{"error": "Produto inválido no carrinho"})
			return
		}
		if p.Slug != "peca-de-teste-mirava" {
			somenteTeste = false
		}
		if item.Quantity < 1 || item.Quantity > 10 {
			responder(w, http.StatusBadRequest, mapa{"error": "Quantidade inválida"})
			return
		}
		// A Lilly não publica quantidade em estoque, só se dá para comprar.
		if !p.Available {
			responder(w, http.StatusConflict, mapa{
				"error": fmt.Sprintf("%q está indisponível na fornecedora no momento.", p.Name)})
			return
		}

		var adjust dominio.Cents
		if item.Size != "" {
			a, available, err := s.db.VariantAdjustment(ctx, p.ID, item.Size)
			if err != nil {
				s.log.Error("falha ao ler variante", "erro", err)
				responder(w, http.StatusInternalServerError, mapa{"error": "Erro ao montar o pedido"})
				return
			}
			if !available {
				responder(w, http.StatusConflict, mapa{
					"error": fmt.Sprintf("Tamanho %s de %q está indisponível.", item.Size, p.Name)})
				return
			}
			adjust = a
		}

		unitPrice := p.Price + adjust
		subtotal += unitPrice * dominio.Cents(item.Quantity)

		title := p.Name
		if item.Size != "" {
			title += " · " + item.Size
		}

		orderItems = append(orderItems, db.OrderItem{
			ProductID: p.ID,
			Name:      p.Name, // congela: o nome pode mudar depois
			SKU:       p.SKU,  // para copiar no site da Lilly ao fechar o lote
			Size:      item.Size,
			Quantity:  item.Quantity,
			Price:     unitPrice,
			Cost:      p.Cost, // congela: sem isso o lucro histórico vira ficção
		})
		mpItems = append(mpItems, mercadopago.Item{
			ID: p.ID, Title: title, Quantity: item.Quantity,
			UnitPrice: unitPrice.ToReais(), CurrencyID: "BRL",
		})
	}

	// Frete: o serviço vem da requisição, o PREÇO vem da tabela do domínio,
	// calculado sobre o estado do endereço que já está salvo no banco — não
	// sobre nada que o front tenha mandado.
	service := dominio.NormalizeShippingService(dominio.ShippingService(req.Shipping))
	shipping := dominio.ShippingCost(address.State, subtotal, service)
	if somenteTeste {
		shipping = 0
	}

	// Cupom de boas-vindas: o código é o que a cliente digitou, mas o
	// DESCONTO é sempre recalculado aqui — igual ao preço da peça, nunca
	// aceito pronto do front.
	var discount dominio.Cents
	couponCode := strings.ToUpper(strings.TrimSpace(req.CouponCode))
	if couponCode != "" {
		if couponCode != dominio.WelcomeCouponCode {
			responder(w, http.StatusBadRequest, mapa{"error": "Cupom inválido"})
			return
		}
		eligible, err := s.db.WelcomeCouponEligible(ctx, user.ID)
		if err != nil {
			s.log.Error("falha ao checar cupom", "erro", err)
			responder(w, http.StatusInternalServerError, mapa{"error": "Erro ao aplicar o cupom"})
			return
		}
		if !eligible {
			responder(w, http.StatusBadRequest, mapa{"error": "Esse cupom já foi usado nesta conta"})
			return
		}
		discount = dominio.WelcomeCouponDiscount(subtotal)
	}

	total := subtotal + shipping - discount
	if total <= 0 {
		responder(w, http.StatusBadRequest, mapa{"error": "Total inválido"})
		return
	}

	name := profile.Name
	if name == "" {
		name = "Cliente"
	}
	phone := req.Phone
	if phone == "" {
		phone = profile.Phone
	}
	cpf := req.CPF
	if cpf == "" {
		cpf = profile.CPF
	}

	// Grava o pedido ANTES de chamar o Mercado Pago: se o MP falhar, fica
	// o rastro do que a cliente tentou fazer.
	orderID, number, err := s.db.CreateOrder(ctx, db.NewOrder{
		UserID: user.ID, Name: name, Email: user.Email,
		Phone: phone, CPF: cpf, Address: address,
		Subtotal: subtotal, Shipping: shipping, Discount: discount, Total: total,
		ShippingMethod: string(service),
		Engraving:      req.Engraving, Items: orderItems,
	})
	if err != nil {
		s.log.Error("falha ao criar pedido", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não foi possível criar o pedido"})
		return
	}

	pref, err := s.mp.CreatePreference(ctx, mercadopago.NewPreference{
		OrderID: orderID, OrderNumber: number, Items: mpItems,
		Email: user.Email, Name: name,
		SiteURL: s.cfg.SiteURL, WebhookURL: s.cfg.WebhookURL,
		InstallmentsNoInterest: s.cfg.InstallmentsNoInterest,
		ShippingCents:          int64(shipping),
	})
	if err != nil {
		s.log.Error("mercado pago recusou a preferência", "erro", err, "pedido", number)
		responder(w, http.StatusBadGateway, mapa{
			"error": "Não foi possível iniciar o pagamento. Tente de novo."})
		return
	}

	url := pref.InitPoint
	if s.cfg.TestMode {
		url = pref.SandboxInitPoint
	}

	responder(w, http.StatusOK, mapa{
		"order_id":       orderID,
		"number":         number,
		"subtotal_cents": int64(subtotal),
		"shipping_cents": int64(shipping),
		"discount_cents": int64(discount),
		"total_cents":    int64(total),
		"payment_url":    url,
	})
}
