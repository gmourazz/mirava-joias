package dominio

import "strings"

// Frete por tabela fixa, agrupado por região.
//
// POR QUE TABELA E NÃO COTAÇÃO REAL: as peças da Mirava são todas pequenas e
// leves — anel, colar, pulseira embalados ficam bem abaixo de 300g, dentro da
// faixa mais barata dos Correios. Como o peso quase não varia de um pedido
// para o outro, o que sobra determinando o preço é a distância. Uma tabela por
// região erra pouco e não depende de integração nenhuma.
//
// Quando isso deixar de bastar (peça pesada, muitos itens no mesmo pedido, ou
// diferença grande entre capital e interior), o caminho é o Melhor Envio:
// cotação real por CEP e etiqueta com desconto. A troca é este arquivo inteiro
// por um cliente HTTP — o resto do sistema não muda, porque quem pergunta o
// preço do frete é sempre o servidor, nunca o front.

// ShippingService identifica a opção escolhida pela cliente.
type ShippingService string

const (
	ShippingEconomic ShippingService = "economico"
	ShippingExpress  ShippingService = "sedex"
)

// ShippingOption é uma linha do cardápio que a cliente vê no checkout.
type ShippingOption struct {
	Service  ShippingService `json:"service"`
	Label    string          `json:"label"`
	Cents    Cents           `json:"cents"`
	Free     bool            `json:"free"`
	MinDays  int             `json:"min_days"`
	MaxDays  int             `json:"max_days"`
}

// FreeShippingAbove é o valor de pedido a partir do qual o econômico sai de
// graça. Numa peça de ~R$72 com lucro de ~R$37, um frete de R$17 come quase
// metade do lucro: dar de graça em pedido pequeno é vender no prejuízo. O
// limite existe para que o frete grátis venha junto com um pedido que o
// sustente.
//
// Este número também aparece no texto do site ("frete grátis acima de R$ 350",
// em frontend/src/data/content.ts). Mudou aqui, mude lá.
const FreeShippingAbove Cents = 35000

// region agrupa os estados por distância a partir de São Paulo, de onde a
// Mirava despacha.
type region int

const (
	regionSoutheast region = iota
	regionSouth
	regionCentralWest
	regionNortheast
	regionNorth
)

var ufRegion = map[string]region{
	// Sudeste
	"SP": regionSoutheast, "RJ": regionSoutheast, "MG": regionSoutheast, "ES": regionSoutheast,
	// Sul
	"PR": regionSouth, "SC": regionSouth, "RS": regionSouth,
	// Centro-Oeste
	"DF": regionCentralWest, "GO": regionCentralWest, "MT": regionCentralWest, "MS": regionCentralWest,
	// Nordeste
	"BA": regionNortheast, "SE": regionNortheast, "AL": regionNortheast, "PE": regionNortheast,
	"PB": regionNortheast, "RN": regionNortheast, "CE": regionNortheast, "PI": regionNortheast,
	"MA": regionNortheast,
	// Norte
	"AM": regionNorth, "PA": regionNorth, "AC": regionNorth, "RO": regionNorth,
	"RR": regionNorth, "AP": regionNorth, "TO": regionNorth,
}

// tabela de preço e prazo por região.
//
// ATENÇÃO: estes valores são estimativas de partida, não preço oficial. Confira
// os seus em correios.com.br → Preços e Prazos, simulando o CEP de origem da
// Mirava e um pacote de 300g, e ajuste aqui. Errar para baixo sai do lucro a
// cada venda.
type rate struct {
	economic, express         Cents
	ecoMinDays, ecoMaxDays    int
	expMinDays, expMaxDays    int
}

var rates = map[region]rate{
	regionSoutheast:   {economic: 1690, express: 2690, ecoMinDays: 3, ecoMaxDays: 6, expMinDays: 1, expMaxDays: 2},
	regionSouth:       {economic: 1990, express: 3290, ecoMinDays: 4, ecoMaxDays: 8, expMinDays: 2, expMaxDays: 3},
	regionCentralWest: {economic: 2290, express: 3690, ecoMinDays: 5, ecoMaxDays: 9, expMinDays: 2, expMaxDays: 4},
	regionNortheast:   {economic: 2690, express: 4290, ecoMinDays: 6, ecoMaxDays: 12, expMinDays: 3, expMaxDays: 5},
	regionNorth:       {economic: 2990, express: 4990, ecoMinDays: 8, ecoMaxDays: 15, expMinDays: 4, expMaxDays: 7},
}

// ShippingOptions devolve o cardápio de frete para um estado e um subtotal.
//
// UF desconhecida cai no Norte, a faixa mais cara: se o dado vier estranho, é
// melhor cobrar a mais e devolver a diferença do que despachar no prejuízo.
func ShippingOptions(uf string, subtotal Cents) []ShippingOption {
	r, ok := ufRegion[strings.ToUpper(strings.TrimSpace(uf))]
	if !ok {
		r = regionNorth
	}
	t := rates[r]

	free := subtotal >= FreeShippingAbove
	economic := t.economic
	if free {
		economic = 0
	}

	return []ShippingOption{
		{
			Service: ShippingEconomic,
			Label:   "Econômico",
			Cents:   economic,
			Free:    free,
			MinDays: t.ecoMinDays,
			MaxDays: t.ecoMaxDays,
		},
		{
			// O SEDEX nunca entra no frete grátis: é upgrade, e quem tem pressa
			// paga por ela. Dar SEDEX de graça transformaria o benefício num
			// custo que cresce junto com o pedido.
			Service: ShippingExpress,
			Label:   "SEDEX",
			Cents:   t.express,
			Free:    false,
			MinDays: t.expMinDays,
			MaxDays: t.expMaxDays,
		},
	}
}

// NormalizeShippingService transforma o que veio na requisição num serviço que
// existe de verdade.
//
// Não é só higiene: `shipping_method` é gravado no banco com uma restrição
// CHECK. Sem normalizar, um valor inventado no corpo da requisição faria o
// INSERT do pedido falhar — a cliente veria "não foi possível criar o pedido"
// sem nenhuma pista do motivo.
func NormalizeShippingService(s ShippingService) ShippingService {
	if s == ShippingExpress {
		return ShippingExpress
	}
	return ShippingEconomic
}

// ShippingCost devolve quanto cobrar pelo serviço escolhido.
//
// É esta função que o checkout usa. Serviço desconhecido vira econômico em vez
// de erro: um valor a mais no corpo da requisição não pode virar frete grátis.
func ShippingCost(uf string, subtotal Cents, service ShippingService) Cents {
	for _, o := range ShippingOptions(uf, subtotal) {
		if o.Service == service {
			return o.Cents
		}
	}
	return ShippingOptions(uf, subtotal)[0].Cents
}
