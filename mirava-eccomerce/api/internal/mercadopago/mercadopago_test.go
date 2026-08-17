package mercadopago

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
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
