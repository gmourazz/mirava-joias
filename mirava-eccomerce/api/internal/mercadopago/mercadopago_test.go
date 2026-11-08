package mercadopago

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

const secret = "segredo-de-teste-do-webhook"

func sign(dataID, requestID string, ts int64) string {
	template := fmt.Sprintf("id:%s;request-id:%s;ts:%d;", dataID, requestID, ts)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(template))
	return hex.EncodeToString(mac.Sum(nil))
}

func headers(dataID, requestID string, ts int64, v1 string) http.Header {
	h := http.Header{}
	h.Set("X-Signature", fmt.Sprintf("ts=%d,v1=%s", ts, v1))
	h.Set("X-Request-Id", requestID)
	return h
}

// O caminho feliz: assinatura legítima do Mercado Pago passa.
func TestValidSignature(t *testing.T) {
	c := New("token", secret)
	now := time.Now()
	ts := now.Unix()

	h := headers("123456", "req-abc", ts, sign("123456", "req-abc", ts))
	if err := c.ValidSignature(h, "123456", now); err != nil {
		t.Errorf("assinatura legítima foi recusada: %v", err)
	}
}

// O ataque que esta função existe para bloquear: alguém descobre a URL do
// webhook e manda "pagamento aprovado" sem saber o segredo.
func TestForgedSignatureIsRejected(t *testing.T) {
	c := New("token", secret)
	now := time.Now()
	ts := now.Unix()

	h := headers("123456", "req-abc", ts, "deadbeef00000000000000000000000000000000000000000000000000000000")
	if err := c.ValidSignature(h, "123456", now); err == nil {
		t.Fatal("assinatura forjada foi aceita — a loja despacharia joia de graça")
	}
}

// Assinatura de outro pagamento não vale para este.
func TestSignatureFromAnotherPaymentIsRejected(t *testing.T) {
	c := New("token", secret)
	now := time.Now()
	ts := now.Unix()

	h := headers("999999", "req-abc", ts, sign("999999", "req-abc", ts))
	if err := c.ValidSignature(h, "123456", now); err == nil {
		t.Error("assinatura de outro pagamento foi aceita")
	}
}

// Replay: notificação capturada e reenviada horas depois.
func TestOldSignatureIsRejected(t *testing.T) {
	c := New("token", secret)
	now := time.Now()
	old := now.Add(-2 * time.Hour).Unix()

	h := headers("123456", "req-abc", old, sign("123456", "req-abc", old))
	if err := c.ValidSignature(h, "123456", now); err == nil {
		t.Error("notificação de 2 horas atrás foi aceita")
	}
}

func TestMissingSecretIsRejected(t *testing.T) {
	c := New("token", "")
	ts := time.Now().Unix()
	h := headers("1", "r", ts, "qualquer")
	if err := c.ValidSignature(h, "1", time.Now()); err == nil {
		t.Error("sem segredo configurado deveria recusar, nunca aceitar")
	}
}

func TestMissingHeaders(t *testing.T) {
	c := New("token", secret)
	if err := c.ValidSignature(http.Header{}, "1", time.Now()); err == nil {
		t.Error("sem headers deveria recusar")
	}
}

func TestFeeCents(t *testing.T) {
	p := &Payment{}
	p.FeeDetails = append(p.FeeDetails, struct {
		Type   string  `json:"type"`
		Amount float64 `json:"amount"`
	}{Type: "mercadopago_fee", Amount: 3.44})

	if got := p.FeeCents(); got != 344 {
		t.Errorf("FeeCents() = %d, esperado 344", got)
	}
}

// Decisão 33: o Mercado Pago abre só com a forma escolhida no checkout — o
// desconto do Pix não pode virar desconto num pagamento com cartão.
func TestTiposExcluidosPorForma(t *testing.T) {
	has := func(list []map[string]string, id string) bool {
		for _, m := range list {
			if m["id"] == id {
				return true
			}
		}
		return false
	}
	pix := ExcludedPaymentTypes("pix")
	if has(pix, "bank_transfer") || !has(pix, "credit_card") || !has(pix, "ticket") {
		t.Errorf("pix: %v", pix)
	}
	// O Mercado Pago recusa a preferência inteira com 400 ("account_money
	// cannot be excluded"): nenhuma escolha pode tirar o saldo em conta.
	for _, choice := range []string{"pix", "card", "boleto", ""} {
		if has(ExcludedPaymentTypes(choice), "account_money") {
			t.Errorf("%q exclui account_money", choice)
		}
	}
	card := ExcludedPaymentTypes("card")
	if has(card, "credit_card") || !has(card, "bank_transfer") || !has(card, "ticket") {
		t.Errorf("cartão: %v", card)
	}
	boleto := ExcludedPaymentTypes("boleto")
	if has(boleto, "ticket") || !has(boleto, "bank_transfer") || !has(boleto, "credit_card") {
		t.Errorf("boleto: %v", boleto)
	}
	if def := ExcludedPaymentTypes(""); !has(def, "ticket") || has(def, "credit_card") {
		t.Errorf("sem escolha mantém o antigo (sem boleto): %v", def)
	}
}

type transporte func(*http.Request) (*http.Response, error)

func (f transporte) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func resposta(status int, corpo string) *http.Response {
	return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(corpo)), Header: http.Header{}}
}

func TestRefundPayment(t *testing.T) {
	c := New("token", "segredo")
	var pedido *http.Request
	c.http = &http.Client{Transport: transporte(func(r *http.Request) (*http.Response, error) {
		pedido = r
		return resposta(201, `{"id":99,"status":"approved","amount":129.79}`), nil
	})}

	ref, err := c.RefundPayment(context.Background(), "123", "reembolso-pedido-1")
	if err != nil {
		t.Fatal(err)
	}
	if ref.ID != 99 {
		t.Errorf("id do estorno: %d", ref.ID)
	}
	if pedido.Method != http.MethodPost || !strings.HasSuffix(pedido.URL.Path, "/v1/payments/123/refunds") {
		t.Errorf("chamada errada: %s %s", pedido.Method, pedido.URL)
	}
	// A mesma chave em toda tentativa: clique duplo não devolve o dinheiro duas vezes.
	if pedido.Header.Get("X-Idempotency-Key") != "reembolso-pedido-1" {
		t.Errorf("sem chave de idempotência: %v", pedido.Header)
	}
	if pedido.Header.Get("Authorization") != "Bearer token" {
		t.Errorf("sem autorização")
	}
}

func TestRefundPaymentRecusado(t *testing.T) {
	c := New("token", "segredo")
	c.http = &http.Client{Transport: transporte(func(*http.Request) (*http.Response, error) {
		return resposta(400, `{"message":"insufficient_amount"}`), nil
	})}
	if _, err := c.RefundPayment(context.Background(), "123", "chave"); err == nil {
		t.Fatal("recusa do Mercado Pago precisa virar erro: o pedido não pode ficar como estornado")
	}
}
