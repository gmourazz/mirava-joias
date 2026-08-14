package web

import (
	"encoding/json"
	"fmt"
	"net/http"

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

const maxItens = 30

type itemRequisicao struct {
	ProdutoID  string `json:"produto_id"`
	Tamanho    string `json:"tamanho"`
	Quantidade int    `json:"quantidade"`
	// Repare que NÃO existe campo de preço aqui. É proposital.
}

type checkoutRequisicao struct {
	Itens      []itemRequisicao `json:"itens"`
	EnderecoID string           `json:"endereco_id"`
	Gravacao   string           `json:"gravacao"`
	Telefone   string           `json:"telefone"`
	CPF        string           `json:"cpf"`
}

func (s *Servidor) criarPagamento(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Recusa cedo se o Mercado Pago não está configurado. Sem isto, o pedido
	// seria gravado no banco e só depois a criação da preferência falharia,
	// deixando pedido órfão em `aguardando_pagamento`.
	if !s.cfg.PagamentoPronto {
		s.log.Error("checkout chamado sem credenciais do Mercado Pago")
		responder(w, http.StatusServiceUnavailable, mapa{
			"erro": "Pagamento indisponível no momento. Tente novamente em instantes."})
		return
	}

	usuario, err := s.auth.DoRequest(r)
	if err != nil {
		responder(w, http.StatusUnauthorized, mapa{"erro": "Faça login para finalizar a compra"})
		return
	}

	var req checkoutRequisicao
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&req); err != nil {
		responder(w, http.StatusBadRequest, mapa{"erro": "Requisição inválida"})
		return
	}
	if len(req.Itens) == 0 {
		responder(w, http.StatusBadRequest, mapa{"erro": "Carrinho vazio"})
		return
	}
	if len(req.Itens) > maxItens {
		responder(w, http.StatusBadRequest, mapa{"erro": "Pedido com itens demais"})
		return
	}
	if req.EnderecoID == "" {
		responder(w, http.StatusBadRequest, mapa{"erro": "Escolha um endereço de entrega"})
		return
	}

	// Endereço precisa ser da própria cliente — o filtro por user_id está
	// dentro da consulta.
	endereco, err := s.db.EnderecoDoUsuario(ctx, usuario.ID, req.EnderecoID)
	if err != nil {
		responder(w, http.StatusBadRequest, mapa{"erro": "Endereço não encontrado"})
		return
	}

	perfil, _ := s.db.Perfil(ctx, usuario.ID)

	ids := make([]string, 0, len(req.Itens))
	vistos := map[string]bool{}
	for _, i := range req.Itens {
		if !vistos[i.ProdutoID] {
			vistos[i.ProdutoID] = true
			ids = append(ids, i.ProdutoID)
		}
	}

	// Preço REAL, do banco.
	produtos, err := s.db.ProdutosParaCheckout(ctx, ids)
	if err != nil {
		s.log.Error("falha ao buscar produtos", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"erro": "Erro ao montar o pedido"})
		return
	}
	if len(produtos) != len(ids) {
		responder(w, http.StatusConflict, mapa{
			"erro": "Alguma peça saiu do ar enquanto você comprava. Revise o carrinho."})
		return
	}

	var subtotal dominio.Centavos
	itensPedido := make([]db.ItemPedido, 0, len(req.Itens))
	itensMP := make([]mercadopago.Item, 0, len(req.Itens))

	for _, item := range req.Itens {
		p, ok := produtos[item.ProdutoID]
		if !ok {
			responder(w, http.StatusBadRequest, mapa{"erro": "Produto inválido no carrinho"})
			return
		}
		if item.Quantidade < 1 || item.Quantidade > 10 {
			responder(w, http.StatusBadRequest, mapa{"erro": "Quantidade inválida"})
			return
		}
		// A Lilly não publica quantidade em estoque, só se dá para comprar.
		if !p.Disponivel {
			responder(w, http.StatusConflict, mapa{
				"erro": fmt.Sprintf("%q está indisponível na fornecedora no momento.", p.Nome)})
			return
		}

		var ajuste dominio.Centavos
		if item.Tamanho != "" {
			a, disponivel, err := s.db.AjusteVariante(ctx, p.ID, item.Tamanho)
			if err != nil {
				s.log.Error("falha ao ler variante", "erro", err)
				responder(w, http.StatusInternalServerError, mapa{"erro": "Erro ao montar o pedido"})
				return
			}
			if !disponivel {
				responder(w, http.StatusConflict, mapa{
					"erro": fmt.Sprintf("Tamanho %s de %q está indisponível.", item.Tamanho, p.Nome)})
				return
			}
			ajuste = a
		}

		precoUnit := p.Preco + ajuste
		subtotal += precoUnit * dominio.Centavos(item.Quantidade)

		titulo := p.Nome
		if item.Tamanho != "" {
			titulo += " · " + item.Tamanho
		}

		itensPedido = append(itensPedido, db.ItemPedido{
			ProdutoID:  p.ID,
			Nome:       p.Nome,  // congela: o nome pode mudar depois
			SKU:        p.SKU,   // para copiar no site da Lilly ao fechar o lote
			Tamanho:    item.Tamanho,
			Quantidade: item.Quantidade,
			Preco:      precoUnit,
			Custo:      p.Custo, // congela: sem isso o lucro histórico vira ficção
		})
		itensMP = append(itensMP, mercadopago.Item{
			ID: p.ID, Title: titulo, Quantity: item.Quantidade,
			UnitPrice: precoUnit.Reais(), CurrencyID: "BRL",
		})
	}

	// Frete grátis por ora. Quando entrar cálculo real (Melhor Envio),
	// é aqui que ele soma — e o total continua sendo decidido no servidor.
	var frete, desconto dominio.Centavos
	total := subtotal + frete - desconto
	if total <= 0 {
		responder(w, http.StatusBadRequest, mapa{"erro": "Total inválido"})
		return
	}

	nome := perfil.Nome
	if nome == "" {
		nome = "Cliente"
	}
	telefone := req.Telefone
	if telefone == "" {
		telefone = perfil.Telefone
	}
	cpf := req.CPF
	if cpf == "" {
		cpf = perfil.CPF
	}

	// Grava o pedido ANTES de chamar o Mercado Pago: se o MP falhar, fica
	// o rastro do que a cliente tentou fazer.
	pedidoID, numero, err := s.db.CriarPedido(ctx, db.NovoPedido{
		UserID: usuario.ID, Nome: nome, Email: usuario.Email,
		Telefone: telefone, CPF: cpf, Endereco: endereco,
		Subtotal: subtotal, Frete: frete, Desconto: desconto, Total: total,
		Gravacao: req.Gravacao, Itens: itensPedido,
	})
	if err != nil {
		s.log.Error("falha ao criar pedido", "erro", err)
		responder(w, http.StatusInternalServerError, mapa{"erro": "Não foi possível criar o pedido"})
		return
	}

	pref, err := s.mp.CriarPreferencia(ctx, mercadopago.NovaPreferencia{
		PedidoID: pedidoID, PedidoNumero: numero, Itens: itensMP,
		Email: usuario.Email, Nome: nome,
		SiteURL: s.cfg.SiteURL, WebhookURL: s.cfg.WebhookURL,
		ParcelasSemJuros: s.cfg.ParcelasSemJuros,
	})
	if err != nil {
		s.log.Error("mercado pago recusou a preferência", "erro", err, "pedido", numero)
		responder(w, http.StatusBadGateway, mapa{
			"erro": "Não foi possível iniciar o pagamento. Tente de novo."})
		return
	}

	url := pref.InitPoint
	if s.cfg.ModoTeste {
		url = pref.SandboxInitPoint
	}

	responder(w, http.StatusOK, mapa{
		"pedido_id":      pedidoID,
		"numero":         numero,
		"total_centavos": int64(total),
		"url_pagamento":  url,
	})
}
