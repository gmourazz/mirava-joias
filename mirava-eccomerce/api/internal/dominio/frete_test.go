package dominio

import "testing"

func TestEconomicoFicaGratisAcimaDoLimite(t *testing.T) {
	options := ShippingOptions("SP", FreeShippingAbove)
	if options[0].Cents != 0 {
		t.Fatalf("econômico deveria ser grátis em %v, veio %v", FreeShippingAbove, options[0].Cents)
	}
	if !options[0].Free {
		t.Fatal("Free deveria ser true")
	}
}

func TestUmCentavoAbaixoDoLimiteAindaCobra(t *testing.T) {
	options := ShippingOptions("SP", FreeShippingAbove-1)
	if options[0].Cents == 0 {
		t.Fatal("um centavo abaixo do limite não pode sair de graça")
	}
	if options[0].Free {
		t.Fatal("Free deveria ser false")
	}
}

// O SEDEX é upgrade: nunca entra no frete grátis, por maior que seja o pedido.
func TestSedexNuncaEhGratis(t *testing.T) {
	options := ShippingOptions("SP", FreeShippingAbove*10)
	sedex := options[1]
	if sedex.Service != ShippingExpress {
		t.Fatalf("esperava sedex na segunda posição, veio %q", sedex.Service)
	}
	if sedex.Cents == 0 || sedex.Free {
		t.Fatalf("SEDEX não pode ser grátis, veio %v (free=%v)", sedex.Cents, sedex.Free)
	}
}

func TestMaisLongeCustaMais(t *testing.T) {
	// Despacho sai do Sudeste; o preço tem que crescer com a distância.
	ordem := []string{"SP", "PR", "GO", "BA", "AM"}
	var anterior Cents
	for _, uf := range ordem {
		atual := ShippingOptions(uf, 1000)[0].Cents
		if atual <= anterior {
			t.Fatalf("%s custa %v, não é mais caro que a região anterior (%v)", uf, atual, anterior)
		}
		anterior = atual
	}
}

func TestPrazoDoSedexEhMenorQueDoEconomico(t *testing.T) {
	for uf := range ufRegion {
		options := ShippingOptions(uf, 1000)
		eco, exp := options[0], options[1]
		if exp.MaxDays >= eco.MaxDays {
			t.Fatalf("%s: SEDEX (%d dias) não é mais rápido que econômico (%d dias)",
				uf, exp.MaxDays, eco.MaxDays)
		}
	}
}

// Toda UF precisa cair numa região com tabela — um estado esquecido no mapa
// viraria frete do Norte silenciosamente.
func TestTodasAsUFsTemTabela(t *testing.T) {
	todas := []string{
		"AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
		"MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
		"SP", "SE", "TO",
	}
	if len(ufRegion) != len(todas) {
		t.Fatalf("o mapa tem %d UFs, o Brasil tem %d", len(ufRegion), len(todas))
	}
	for _, uf := range todas {
		if _, ok := ufRegion[uf]; !ok {
			t.Errorf("UF %s não está no mapa", uf)
		}
	}
}

func TestUFDesconhecidaCaiNaFaixaMaisCara(t *testing.T) {
	desconhecida := ShippingOptions("ZZ", 1000)[0].Cents
	norte := ShippingOptions("AM", 1000)[0].Cents
	if desconhecida != norte {
		t.Fatalf("UF inválida deveria cobrar como Norte (%v), veio %v", norte, desconhecida)
	}
}

func TestUFAceitaMinusculaEEspaco(t *testing.T) {
	if ShippingOptions(" sp ", 1000)[0].Cents != ShippingOptions("SP", 1000)[0].Cents {
		t.Fatal("UF deveria ser normalizada antes da busca")
	}
}

// Serviço inventado na requisição não pode virar frete de graça.
func TestServicoDesconhecidoCobraOEconomico(t *testing.T) {
	got := ShippingCost("SP", 1000, ShippingService("gratis_por_favor"))
	want := ShippingOptions("SP", 1000)[0].Cents
	if got != want {
		t.Fatalf("serviço inválido cobrou %v, deveria cobrar o econômico (%v)", got, want)
	}
	if got == 0 {
		t.Fatal("serviço inválido não pode zerar o frete")
	}
}

// `shipping_method` vai para uma coluna com CHECK no banco. Qualquer coisa
// fora da lista precisa virar um valor válido antes do INSERT, senão o pedido
// inteiro falha por causa de um campo de conveniência.
func TestNormalizeDevolveSempreValorGravavel(t *testing.T) {
	validos := map[ShippingService]bool{ShippingEconomic: true, ShippingExpress: true}
	entradas := []ShippingService{
		ShippingEconomic, ShippingExpress, "", "sedex ", "SEDEX", "expresso", "'; drop table orders;--",
	}
	for _, in := range entradas {
		if got := NormalizeShippingService(in); !validos[got] {
			t.Errorf("entrada %q virou %q, que o banco recusaria", in, got)
		}
	}
}

func TestNormalizePreservaSedex(t *testing.T) {
	if NormalizeShippingService(ShippingExpress) != ShippingExpress {
		t.Fatal("quem pediu SEDEX não pode acabar no econômico")
	}
}

func TestShippingCostBateComOCardapio(t *testing.T) {
	for _, uf := range []string{"SP", "RS", "BA"} {
		for _, subtotal := range []Cents{1000, FreeShippingAbove} {
			for _, o := range ShippingOptions(uf, subtotal) {
				if got := ShippingCost(uf, subtotal, o.Service); got != o.Cents {
					t.Errorf("%s/%v/%s: cardápio diz %v, cobrança diz %v",
						uf, subtotal, o.Service, o.Cents, got)
				}
			}
		}
	}
}
