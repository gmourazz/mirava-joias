package dominio

import "time"

// Regras do painel de gestão (admin do design v5).
//
// O painel não inventa caminho novo: toda mudança de status continua passando
// pela máquina de estados de pedido.go (e pela função SQL valid_transition).
// O que este arquivo acrescenta é o recorte do que a DONA pode fazer à mão.

// ManualTransitionAllowed diz se a dona pode mover o pedido de `from` para
// `to` pelo painel.
//
// Exceções à máquina de estados:
//   - "pago" vindo de "aguardando pagamento" é só o webhook do Mercado Pago,
//     depois de validar assinatura e reconsultar a API. Um clique no painel
//     não confirma dinheiro.
//   - "postado" exige código de rastreio e dispara aviso à cliente, então tem
//     rota própria (despachar), não a transição genérica.
//   - "pago" → "no lote" acontece ao comprar o lote inteiro.
func ManualTransitionAllowed(from, to Status) bool {
	if to == Paid && from != InBatch {
		return false
	}
	if to == Shipped {
		return false
	}
	// Pago → no lote é efeito de comprar o lote (PurchaseBatch), não um
	// clique avulso: o pedido já está ligado ao lote aberto desde o pagamento.
	if from == Paid && to == InBatch {
		return false
	}
	return CanGo(from, to)
}

// ManualActions lista as transições que o painel oferece para um status.
func ManualActions(from Status) []Status {
	var out []Status
	for _, to := range transitions[from] {
		if ManualTransitionAllowed(from, to) {
			out = append(out, to)
		}
	}
	return out
}

// AdminStage é a etapa do pedido do ponto de vista da operação: o que a dona
// precisa fazer com ele agora. Agrupa os status internos nas colunas do
// painel.
type AdminStage string

const (
	AdminAwaitingPayment AdminStage = "aguardando"
	AdminToBuy           AdminStage = "comprar"   // pago, falta comprar na Lilly
	AdminAtSupplier      AdminStage = "na_lilly"  // comprado, esperando chegar
	AdminToShip          AdminStage = "despachar" // peça em mãos, falta postar
	AdminShipped         AdminStage = "despachado"
	AdminDelivered       AdminStage = "entregue"
	AdminProblem         AdminStage = "problema"  // sem estoque na fornecedora
	AdminClosed          AdminStage = "encerrado" // cancelado ou estornado
)

func AdminStageOf(s Status) AdminStage {
	switch s {
	case AwaitingPayment:
		return AdminAwaitingPayment
	case Paid, InBatch:
		return AdminToBuy
	case PurchasedFromSupplier:
		return AdminAtSupplier
	case ReceivedByOwner:
		return AdminToShip
	case Shipped:
		return AdminShipped
	case Delivered:
		return AdminDelivered
	case OutOfStock:
		return AdminProblem
	}
	return AdminClosed
}

// PromisedBusinessDays é o prazo prometido à cliente, a partir do pagamento
// (decisão 22 da arquitetura: "até 20 dias úteis").
const PromisedBusinessDays = 20

// NearDeadlineDays: faltando isso ou menos, o pedido aparece como "perto do
// prazo" no painel — ainda dá tempo de agir (pagar SEDEX, avisar a cliente).
const NearDeadlineDays = 4

// Deadline resume o prazo de um pedido pago.
type Deadline struct {
	Due  time.Time // data-limite da entrega (dia, sem hora)
	Used int       // dias úteis já passados desde o pagamento
	Left int       // dias úteis restantes; negativo = atrasado
	Near bool
	Late bool
}

func DeadlineFor(paidAt, now time.Time) Deadline {
	used := BusinessDaysBetween(paidAt, now)
	left := PromisedBusinessDays - used
	return Deadline{
		Due:  AddBusinessDays(paidAt, PromisedBusinessDays),
		Used: used,
		Left: left,
		Near: left >= 0 && left <= NearDeadlineDays,
		Late: left < 0,
	}
}

// AddBusinessDays soma n dias úteis (seg–sex) a uma data e devolve o dia, sem
// hora. Ignora feriados, como BusinessDaysBetween.
func AddBusinessDays(start time.Time, n int) time.Time {
	d := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())
	for n > 0 {
		d = d.AddDate(0, 0, 1)
		if wd := d.Weekday(); wd != time.Saturday && wd != time.Sunday {
			n--
		}
	}
	return d
}

// Status do lote — os mesmos valores do CHECK em public.batches.
type BatchStatus string

const (
	BatchOpen        BatchStatus = "open"
	BatchClosed      BatchStatus = "closed"
	BatchPurchased   BatchStatus = "purchased"
	BatchReceived    BatchStatus = "received"
	BatchDistributed BatchStatus = "distributed"
	BatchCancelled   BatchStatus = "cancelled"
)

// BatchCanBePurchased: a dona pode comprar o lote aberto (antecipando o
// fechamento) ou um lote que a regra já fechou.
func BatchCanBePurchased(s BatchStatus) bool { return s == BatchOpen || s == BatchClosed }

// BatchCanBeReceived: só o que já foi comprado pode chegar.
func BatchCanBeReceived(s BatchStatus) bool { return s == BatchPurchased }

// NewProductDays: peça cadastrada há até isto aparece com o selo "Novo" e na
// aba Lançamentos.
const NewProductDays = 30

func IsNewProduct(createdAt, now time.Time) bool {
	return now.Sub(createdAt) <= NewProductDays*24*time.Hour
}

// ShippingTransitMaxDays é o maior prazo de transporte da tabela de frete
// para o estado e a modalidade do pedido.
func ShippingTransitMaxDays(uf string, service ShippingService) int {
	for _, o := range ShippingOptions(uf, 0) {
		if o.Service == NormalizeShippingService(service) {
			return o.MaxDays
		}
	}
	return 0
}

// ShipBy é o último dia útil para despachar e ainda entregar dentro dos 20
// dias úteis prometidos, descontado o transporte. É a data da agenda de
// despachos do painel.
func ShipBy(paidAt time.Time, transitDays int) time.Time {
	return AddBusinessDays(paidAt, PromisedBusinessDays-transitDays)
}
