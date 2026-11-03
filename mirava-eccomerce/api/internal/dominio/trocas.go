package dominio

import "time"

// Trocas e devoluções com etapas (decisão 31). Os valores são os do CHECK de
// public.returns.stage.

type ReturnStage string

const (
	ReturnRequested        ReturnStage = "requested"
	ReturnAwaitingShipment ReturnStage = "awaiting_shipment"
	ReturnReceived         ReturnStage = "received"
	ReturnDone             ReturnStage = "done"
	ReturnRejected         ReturnStage = "rejected"
)

var returnTransitions = map[ReturnStage][]ReturnStage{
	ReturnRequested:        {ReturnAwaitingShipment, ReturnRejected},
	ReturnAwaitingShipment: {ReturnReceived},
	ReturnReceived:         {ReturnDone},
}

func ReturnCanGo(from, to ReturnStage) bool {
	for _, s := range returnTransitions[from] {
		if s == to {
			return true
		}
	}
	return false
}

// ReturnStageLabel é o texto que a cliente vê.
func ReturnStageLabel(s ReturnStage) string {
	switch s {
	case ReturnRequested:
		return "solicitada"
	case ReturnAwaitingShipment:
		return "aguardando o envio da peça"
	case ReturnReceived:
		return "peça recebida"
	case ReturnDone:
		return "concluída"
	case ReturnRejected:
		return "não aprovada"
	}
	return string(s)
}

// ReturnWindowDays: direito de arrependimento do CDC, art. 49.
const ReturnWindowDays = 7

func ReturnWindowOpen(deliveredAt, now time.Time) bool {
	return !now.After(deliveredAt.AddDate(0, 0, ReturnWindowDays))
}
