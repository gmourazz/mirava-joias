package dominio

import "fmt"

// Status é o estado de um pedido.
type Status string

const (
	AwaitingPayment       Status = "awaiting_payment"
	Paid                  Status = "paid"
	InBatch               Status = "in_batch"
	PurchasedFromSupplier Status = "purchased_from_supplier"
	ReceivedByOwner       Status = "received_by_owner"
	Shipped               Status = "shipped"
	Delivered             Status = "delivered"
	Cancelled             Status = "cancelled"
	Refunded              Status = "refunded"
	OutOfStock            Status = "out_of_stock"
)

// transitions é a fonte da verdade dos caminhos legais de um pedido.
//
// A MESMA tabela existe em SQL, na função public.valid_transition (db/schema.sql).
// Duas cópias porque Go e Postgres não compartilham código — e o banco
// precisa se defender sozinho caso a aplicação tenha bug. Se mudar aqui,
// mude lá: o teste TestTransitionsMirrorDatabase existe para lembrar.
var transitions = map[Status][]Status{
	AwaitingPayment:       {Paid, Cancelled},
	Paid:                  {InBatch, Refunded, OutOfStock},
	InBatch:               {PurchasedFromSupplier, OutOfStock, Paid},
	PurchasedFromSupplier: {ReceivedByOwner, OutOfStock},
	ReceivedByOwner:       {Shipped},
	Shipped:               {Delivered},
	Delivered:             {},
	Cancelled:             {},
	Refunded:              {},
	OutOfStock:            {Refunded, InBatch},
}

// CanGo diz se a transição é permitida.
func CanGo(from, to Status) bool {
	for _, s := range transitions[from] {
		if s == to {
			return true
		}
	}
	return false
}

// Transition valida antes de mudar. Devolve erro em vez de panic porque
// transição inválida é condição esperada (bug de UI, corrida entre webhook e
// admin), não catástrofe.
func Transition(from, to Status) error {
	if from == to {
		return nil
	}
	if !CanGo(from, to) {
		return fmt.Errorf("transição inválida: %s -> %s", from, to)
	}
	return nil
}

// IsFinal diz se o pedido não muda mais de estado.
func (s Status) IsFinal() bool { return len(transitions[s]) == 0 }

// CountsForRevenue exclui os estados em que o dinheiro não é seu.
func (s Status) CountsForRevenue() bool {
	switch s {
	case Cancelled, Refunded, OutOfStock, AwaitingPayment:
		return false
	}
	return true
}

// Label é o texto que a cliente vê no acompanhamento do pedido.
//
// Repare que ele não expõe a operação interna: a cliente não precisa saber
// que a peça está esperando um lote fechar. Ela precisa saber que está sendo
// providenciada.
func (s Status) Label() string {
	switch s {
	case AwaitingPayment:
		return "Aguardando pagamento"
	case Paid, InBatch:
		return "Pagamento confirmado · preparando sua encomenda"
	case PurchasedFromSupplier:
		return "Sua peça está sendo produzida"
	case ReceivedByOwner:
		return "Peça recebida · sendo embalada com carinho"
	case Shipped:
		return "A caminho"
	case Delivered:
		return "Entregue"
	case Cancelled:
		return "Cancelado"
	case Refunded:
		return "Estornado"
	case OutOfStock:
		return "Estamos resolvendo · entraremos em contato"
	}
	return string(s)
}

// ---------------------------------------------------------------------------
// O que a CLIENTE vê
// ---------------------------------------------------------------------------
//
// A máquina de estados acima é operacional: ela existe para a dona saber onde
// cada pedido está (no lote? já comprado na Lilly? já chegou aqui?). Para a
// cliente, esses passos são ruído — do ponto de vista dela existem quatro
// momentos, e só um deles pede ação: quando a peça é postada e ganha rastreio.
//
// Colapsar aqui, e não no front, tem um motivo: quando o painel de gestão
// existir, ele vai mexer nos estados internos, e a visão da cliente precisa
// continuar saindo de um lugar só.

type Stage string

const (
	StageAwaitingPayment Stage = "aguardando_pagamento"
	StagePreparing       Stage = "em_preparacao"
	StageShipped         Stage = "enviado"
	StageDelivered       Stage = "entregue"
	StageClosed          Stage = "encerrado" // cancelado, estornado, sem estoque
)

// PublicStage traduz o estado interno para o que a cliente acompanha.
//
// Tudo entre o pagamento e a postagem é "em preparação": pago, dentro do
// lote, comprado na fornecedora e recebido pela dona são a mesma espera para
// quem está do outro lado.
func PublicStage(s Status) Stage {
	switch s {
	case AwaitingPayment:
		return StageAwaitingPayment
	case Paid, InBatch, PurchasedFromSupplier, ReceivedByOwner:
		return StagePreparing
	case Shipped:
		return StageShipped
	case Delivered:
		return StageDelivered
	default:
		return StageClosed
	}
}

// StageLabel é o texto que aparece para a cliente.
func StageLabel(s Stage) string {
	switch s {
	case StageAwaitingPayment:
		return "Aguardando pagamento"
	case StagePreparing:
		return "Em preparação"
	case StageShipped:
		return "A caminho"
	case StageDelivered:
		return "Entregue"
	}
	return "Encerrado"
}
