package dominio

import "fmt"

// Status é o estado de um pedido.
type Status string

const (
	AguardandoPagamento Status = "aguardando_pagamento"
	Pago                Status = "pago"
	NoLote              Status = "no_lote"
	CompradoFornecedor  Status = "comprado_fornecedor"
	RecebidoPorMim      Status = "recebido_por_mim"
	Enviado             Status = "enviado"
	Entregue            Status = "entregue"
	Cancelado           Status = "cancelado"
	Estornado           Status = "estornado"
	FalhaEstoque        Status = "falha_estoque"
)

// transicoes é a fonte da verdade dos caminhos legais de um pedido.
//
// A MESMA tabela existe em SQL, na função public.transicao_valida (migration
// 06). Duas cópias porque Go e Postgres não compartilham código — e o banco
// precisa se defender sozinho caso a aplicação tenha bug. Se mudar aqui,
// mude lá: o teste TestTransicoesEspelhamOBanco existe para lembrar.
var transicoes = map[Status][]Status{
	AguardandoPagamento: {Pago, Cancelado},
	Pago:                {NoLote, Estornado, FalhaEstoque},
	NoLote:              {CompradoFornecedor, FalhaEstoque, Pago},
	CompradoFornecedor:  {RecebidoPorMim, FalhaEstoque},
	RecebidoPorMim:      {Enviado},
	Enviado:             {Entregue},
	Entregue:            {},
	Cancelado:           {},
	Estornado:           {},
	FalhaEstoque:        {Estornado, NoLote},
}

// PodeIr diz se a transição é permitida.
func PodeIr(de, para Status) bool {
	for _, s := range transicoes[de] {
		if s == para {
			return true
		}
	}
	return false
}

// Transitar valida antes de mudar. Devolve erro em vez de panic porque
// transição inválida é condição esperada (bug de UI, corrida entre webhook e
// admin), não catástrofe.
func Transitar(de, para Status) error {
	if de == para {
		return nil
	}
	if !PodeIr(de, para) {
		return fmt.Errorf("transição inválida: %s -> %s", de, para)
	}
	return nil
}

// EhFinal diz se o pedido não muda mais de estado.
func (s Status) EhFinal() bool { return len(transicoes[s]) == 0 }

// ContaParaFaturamento exclui os estados em que o dinheiro não é seu.
func (s Status) ContaParaFaturamento() bool {
	switch s {
	case Cancelado, Estornado, FalhaEstoque, AguardandoPagamento:
		return false
	}
	return true
}

// Rotulo é o texto que a cliente vê no acompanhamento do pedido.
//
// Repare que ele não expõe a operação interna: a cliente não precisa saber
// que a peça está esperando um lote fechar. Ela precisa saber que está sendo
// providenciada.
func (s Status) Rotulo() string {
	switch s {
	case AguardandoPagamento:
		return "Aguardando pagamento"
	case Pago, NoLote:
		return "Pagamento confirmado · preparando sua encomenda"
	case CompradoFornecedor:
		return "Sua peça está sendo produzida"
	case RecebidoPorMim:
		return "Peça recebida · sendo embalada com carinho"
	case Enviado:
		return "A caminho"
	case Entregue:
		return "Entregue"
	case Cancelado:
		return "Cancelado"
	case Estornado:
		return "Estornado"
	case FalhaEstoque:
		return "Estamos resolvendo · entraremos em contato"
	}
	return string(s)
}
