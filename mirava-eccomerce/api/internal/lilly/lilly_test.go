package lilly

import (
	"strings"
	"testing"

	"golang.org/x/text/encoding/charmap"
)

// HTML imitando a estrutura real de uma página da wBuy, incluindo a seção
// "Quem viu, também comprou" com preços de OUTRO produto — a armadilha
// principal deste extrator.
const samplePage = `<!doctype html><html><head>
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

// HTML imitando a página real: um mini-carrinho fixo no topo (sempre com os
// mesmos itens de brinde, "Cód: Z7" — sem ponto) aparece ANTES do código do
// produto de verdade ("Cód.: PL291" — com ponto). Bug real encontrado em
// produção: sem exigir o ponto, o extrator sempre pegava o SKU do brinde do
// carrinho, e uma sincronização inteira gravou só 2 SKUs distintos.
const pageWithCartWidget = `<!doctype html><html><head>
<meta property="og:title" content="Pulseira Prata - Riviera Jully - Pink" />
</head><body>
<div class="minicarrinho">
<h3>Saquinho de cetim Lilly Store</h3>
Cód: <b>Z7</b>
<p>R$7,30</p>
<h4>Atacado</h4><strong>R$5,10</strong>
<img src="https://assets.sistemawbuy.com.br/arquivos/a476/produtos/z7/saquinho.jpg">
</div>
<div class="minicarrinho">
<h3>Caixinha de presente - Lilly</h3>
Cód: <b>Z22</b>
<p>R$5,60</p>
<h4>Atacado</h4><strong>R$3,90</strong>
<img src="https://assets.sistemawbuy.com.br/arquivos/a476/produtos/z22/caixinha.jpg">
</div>
<div class="produto">
<span class="codigo">Cód.: PL291</span>
<div class="preco"><b>R$37,00</b></div>
<h4>Atacado</h4><strong>R$25,90</strong> cada un.
<a href="#" class="btn">Adicionar ao carrinho</a>
<img src="https://assets.sistemawbuy.com.br/arquivos/a476/produtos/x/foto.jpg">
</div>
<h3>Descrição</h3>
<p>Pulseira prata Jully com riviera de mini zircônias na cor rosa pink.</p>
</body></html>`

func TestExtractIgnoresCartWidgetSKU(t *testing.T) {
	p := Extract(pageWithCartWidget, "https://www.uselilly.com/x/", DefaultWholesaleRatio)
	if p == nil {
		t.Fatal("Extract devolveu nil")
	}
	if p.SKU != "PL291" {
		t.Errorf("SKU = %q, esperado PL291 (pegou o do mini-carrinho, Z7/Z22?)", p.SKU)
	}
	// Bug real em produção: não bastava corrigir o SKU — preço, atacado e
	// foto vinham do mesmo mini-carrinho (R$7,30 e R$5,10 do "Saquinho de
	// cetim"), contaminando praticamente todo produto sincronizado.
	if p.Retail != 3700 {
		t.Errorf("Retail = %v, esperado R$ 37,00 (pegou R$7,30 do mini-carrinho?)", p.Retail)
	}
	if p.Wholesale != 2590 {
		t.Errorf("Wholesale = %v, esperado R$ 25,90 (pegou R$5,10 do mini-carrinho?)", p.Wholesale)
	}
	if len(p.Images) != 1 || !strings.Contains(p.Images[0], "/x/foto.jpg") {
		t.Errorf("Images = %v, esperado só a foto do produto real", p.Images)
	}
}

// Bug real: a página verdadeira da Lilly não tem quebra de linha nenhuma
// entre os títulos "Garantia", "Avaliações" e "Descrição" (que aparecem
// primeiro juntos, como abas) e o conteúdo de cada seção — tudo vira uma
// linha só depois do stripTags. A versão antiga do regex exigia "\n" antes
// do próximo título pra cortar a descrição, então nunca cortava: a
// descrição engolia garantia, avaliações (com nome e data de cliente) e até
// o botão de comprar. Esta página imita isso, numa linha só, com entidade
// HTML no meio de um comentário ("&aacute;") como na página real.
const pageWithoutLineBreaks = `<!doctype html><html><head><meta property="og:title" content="Anel Letra"/></head><body><div class="produto"><span>Cód.: PL999</span><div class="preco"><b>R$35,40</b></div><h4>Atacado</h4><strong>R$18,00</strong><a href="#" class="btn">Adicionar ao carrinho</a><img src="https://assets.sistemawbuy.com.br/arquivos/a476/produtos/x/foto.jpg"></div> Garantia Avaliações Descrição Anel com letra. Peça moderna, pode ser usado sozinho ou combinado. Garantia Oferecemos garantia de 6 meses para as peças banhadas a prata e ouro. Avaliações Rafaela Cristina - 08/03/2024 MARAVILHOSO! H&aacute; muito tempo estava atr&aacute;s desse tipo de anel e fiquei muito feliz. Ana Carolynne - 03/08/2023 avaliar produto Anel Letra - regulável R$35,40</body></html>`

func TestDescriptionDoesNotSwallowRestOfPage(t *testing.T) {
	p := Extract(pageWithoutLineBreaks, "https://x", DefaultWholesaleRatio)
	if p == nil {
		t.Fatal("Extract devolveu nil")
	}
	if p.Description != "Anel com letra. Peça moderna, pode ser usado sozinho ou combinado." {
		t.Errorf("Description = %q, engoliu garantia/avaliações?", p.Description)
	}
	if p.Warranty != "Oferecemos garantia de 6 meses para as peças banhadas a prata e ouro." {
		t.Errorf("Warranty = %q", p.Warranty)
	}
	if strings.Contains(p.Description, "Avalia") || strings.Contains(p.Description, "Rafaela") {
		t.Errorf("Description ainda contém avaliação: %q", p.Description)
	}
}

func TestExtractParsesReviews(t *testing.T) {
	p := Extract(pageWithoutLineBreaks, "https://x", DefaultWholesaleRatio)
	if p == nil {
		t.Fatal("Extract devolveu nil")
	}
	if len(p.Reviews) != 2 {
		t.Fatalf("Reviews = %d, esperado 2: %+v", len(p.Reviews), p.Reviews)
	}
	r := p.Reviews[0]
	if r.Author != "Rafaela Cristina" || r.Date != "08/03/2024" {
		t.Errorf("primeira avaliação = %+v", r)
	}
	if !strings.Contains(r.Text, "Há muito tempo") {
		t.Errorf("texto não decodificou a entidade HTML: %q", r.Text)
	}
	if p.Reviews[1].Author != "Ana Carolynne" || p.Reviews[1].Date != "03/08/2023" {
		t.Errorf("segunda avaliação = %+v", p.Reviews[1])
	}
}

func TestExtractDoesNotGrabNeighborPrice(t *testing.T) {
	p := Extract(samplePage, "https://www.uselilly.com/x/", DefaultWholesaleRatio)
	if p == nil {
		t.Fatal("Extract devolveu nil")
	}

	if p.SKU != "PL289" {
		t.Errorf("SKU = %q, esperado PL289 (pegou o do vizinho?)", p.SKU)
	}
	if p.Retail != 4800 {
		t.Errorf("Retail = %v, esperado R$ 48,00", p.Retail)
	}
	// R$23,00 é o atacado da Pulseira Maya, que aparece depois do corte.
	if p.Wholesale != 3360 {
		t.Errorf("Wholesale = %v, esperado R$ 33,60 (pegou R$23,00 do vizinho?)", p.Wholesale)
	}
	if !p.WholesaleConfirmed {
		t.Error("WholesaleConfirmed deveria ser true: o preço estava na página")
	}
	if !p.Available {
		t.Error("deveria estar disponível: tem botão de carrinho e nenhum aviso")
	}
	if len(p.Images) != 2 {
		t.Errorf("Images = %d, esperado 2 (sem _mini, sem logo em /config/): %v",
			len(p.Images), p.Images)
	}
	if p.Rating != 5.0 || p.RatingCount != 27 {
		t.Errorf("avaliação = %.1f (%d), esperado 5.0 (27)", p.Rating, p.RatingCount)
	}
	if !strings.Contains(p.Description, "zircônias") {
		t.Errorf("descrição não capturada: %q", p.Description)
	}
	if err := p.Validate(); err != nil {
		t.Errorf("produto válido reprovado: %v", err)
	}
}

// Peças de coleção nova não exibem atacado — cai na razão de 70%.
func TestWholesaleDerivedWhenMissing(t *testing.T) {
	html := strings.Replace(samplePage, "<h4>Atacado</h4><strong>R$33,60</strong> cada un.", "", 1)
	p := Extract(html, "https://x", DefaultWholesaleRatio)
	if p == nil {
		t.Fatal("Extract devolveu nil")
	}
	if p.WholesaleConfirmed {
		t.Error("WholesaleConfirmed deveria ser false quando o preço não está na página")
	}
	if p.Wholesale != 3360 { // 4800 × 0,70
		t.Errorf("Wholesale derivado = %v, esperado R$ 33,60", p.Wholesale)
	}
}

func TestUnavailable(t *testing.T) {
	html := strings.Replace(samplePage, "Adicionar ao carrinho", "Produto indisponível", 1)
	p := Extract(html, "https://x", DefaultWholesaleRatio)
	if p == nil {
		t.Fatal("Extract devolveu nil")
	}
	if p.Available {
		t.Error("deveria estar indisponível: sem botão e com aviso")
	}
}

func TestPageWithoutProductReturnsNil(t *testing.T) {
	if p := Extract(`<html><body><h1>Sobre nós</h1></body></html>`, "https://x", 0.7); p != nil {
		t.Errorf("página institucional deveria devolver nil, veio %+v", p)
	}
}

// A salvaguarda é o que impede um extrator quebrado de contaminar o catálogo.
func TestValidateRejectsBadData(t *testing.T) {
	cases := []struct {
		name string
		p    Product
	}{
		{"custo zero", Product{SKU: "PL1", Name: "Anel", Wholesale: 0, Images: []string{"x"}}},
		{"custo absurdo", Product{SKU: "PL1", Name: "Anel", Wholesale: 90000, Images: []string{"x"}}},
		{"atacado maior que varejo", Product{SKU: "PL1", Name: "Anel", Wholesale: 5000, Retail: 3000, Images: []string{"x"}}},
		{"sem imagem", Product{SKU: "PL1", Name: "Anel", Wholesale: 2300}},
		{"sem sku", Product{Name: "Anel", Wholesale: 2300, Images: []string{"x"}}},
	}
	for _, c := range cases {
		if err := c.p.Validate(); err == nil {
			t.Errorf("%s: deveria ter sido reprovado", c.name)
		}
	}
}

// O teste que justifica todo o cuidado com encoding.
func TestLatin1Decoding(t *testing.T) {
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

func TestGuessCategory(t *testing.T) {
	cases := []struct {
		name string
		want string
	}{
		{"Pulseira Prata - Riviera Cristal - Margot", "pulseiras"},
		{"Anel Solitário Zircônia", "aneis"},
		{"Colar Gargantilha Veneziana", "colares"},
		{"Brinco Argola Pequena", "brincos"},
		{"Berloque Coração", "berloques"},
		{"Conjunto Colar e Brinco", "conjuntos"},
		{"Porta-Retrato Decorativo", "outros"},
	}
	for _, c := range cases {
		if got := GuessCategory(c.name); got != c.want {
			t.Errorf("GuessCategory(%q) = %q, esperado %q", c.name, got, c.want)
		}
	}
}

func TestGuessMetal(t *testing.T) {
	cases := []struct {
		name string
		want string
	}{
		{"Anel Banhado a Ouro 18k", "ouro"},
		{"Pulseira Dourada Elos", "ouro"},
		{"Pulseira Prata 925", "prata"},
		{"Colar Riviera Cristal", "prata"},
	}
	for _, c := range cases {
		if got := GuessMetal(c.name); got != c.want {
			t.Errorf("GuessMetal(%q) = %q, esperado %q", c.name, got, c.want)
		}
	}
}

func TestCharsetLatin1(t *testing.T) {
	cases := []struct {
		ct    string
		latin bool
	}{
		{"text/html; charset=ISO-8859-1", true},
		{"text/html; charset=iso-8859-1", true},
		{"text/html", true}, // sem declaração, a wBuy serve latin-1
		{"text/html; charset=UTF-8", false},
	}
	for _, c := range cases {
		if got := charsetLatin1(c.ct); got != c.latin {
			t.Errorf("charsetLatin1(%q) = %v, esperado %v", c.ct, got, c.latin)
		}
	}
}

// --- Grupos de opção (tamanho, letra) -------------------------------------
//
// Os textos abaixo reproduzem a ordem real da página da Lilly: preço, atacado,
// grupo de opção, botão de comprar, e só depois a descrição — que menciona
// "Tamanho:" de novo, agora como característica escrita.

const paginaAnelComTamanho = `<html><head>
<meta property="og:title" content="Anel Prata - Cravejado - Ariela" />
</head><body>
<div>C&oacute;d.: AN540</div>
<div>R$33,00</div><div>Atacado R$23,10 cada un.</div>
<div>Tamanho</div><ul><li>19</li><li>20</li><li>22</li><li>23</li><li>25</li></ul>
<a>Adicionar ao carrinho</a>
<h2>Descri&ccedil;&atilde;o</h2><p>Anel prata Ariela com uma fileira cravejada.
Tamanho: aro 19 a 25. Avalia&ccedil;&otilde;es</p>
</body></html>`

const paginaColarComLetras = `<html><head>
<meta property="og:title" content="Colar Prata - Mini Letra Cravejada" />
</head><body>
<div>C&oacute;d.: C548</div>
<div>R$33,00</div><div>Atacado R$23,10 cada un.</div>
<div>Letras</div><ul><li>A</li><li>B</li><li>C</li><li>Y</li><li>Z</li></ul>
<a>Adicionar ao carrinho</a>
<h2>Descri&ccedil;&atilde;o</h2><p>Colar com pingente mini letra.
Tamanho: 50 cm (45 cm + 5 cm de extensor). Avalia&ccedil;&otilde;es</p>
</body></html>`

const paginaSemOpcao = `<html><head>
<meta property="og:title" content="Colar Prata - Ponto de Luz" />
</head><body>
<div>C&oacute;d.: C100</div>
<div>R$29,00</div><div>Atacado R$20,30 cada un.</div>
<a>Adicionar ao carrinho</a>
<h2>Descri&ccedil;&atilde;o</h2><p>Colar delicado. Avalia&ccedil;&otilde;es</p>
</body></html>`

func TestExtraiTamanhosDoAnel(t *testing.T) {
	p := Extract(paginaAnelComTamanho, "https://uselilly.com/anel", 0.7)
	if p == nil {
		t.Fatal("não extraiu o produto")
	}
	if p.VariantLabel != "Tamanho" {
		t.Errorf("rótulo veio %q, esperava %q", p.VariantLabel, "Tamanho")
	}
	want := []string{"19", "20", "22", "23", "25"}
	if len(p.Variants) != len(want) {
		t.Fatalf("veio %v, esperava %v", p.Variants, want)
	}
	for i := range want {
		if p.Variants[i] != want[i] {
			t.Errorf("posição %d: veio %q, esperava %q", i, p.Variants[i], want[i])
		}
	}
}

// O rótulo é "Letras", não "Tamanho": mostrar "Tamanho: A" seria absurdo.
func TestExtraiLetrasComRotuloCerto(t *testing.T) {
	p := Extract(paginaColarComLetras, "https://uselilly.com/colar", 0.7)
	if p == nil {
		t.Fatal("não extraiu o produto")
	}
	if p.VariantLabel != "Letras" {
		t.Errorf("rótulo veio %q, esperava %q", p.VariantLabel, "Letras")
	}
	if len(p.Variants) != 5 || p.Variants[0] != "A" || p.Variants[4] != "Z" {
		t.Errorf("letras vieram %v", p.Variants)
	}
}

// A maioria das peças não tem opção nenhuma — e aí não pode inventar uma.
func TestPecaSemOpcaoNaoInventaVariante(t *testing.T) {
	p := Extract(paginaSemOpcao, "https://uselilly.com/colar-simples", 0.7)
	if p == nil {
		t.Fatal("não extraiu o produto")
	}
	if p.VariantLabel != "" || len(p.Variants) != 0 {
		t.Errorf("inventou opção: rótulo %q, valores %v", p.VariantLabel, p.Variants)
	}
}

// "Tamanho:" também aparece dentro da descrição. O grupo de verdade vem antes,
// e é ele que tem que ganhar — mesmo bug de "primeira ocorrência" que já
// estragou garantia e avaliações antes.
func TestNaoConfundeTamanhoDaDescricao(t *testing.T) {
	p := Extract(paginaColarComLetras, "https://uselilly.com/colar", 0.7)
	if p == nil {
		t.Fatal("não extraiu o produto")
	}
	for _, v := range p.Variants {
		if strings.Contains(v, "cm") || strings.Contains(v, "extensor") {
			t.Fatalf("pegou texto da descrição como variante: %v", p.Variants)
		}
	}
}

func TestCapturaComTextoCorridoEhDescartada(t *testing.T) {
	sujo := `<html><head><meta property="og:title" content="Peça X" /></head><body>
	<div>C&oacute;d.: X1</div><div>R$10,00</div>
	<div>Tamanho unico servindo em qualquer dedo confortavelmente</div>
	<a>Adicionar ao carrinho</a></body></html>`
	p := Extract(sujo, "https://uselilly.com/x", 0.7)
	if p == nil {
		t.Fatal("não extraiu o produto")
	}
	if len(p.Variants) != 0 {
		t.Errorf("deveria descartar captura suspeita, veio %v", p.Variants)
	}
}

// --- Fotos ----------------------------------------------------------------

const paginaSoComMiniatura = `<html><head>
<meta property="og:title" content="Pulseira Dourada - Torcida" />
</head><body>
<div>C&oacute;d.: PL99</div><div>R$40,00</div><div>Atacado R$28,00</div>
<img src="https://assets.sistemawbuy.com.br/arquivos/abc/produtos/xyz/foto-1_mini.jpg">
<img src="https://assets.sistemawbuy.com.br/arquivos/abc/produtos/xyz/foto-2_mini.jpg">
<a>Adicionar ao carrinho</a>
</body></html>`

const paginaComAsDuas = `<html><head>
<meta property="og:title" content="Anel Com Foto Grande" />
</head><body>
<div>C&oacute;d.: AN99</div><div>R$40,00</div><div>Atacado R$28,00</div>
<img src="https://assets.sistemawbuy.com.br/arquivos/abc/produtos/xyz/foto-1_mini.jpg">
<img src="https://assets.sistemawbuy.com.br/arquivos/abc/produtos/xyz/foto-1.jpg">
<a>Adicionar ao carrinho</a>
</body></html>`

// 233 peças tinham só miniatura e eram recusadas por "sem imagem". A versão
// cheia dessas não existe no servidor da Lilly — o _mini é a foto real.
func TestAceitaMiniaturaQuandoNaoHaFotoCheia(t *testing.T) {
	p := Extract(paginaSoComMiniatura, "https://uselilly.com/pulseira", 0.7)
	if p == nil {
		t.Fatal("não extraiu o produto")
	}
	if len(p.Images) != 2 {
		t.Fatalf("esperava 2 fotos, veio %v", p.Images)
	}
	for _, img := range p.Images {
		if !strings.Contains(img, "_mini") {
			t.Errorf("esperava miniatura, veio %q", img)
		}
	}
}

// Onde a foto cheia existe, ela continua ganhando — a miniatura é plano B.
func TestPreferefotoCheiaQuandoExistem_As_Duas(t *testing.T) {
	p := Extract(paginaComAsDuas, "https://uselilly.com/anel", 0.7)
	if p == nil {
		t.Fatal("não extraiu o produto")
	}
	if len(p.Images) != 1 {
		t.Fatalf("esperava só a foto cheia, veio %v", p.Images)
	}
	if strings.Contains(p.Images[0], "_mini") {
		t.Errorf("escolheu a miniatura tendo a cheia: %q", p.Images[0])
	}
}

// Logo, banner e selo vivem fora de /produtos/ e não podem virar foto de peça.
func TestIgnoraImagemForaDeProdutos(t *testing.T) {
	pagina := `<html><head><meta property="og:title" content="Peça Y" /></head><body>
	<div>C&oacute;d.: Y1</div><div>R$40,00</div>
	<img src="https://assets.sistemawbuy.com.br/arquivos/abc/config/logo.png">
	<img src="https://assets.sistemawbuy.com.br/arquivos/abc/selos/selo.png">
	<a>Adicionar ao carrinho</a></body></html>`
	p := Extract(pagina, "https://uselilly.com/y", 0.7)
	if p == nil {
		t.Fatal("não extraiu o produto")
	}
	if len(p.Images) != 0 {
		t.Errorf("pegou imagem que não é do produto: %v", p.Images)
	}
}

// ---------------------------------------------------------------------------
// Mais vendidos
// ---------------------------------------------------------------------------

// A ORDEM é o dado: a primeira da vitrine vende mais que a última. Um extrator
// que devolvesse conjunto sem ordem destruiria a única informação da página.
func TestBestSellersPreservaAOrdem(t *testing.T) {
	html := `<html><body>
	<a href="/pulseira-no/">Pulseira Nó</a>
	<a href="/anel-basic/">Anel Basic</a>
	<a href="/colar-triplo-lola/">Colar Triplo Lola</a>
	</body></html>`

	slugs := extrairMaisVendidos(html)
	esperado := []string{"pulseira-no", "anel-basic", "colar-triplo-lola"}
	if len(slugs) != len(esperado) {
		t.Fatalf("esperava %d slugs, veio %d: %v", len(esperado), len(slugs), slugs)
	}
	for i := range esperado {
		if slugs[i] != esperado[i] {
			t.Errorf("posição %d: esperava %q, veio %q", i, esperado[i], slugs[i])
		}
	}
}

// O card do produto aparece duas vezes no HTML (grade e carrossel do rodapé).
// Sem deduplicar, a mesma peça ocuparia dois postos do pódio.
func TestBestSellersNaoRepete(t *testing.T) {
	html := `<a href="/anel-basic/">x</a><a href="/pulseira-no/">y</a><a href="/anel-basic/">x de novo</a>`
	slugs := extrairMaisVendidos(html)
	if len(slugs) != 2 {
		t.Fatalf("esperava 2 slugs sem repetição, veio %v", slugs)
	}
	if slugs[0] != "anel-basic" {
		t.Errorf("a primeira aparição deve valer a posição, veio %q", slugs[0])
	}
}

// Menu, rodapé e institucional moram no mesmo HTML da vitrine. Se entrassem na
// lista, o "mais vendido nº 1" da loja poderia ser a página de contato.
func TestBestSellersIgnoraQueNaoEhProduto(t *testing.T) {
	html := `<html><body>
	<a href="/colecoes/">Coleções</a>
	<a href="/best-seller/">Mais vendidos</a>
	<a href="/m/trocas-e-devolucoes/">Trocas</a>
	<a href="/berloques/">Berloques</a>
	<a href="/aneis/">Anéis</a>
	<a href="/pulseira-no/">Pulseira Nó</a>
	</body></html>`

	slugs := extrairMaisVendidos(html)
	if len(slugs) != 1 || slugs[0] != "pulseira-no" {
		t.Errorf("deixou passar página que não é produto: %v", slugs)
	}
}
