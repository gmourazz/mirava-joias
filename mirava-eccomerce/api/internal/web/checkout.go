package web

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mirava/api/internal/auth"
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
//
// Cupom, pontos e embrulho seguem a mesma regra: a requisição só diz o
// CÓDIGO do cupom, SE quer usar pontos e SE quer embrulho. Quanto isso vale é
// o domínio que decide (dominio/descontos.go). A prévia da tela
// (POST /checkout/previa) e a cobrança (POST /checkout) usam a mesma função,
// priceCart — não existe uma conta para mostrar e outra para cobrar.

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

	// Decisão 31: cupom OU pontos; embrulho com mensagem.
	Coupon      string `json:"coupon"`
	UsePoints   bool   `json:"use_points"`
	GiftWrap    bool   `json:"gift_wrap"`
	GiftMessage string `json:"gift_message"`
	// Forma de pagamento escolhida aqui (decisão 33): "pix", "card" ou "boleto".
	PaymentChoice string `json:"payment_choice"`
}

type httpErr struct {
	status int
	msg    string
}

// cartPricing é o pedido calculado no servidor: o que a prévia mostra e o
// que o checkout grava e cobra.
type cartPricing struct {
	address  *db.Address
	items    []db.OrderItem
	mpItems  []mercadopago.Item
	service  dominio.ShippingService
	totals   dominio.Totals
	pricing  dominio.OrderPricing
	coupon   *dominio.Coupon
	earned   int
	balance  int
	clubFree bool
	choice   string
	giftMsg  string
	onlyTest bool
	// discountErr: o desconto pedido não vale (cupom vencido, poucos pontos).
	// Na prévia vira aviso e o resto segue; no checkout, recusa.
	discountErr string
}

func (s *Servidor) priceCart(ctx context.Context, user *auth.User, req checkoutRequest, needAddress bool) (*cartPricing, *httpErr) {
	if len(req.Items) == 0 {
		return nil, &httpErr{http.StatusBadRequest, "Carrinho vazio"}
	}
	if len(req.Items) > maxItems {
		return nil, &httpErr{http.StatusBadRequest, "Pedido com itens demais"}
	}

	p := &cartPricing{}
	if req.AddressID != "" {
		// Endereço precisa ser da própria cliente — o filtro por user_id está
		// dentro da consulta.
		a, err := s.db.AddressForUser(ctx, user.ID, req.AddressID)
		if err != nil {
			return nil, &httpErr{http.StatusBadRequest, "Endereço não encontrado"}
		}
		p.address = a
	} else if needAddress {
		return nil, &httpErr{http.StatusBadRequest, "Escolha um endereço de entrega"}
	}

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
		return nil, &httpErr{http.StatusInternalServerError, "Erro ao montar o pedido"}
	}
	if len(products) != len(ids) {
		return nil, &httpErr{http.StatusConflict, "Alguma peça saiu do ar enquanto você comprava. Revise o carrinho."}
	}

	// Só isenta de frete quando o carrinho é SÓ o produto de teste — assim o
	// desconto some sozinho no dia em que você despublicar ele, sem precisar
	// lembrar de tirar esta linha depois.
	p.onlyTest = true

	type linhaPedido struct {
		prod db.CheckoutProduct
		item checkoutItemRequest
	}
	var linhas []linhaPedido
	in := dominio.OrderPricingInput{Now: time.Now()}

	for _, item := range req.Items {
		prod, ok := products[item.ProductID]
		if !ok {
			return nil, &httpErr{http.StatusBadRequest, "Produto inválido no carrinho"}
		}
		if prod.Slug != "peca-de-teste-mirava" {
			p.onlyTest = false
		}
		if item.Quantity < 1 || item.Quantity > 10 {
			return nil, &httpErr{http.StatusBadRequest, "Quantidade inválida"}
		}
		// A Lilly não publica quantidade em estoque, só se dá para comprar.
		if !prod.Available {
			return nil, &httpErr{http.StatusConflict, fmt.Sprintf("%q está indisponível na fornecedora no momento.", prod.Name)}
		}

		var adjust dominio.Cents
		if item.Size != "" {
			a, available, err := s.db.VariantAdjustment(ctx, prod.ID, item.Size)
			if err != nil {
				s.log.Error("falha ao ler variante", "erro", err)
				return nil, &httpErr{http.StatusInternalServerError, "Erro ao montar o pedido"}
			}
			if !available {
				return nil, &httpErr{http.StatusConflict, fmt.Sprintf("Tamanho %s de %q está indisponível.", item.Size, prod.Name)}
			}
			adjust = a
		}

		linhas = append(linhas, linhaPedido{prod, item})
		in.Lines = append(in.Lines, dominio.OrderLine{
			ProductID: prod.ID, ListPrice: prod.Price + adjust,
			PromoPct: prod.PromoPct, Quantity: item.Quantity,
		})
	}

	// Kits "compre junto" com as duas peças na sacola (decisão 32).
	kits, err := s.db.ActiveKits(ctx, ids)
	if err != nil {
		s.log.Error("falha ao ler kits", "erro", err)
		return nil, &httpErr{http.StatusInternalServerError, "Erro ao montar o pedido"}
	}
	in.Kits = kits

	// Cupom OU pontos (decisão 31) e as regras por cliente (decisão 34).
	balance, earned, err := s.db.PointsBalance(ctx, user.ID)
	if err != nil {
		s.log.Error("falha ao ler saldo de pontos", "erro", err)
		return nil, &httpErr{http.StatusInternalServerError, "Erro ao montar o pedido"}
	}
	p.balance = balance
	p.clubFree = dominio.ClubFreeShipping(earned)
	in.UsePoints, in.PointsBalance = req.UsePoints, balance

	var couponErr string
	if code := dominio.NormalizeCouponCode(req.Coupon); code != "" {
		c, uses, err := s.db.CouponByCode(ctx, code)
		if err != nil {
			s.log.Error("falha ao ler cupom", "erro", err)
			return nil, &httpErr{http.StatusInternalServerError, "Erro ao montar o pedido"}
		}
		if c == nil {
			couponErr = "Cupom não encontrado. Confira o código."
		} else {
			cctx, err := s.db.CouponContextFor(ctx, user.ID, c.Code)
			if err != nil {
				s.log.Error("falha ao ler histórico da cliente", "erro", err)
				return nil, &httpErr{http.StatusInternalServerError, "Erro ao montar o pedido"}
			}
			in.Coupon, in.CouponUses, in.CouponCtx = c, uses, cctx
			p.coupon = c
		}
	}

	// Pix (decisão 33): a forma é escolhida aqui; o desconto só vale no Pix.
	switch req.PaymentChoice {
	case "pix", "card", "boleto":
		p.choice = req.PaymentChoice
	}
	in.Pix = p.choice == "pix"

	p.pricing = dominio.PriceOrder(in)
	p.discountErr = p.pricing.DiscountErr
	if couponErr != "" {
		p.discountErr = couponErr
	}

	for i, l := range linhas {
		priced := p.pricing.Lines[i]
		title := l.prod.Name
		if l.item.Size != "" {
			title += " · " + l.item.Size
		}
		p.items = append(p.items, db.OrderItem{
			ProductID: l.prod.ID,
			Name:      l.prod.Name, // congela: o nome pode mudar depois
			SKU:       l.prod.SKU,  // para copiar no site da Lilly ao fechar o lote
			Size:      l.item.Size,
			Quantity:  l.item.Quantity,
			Price:     priced.UnitPrice,
			ListPrice: priced.ListPrice,
			Cost:      l.prod.Cost, // congela: sem isso o lucro histórico vira ficção
		})
		p.mpItems = append(p.mpItems, mercadopago.Item{
			ID: l.prod.ID, Title: title, Quantity: l.item.Quantity,
			UnitPrice: priced.UnitPrice.ToReais(), CurrencyID: "BRL",
		})
	}

	// Frete: o serviço vem da requisição, o PREÇO vem da tabela do domínio,
	// calculado sobre o estado do endereço que já está salvo no banco — não
	// sobre nada que o front tenha mandado. Sem endereço (prévia), sem frete.
	// Nível Encanto do Club: PAC grátis (decisão 34).
	p.service = dominio.NormalizeShippingService(dominio.ShippingService(req.Shipping))
	var shipping dominio.Cents
	if p.address != nil && !p.onlyTest {
		shipping = dominio.ShippingCostFor(p.address.State, p.pricing.Subtotal, p.service, p.clubFree)
	}

	msg, err := dominio.GiftMessage(req.GiftMessage)
	if err != nil {
		return nil, &httpErr{http.StatusBadRequest, err.Error()}
	}
	if req.GiftWrap {
		p.giftMsg = msg
	}

	p.totals = dominio.OrderTotal(p.pricing.Subtotal, p.pricing.Discount, shipping, req.GiftWrap)
	p.earned = p.pricing.PointsEarned
	return p, nil
}

func (s *Servidor) checkoutPreview(w http.ResponseWriter, r *http.Request) {
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
	p, herr := s.priceCart(r.Context(), user, req, false)
	if herr != nil {
		responder(w, herr.status, mapa{"error": herr.msg})
		return
	}
	responder(w, http.StatusOK, mapa{
		"subtotal_cents":   p.totals.Subtotal,
		"discount_cents":   p.totals.Discount,
		"shipping_cents":   p.totals.Shipping,
		"gift_wrap_cents":  p.totals.GiftWrap,
		"total_cents":      p.totals.Total,
		"coupon_code":      p.pricing.CouponCode,
		"points_used":      p.pricing.PointsUsed,
		"points_earned":    p.earned,
		"points_balance":   p.balance,
		"discount_error":   p.discountErr,
		"max_discount_pct": dominio.MaxDiscountPct,
		// Composição (decisões 32-34), para a tela mostrar linha a linha.
		"list_subtotal_cents":   p.pricing.ListSubtotal,
		"kit_discount_cents":    p.pricing.KitDiscount,
		"coupon_discount_cents": p.pricing.CouponDiscount,
		"pix_discount_cents":    p.pricing.PixDiscount,
		"payment_choice":        p.choice,
		"club_free_shipping":    p.clubFree,
		"pix_discount_pct":      dominio.PixDiscountPct,
	})
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

	p, herr := s.priceCart(ctx, user, req, true)
	if herr != nil {
		responder(w, herr.status, mapa{"error": herr.msg})
		return
	}
	// No checkout, desconto pedido que não vale é recusa: a cliente viu na
	// prévia um total e precisa pagar o mesmo total.
	if p.discountErr != "" {
		responder(w, http.StatusConflict, mapa{"error": p.discountErr})
		return
	}
	if p.totals.Total <= 0 {
		responder(w, http.StatusBadRequest, mapa{"error": "Total inválido"})
		return
	}

	profile, _ := s.db.GetProfile(ctx, user.ID)
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
		Phone: phone, CPF: cpf, Address: p.address,
		Subtotal: p.totals.Subtotal, Shipping: p.totals.Shipping,
		Discount: p.totals.Discount, Total: p.totals.Total,
		ShippingMethod: string(p.service),
		Engraving:      req.Engraving, Items: p.items,
		CouponCode: p.pricing.CouponCode, PointsUsed: p.pricing.PointsUsed,
		PointsEarned: p.earned,
		GiftWrap:     req.GiftWrap, GiftMessage: p.giftMsg, GiftWrapCents: p.totals.GiftWrap,
		KitDiscount: p.pricing.KitDiscount, PixDiscount: p.pricing.PixDiscount,
		PaymentChoice:         p.choice,
		CouponFirstOrderOnly:  p.coupon != nil && p.coupon.FirstOrderOnly && p.pricing.CouponCode != "",
		CouponOncePerCustomer: p.coupon != nil && p.coupon.OncePerCustomer && p.pricing.CouponCode != "",
	})
	switch {
	case errors.Is(err, db.ErrPointsUnavailable):
		responder(w, http.StatusConflict, mapa{"error": "Seu saldo de pontos mudou. Revise o pedido."})
		return
	case errors.Is(err, db.ErrCouponExhausted):
		responder(w, http.StatusConflict, mapa{"error": "Este cupom acabou de atingir o limite de usos."})
		return
	case errors.Is(err, db.ErrCouponNotForYou):
		responder(w, http.StatusConflict, mapa{"error": "Este cupom vale só na primeira compra e uma vez por cliente."})
		return
	case err != nil:
		s.log.Error("falha ao criar pedido", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"error": "Não foi possível criar o pedido"})
		return
	}

	pref, err := s.mp.CreatePreference(ctx, mercadopago.NewPreference{
		OrderID: orderID, OrderNumber: number, Items: mpItemsFor(p, number),
		Email: user.Email, Name: name,
		SiteURL: s.cfg.SiteURL, WebhookURL: s.cfg.WebhookURL,
		InstallmentsNoInterest: s.cfg.InstallmentsNoInterest,
		ShippingCents:          int64(p.totals.Shipping),
		PaymentChoice:          p.choice,
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
		"subtotal_cents": int64(p.totals.Subtotal),
		"shipping_cents": int64(p.totals.Shipping),
		"total_cents":    int64(p.totals.Total),
		"payment_url":    url,
	})
}

// mpItemsFor monta os itens da cobrança no Mercado Pago. O MP soma os itens
// (mais o frete) para chegar no valor cobrado, e não aceita item negativo.
// Com desconto, as peças viram uma linha só, já com o desconto — senão a
// cliente pagaria o preço cheio e o webhook recusaria a diferença. O
// embrulho entra como linha própria.
func mpItemsFor(p *cartPricing, number int) []mercadopago.Item {
	items := p.mpItems
	if p.totals.Discount > 0 {
		items = []mercadopago.Item{{
			ID:         "pecas",
			Title:      strings.TrimSpace(fmt.Sprintf("Peças do pedido Mirava #%d (com desconto)", number)),
			Quantity:   1,
			UnitPrice:  (p.totals.Subtotal - p.totals.Discount).ToReais(),
			CurrencyID: "BRL",
		}}
	}
	if p.totals.GiftWrap > 0 {
		items = append(items, mercadopago.Item{
			ID: "embrulho", Title: "Embrulho para presente com cartão", Quantity: 1,
			UnitPrice: p.totals.GiftWrap.ToReais(), CurrencyID: "BRL",
		})
	}
	return items
}
