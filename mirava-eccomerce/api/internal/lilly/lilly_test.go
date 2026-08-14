package lilly

import (
	"strings"
	"testing"

	"golang.org/x/text/encoding/charmap"
)

// HTML imitando a estrutura real de uma página da wBuy, incluindo a seção
// "Quem viu, também comprou" com preços de OUTRO produto — a armadilha
// principal deste extrator.
const paginaExemplo = `<!doctype html><html><head>
<meta property="og:title" content="Pulseira Prata - Riviera Cristal - Margot" />
<meta name="description" content="Pulseira prata Margot com fileira de zircônias cristal." />
</head><body>
<div class="produto">
<span class="codigo">Cód.: <strong>PL289</strong></span>
<div class="rating">5.0 (27)</div>
<div class="preco"><b>R$48,00</b></div>
<p><b>3x</b> de <b>R$16,00</b> sem juros</p>
<p><b>R$45,60</b> com PIX (-5%)</p>
<h4>Atacado</h4><strong>R$33,60</strong> cada un.
<a href="#" class="btn">Adicionar ao carrinho</a>
<img src="https://assets.sistemawbuy.com.br/arquivos/a476/produtos/6a74/pulseira-1_mini.jpg">
<img src="https://assets.sistemawbuy.com.br/arquivos/a476/produtos/6a74/pulseira-1.jpg">
<img src="https://assets.sistemawbuy.com.br/arquivos/a476/produtos/6a74/pulseira-2.jpg">
<img src="https://assets.sistemawbuy.com.br/arquivos/a476/config/logo-6970.png">
</div>
<h3>Descrição</h3>
<p>Pulseira prata Margot com fileira de zircônias cristal e pedra central em formato oval. Possui 18 cm e acabamento hipoalergênico.</p>
<h3>Garantia</h3>
<p>Oferecemos garantia de 6 meses para as peças banhadas a prata e ouro.</p>
<h3>Avaliações</h3>
<h2>Quem viu, também comprou</h2>
<div><h3>Pulseira Maya</h3>Cód: <b>PL46</b> R$32,90 <h4>Atacado</h4><b>R$23,00</b></div>
</body></html>`

func TestExtrairNaoPegaPrecoDoVizinho(t *testing.T) {
	p := Extrair(paginaExemplo, "https://www.uselilly.com/x/", RazaoAtacadoPadrao)
	if p == nil {
		t.Fatal("Extrair devolveu nil")
	}

	if p.SKU != "PL289" {
		t.Errorf("SKU = %q, esperado PL289 (pegou o do vizinho?)", p.SKU)
	}
	if p.Varejo != 4800 {
		t.Errorf("Varejo = %v, esperado R$ 48,00", p.Varejo)
	}
	// R$23,00 é o atacado da Pulseira Maya, que aparece depois do corte.
	if p.Atacado != 3360 {
		t.Errorf("Atacado = %v, esperado R$ 33,60 (pegou R$23,00 do vizinho?)", p.Atacado)
	}
	if !p.AtacadoConfirmado {
		t.Error("AtacadoConfirmado deveria ser true: o preço estava na página")
	}
	if !p.Disponivel {
		t.Error("deveria estar disponível: tem botão de carrinho e nenhum aviso")
	}
	if len(p.Imagens) != 2 {
		t.Errorf("Imagens = %d, esperado 2 (sem _mini, sem logo em /config/): %v",
			len(p.Imagens), p.Imagens)
	}
	if p.Avaliacao != 5.0 || p.QtdAvaliacoes != 27 {
		t.Errorf("avaliação = %.1f (%d), esperado 5.0 (27)", p.Avaliacao, p.QtdAvaliacoes)
	}
	if !strings.Contains(p.Descricao, "zircônias") {
		t.Errorf("descrição não capturada: %q", p.Descricao)
	}
	if err := p.Validar(); err != nil {
		t.Errorf("produto válido reprovado: %v", err)
	}
}

// Peças de coleção nova não exibem atacado — cai na razão de 70%.
func TestAtacadoDerivadoQuandoAusente(t *testing.T) {
	html := strings.Replace(paginaExemplo, "<h4>Atacado</h4><strong>R$33,60</strong> cada un.", "", 1)
	p := Extrair(html, "https://x", RazaoAtacadoPadrao)
	if p == nil {
		t.Fatal("Extrair devolveu nil")
	}
	if p.AtacadoConfirmado {
		t.Error("AtacadoConfirmado deveria ser false quando o preço não está na página")
	}
	if p.Atacado != 3360 { // 4800 × 0,70
		t.Errorf("Atacado derivado = %v, esperado R$ 33,60", p.Atacado)
	}
}

func TestIndisponivel(t *testing.T) {
	html := strings.Replace(paginaExemplo, "Adicionar ao carrinho", "Produto indisponível", 1)
	p := Extrair(html, "https://x", RazaoAtacadoPadrao)
	if p == nil {
		t.Fatal("Extrair devolveu nil")
	}
	if p.Disponivel {
		t.Error("deveria estar indisponível: sem botão e com aviso")
	}
}

func TestPaginaSemProdutoDevolveNil(t *testing.T) {
	if p := Extrair(`<html><body><h1>Sobre nós</h1></body></html>`, "https://x", 0.7); p != nil {
		t.Errorf("página institucional deveria devolver nil, veio %+v", p)
	}
}

// A salvaguarda é o que impede um extrator quebrado de contaminar o catálogo.
func TestValidarBarraDadoRuim(t *testing.T) {
	casos := []struct {
		nome string
		p    Produto
	}{
		{"custo zero", Produto{SKU: "PL1", Nome: "Anel", Atacado: 0, Imagens: []string{"x"}}},
		{"custo absurdo", Produto{SKU: "PL1", Nome: "Anel", Atacado: 90000, Imagens: []string{"x"}}},
		{"atacado maior que varejo", Produto{SKU: "PL1", Nome: "Anel", Atacado: 5000, Varejo: 3000, Imagens: []string{"x"}}},
		{"sem imagem", Produto{SKU: "PL1", Nome: "Anel", Atacado: 2300}},
		{"sem sku", Produto{Nome: "Anel", Atacado: 2300, Imagens: []string{"x"}}},
	}
	for _, c := range casos {
		if err := c.p.Validar(); err == nil {
			t.Errorf("%s: deveria ter sido reprovado", c.nome)
		}
	}
}

// O teste que justifica todo o cuidado com encoding.
func TestDecodificacaoLatin1(t *testing.T) {
	original := "zircônias · Coleções · Anéis · Preço à vista · São Paulo"

	enc, err := charmap.ISO8859_1.NewEncoder().String(original)
	if err != nil {
		t.Fatalf("não consegui montar a amostra: %v", err)
	}

	// Errado: tratar os bytes latin-1 como se fossem UTF-8.
	if enc == original {
		t.Fatal("amostra não ficou em latin-1")
	}

	// Certo: decodificar declarando o charset.
	dec, err := charmap.ISO8859_1.NewDecoder().String(enc)
	if err != nil {
		t.Fatalf("decodificação falhou: %v", err)
	}
	if dec != original {
		t.Errorf("decodificado = %q, esperado %q", dec, original)
	}
	if strings.ContainsRune(dec, '�') {
		t.Error("apareceu caractere de substituição — encoding errado")
	}
}

func TestCharsetLatin1(t *testing.T) {
	casos := []struct {
		ct    string
		latin bool
	}{
		{"text/html; charset=ISO-8859-1", true},
		{"text/html; charset=iso-8859-1", true},
		{"text/html", true}, // sem declaração, a wBuy serve latin-1
		{"text/html; charset=UTF-8", false},
	}
	for _, c := range casos {
		if got := charsetLatin1(c.ct); got != c.latin {
			t.Errorf("charsetLatin1(%q) = %v, esperado %v", c.ct, got, c.latin)
		}
	}
}
