// Package mercadopago fala com a API do Mercado Pago e valida os webhooks.
package mercadopago

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const api = "https://api.mercadopago.com"

type Cliente struct {
	token         string
	webhookSecret string
	http          *http.Client
}

func Novo(token, webhookSecret string) *Cliente {
	return &Cliente{
		token:         token,
		webhookSecret: webhookSecret,
		http:          &http.Client{Timeout: 20 * time.Second},
	}
}

// ---------------------------------------------------------------------------
// Preferência (Checkout Pro)
// ---------------------------------------------------------------------------

type Item struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	Quantity   int     `json:"quantity"`
	UnitPrice  float64 `json:"unit_price"` // a API espera REAIS, não centavos
	CurrencyID string  `json:"currency_id"`
}

type NovaPreferencia struct {
	PedidoID         string
	PedidoNumero     int
	Itens            []Item
	Email            string
	Nome             string
	SiteURL          string
	WebhookURL       string
	ParcelasSemJuros int
}

type Preferencia struct {
	ID               string `json:"id"`
	InitPoint        string `json:"init_point"`
	SandboxInitPoint string `json:"sandbox_init_point"`
}

func (c *Cliente) CriarPreferencia(ctx context.Context, p NovaPreferencia) (*Preferencia, error) {
	corpo := map[string]any{
		"items": p.Itens,
		"payer": map[string]string{"email": p.Email, "name": p.Nome},

		// A ligação entre pagamento e pedido. É por aqui que o webhook
		// descobre qual pedido confirmar.
		"external_reference": p.PedidoID,

		"notification_url":     p.WebhookURL,
		"statement_descriptor": "MIRAVA JOIAS",
		"back_urls": map[string]string{
			"success": fmt.Sprintf("%s/pedido/%s?status=sucesso", p.SiteURL, p.PedidoID),
			"pending": fmt.Sprintf("%s/pedido/%s?status=pendente", p.SiteURL, p.PedidoID),
			"failure": fmt.Sprintf("%s/pedido/%s?status=falha", p.SiteURL, p.PedidoID),
		},
		"auto_return": "approved",
		"payment_methods": map[string]any{
			// Acima do limite sem juros o custo sai do lucro: 12x custa
			// 12,49% contra 4,98% à vista. Ver PLANO.md, seção 9.
			"installments": p.ParcelasSemJuros,
			// Sem boleto: 3 dias de compensação atrasam o fechamento do lote.
			"excluded_payment_types": []map[string]string{{"id": "ticket"}},
		},
		"metadata": map[string]any{"pedido_numero": p.PedidoNumero},
	}

	b, _ := json.Marshal(corpo)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		api+"/checkout/preferences", bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")
	// Evita criar duas preferências se a requisição for repetida.
	req.Header.Set("X-Idempotency-Key", p.PedidoID)

	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode >= 300 {
		var msg bytes.Buffer
		msg.ReadFrom(res.Body)
		return nil, fmt.Errorf("mercado pago recusou (%d): %s", res.StatusCode, msg.String())
	}

	var pref Preferencia
	if err := json.NewDecoder(res.Body).Decode(&pref); err != nil {
		return nil, err
	}
	return &pref, nil
}

// ---------------------------------------------------------------------------
// Consulta de pagamento
//
// NUNCA decida que um pedido foi pago com base no corpo do webhook: ele pode
// ser forjado. O webhook entrega um ID; a verdade vem desta consulta.
// ---------------------------------------------------------------------------

type Pagamento struct {
	ID                int64  `json:"id"`
	Status            string `json:"status"` // approved | pending | rejected | refunded | cancelled
	StatusDetail      string `json:"status_detail"`
	PaymentMethodID   string `json:"payment_method_id"`
	PaymentTypeID     string `json:"payment_type_id"`
	Installments      int    `json:"installments"`
	TransactionAmount float64 `json:"transaction_amount"`
	ExternalReference string `json:"external_reference"`
	FeeDetails        []struct {
		Type   string  `json:"type"`
		Amount float64 `json:"amount"`
	} `json:"fee_details"`
	TransactionDetails struct {
		NetReceivedAmount float64 `json:"net_received_amount"`
	} `json:"transaction_details"`
}

func (c *Cliente) ConsultarPagamento(ctx context.Context, id string) (*Pagamento, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, api+"/v1/payments/"+id, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)

	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("consulta do pagamento %s falhou: HTTP %d", id, res.StatusCode)
	}

	var p Pagamento
	if err := json.NewDecoder(res.Body).Decode(&p); err != nil {
		return nil, err
	}
	return &p, nil
}

// ---------------------------------------------------------------------------
// Validação da assinatura do webhook
//
// Sem isto, qualquer pessoa que descubra a URL do webhook manda "pagamento
// aprovado" e a loja despacha joia de graça. É a defesa mais importante de
// todo o sistema.
//
// O Mercado Pago envia:
//   x-signature:  ts=1704908010,v1=<hmac-sha256 em hex>
//   x-request-id: <uuid>
// e assina o template:  id:<data.id>;request-id:<x-request-id>;ts:<ts>;
// ---------------------------------------------------------------------------

var reNumerico = regexp.MustCompile(`^[0-9]+$`)

// JanelaAssinatura limita replay de uma notificação capturada.
const JanelaAssinatura = 5 * time.Minute

func (c *Cliente) AssinaturaValida(h http.Header, dataID string, agora time.Time) error {
	if c.webhookSecret == "" {
		return fmt.Errorf("MP_WEBHOOK_SECRET não configurado")
	}

	assinatura := h.Get("X-Signature")
	requestID := h.Get("X-Request-Id")
	if assinatura == "" || requestID == "" {
		return fmt.Errorf("headers de assinatura ausentes")
	}

	var ts, v1 string
	for _, parte := range strings.Split(assinatura, ",") {
		chave, valor, ok := strings.Cut(strings.TrimSpace(parte), "=")
		if !ok {
			continue
		}
		switch strings.TrimSpace(chave) {
		case "ts":
			ts = strings.TrimSpace(valor)
		case "v1":
			v1 = strings.TrimSpace(valor)
		}
	}
	if ts == "" || v1 == "" {
		return fmt.Errorf("assinatura malformada")
	}

	segundos, err := strconv.ParseInt(ts, 10, 64)
	if err != nil {
		return fmt.Errorf("timestamp inválido")
	}
	if idade := agora.Sub(time.Unix(segundos, 0)); idade > JanelaAssinatura || idade < -JanelaAssinatura {
		return fmt.Errorf("notificação fora da janela de tempo (%s)", idade)
	}

	// IDs alfanuméricos entram em minúsculas no template.
	id := dataID
	if !reNumerico.MatchString(id) {
		id = strings.ToLower(id)
	}
	template := fmt.Sprintf("id:%s;request-id:%s;ts:%s;", id, requestID, ts)

	mac := hmac.New(sha256.New, []byte(c.webhookSecret))
	mac.Write([]byte(template))
	esperado := hex.EncodeToString(mac.Sum(nil))

	// hmac.Equal compara em tempo constante. Usar == vazaria informação pelo
	// tempo de execução e permitiria descobrir a assinatura byte a byte.
	if !hmac.Equal([]byte(esperado), []byte(v1)) {
		return fmt.Errorf("assinatura não confere")
	}
	return nil
}

// TaxaCentavos soma as taxas cobradas pelo Mercado Pago, em centavos.
func (p *Pagamento) TaxaCentavos() int64 {
	var total float64
	for _, f := range p.FeeDetails {
		total += f.Amount
	}
	return int64(total*100 + 0.5)
}
