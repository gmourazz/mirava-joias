package dominio

import (
	"testing"
	"time"
)

func TestEtapasDaTroca(t *testing.T) {
	cases := []struct {
		de, para ReturnStage
		ok       bool
	}{
		{ReturnRequested, ReturnAwaitingShipment, true},
		{ReturnAwaitingShipment, ReturnReceived, true},
		{ReturnReceived, ReturnDone, true},
		{ReturnRequested, ReturnRejected, true},
		{ReturnRequested, ReturnDone, false}, // não pula etapas
		{ReturnDone, ReturnRequested, false}, // concluída não volta
		{ReturnRejected, ReturnAwaitingShipment, false},
		{ReturnReceived, ReturnRejected, false}, // peça já recebida não se recusa
	}
	for _, c := range cases {
		if got := ReturnCanGo(c.de, c.para); got != c.ok {
			t.Errorf("%s → %s = %v, esperado %v", c.de, c.para, got, c.ok)
		}
	}
}

// Direito de arrependimento: 7 dias corridos a partir do recebimento.
func TestPrazoParaPedirTroca(t *testing.T) {
	entregue := time.Date(2026, 11, 1, 15, 0, 0, 0, time.UTC)
	if !ReturnWindowOpen(entregue, entregue.AddDate(0, 0, 7)) {
		t.Error("no 7º dia ainda pode pedir")
	}
	if ReturnWindowOpen(entregue, entregue.AddDate(0, 0, 8)) {
		t.Error("no 8º dia já passou")
	}
}
