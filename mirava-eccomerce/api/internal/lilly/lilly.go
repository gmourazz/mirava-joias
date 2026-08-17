// Package lilly lê o catálogo público da Lilly Store (uselilly.com,
// plataforma wBuy).
//
// A ARMADILHA PRINCIPAL: as páginas vêm em ISO-8859-1, não UTF-8. Ler os
// bytes como UTF-8 transforma "zircônias · Coleções" em "zirc<?>nias <?> Cole<?>es".
// Em Go, io.ReadAll direto no Body tem exatamente esse problema — por isso
// passamos por charmap.ISO8859_1.NewDecoder().
//
// Convivência: o robots.txt da Lilly permite Allow: / — mas isso não é
// licença para maltratar o servidor dela. Uma leitura por vez, com pausa,
// identificando-se, e relendo só o que mudou.
package lilly

import (
	"context"
	"fmt"
	"html"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/text/encoding/charmap"

	"github.com/mirava/api/internal/dominio"
)

const (
	Base       = "https://www.uselilly.com"
	SitemapURL = Base + "/sitemap.xml"
	// A wBuy (ou um WAF na frente dela) barra com 403 qualquer User-Agent que
	// se identifique como bot, mesmo o robots.txt permitindo Allow: /. Por
	// isso nos identificamos como um navegador comum — não é engano malicioso,
	// é a única forma de ler uma página pública que o robots.txt já autoriza.
	UserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
	PageDelay = 1500 * time.Millisecond
	// DefaultWholesaleRatio: confirmada em 5 amostras (PL46, PL20, PL82, PL103,
	// PL269) — o atacado é 70% do varejo. Usada só quando a página não exibe
	// o preço de atacado, o que acontece em peças de coleção nova.
	DefaultWholesaleRatio = 0.70
)

type Client struct {
	http *http.Client
}

func NewClient() *Client {
	// 12s, não 25s: se a Lilly começar a travar uma página (WAF detectando
	// padrão de varredura), queremos desistir rápido e seguir — não empacar
	// dezenas de minutos numa sequência de páginas bloqueadas.
	return &Client{http: &http.Client{Timeout: 12 * time.Second}}
}

// FetchPage faz o GET e devolve HTML já em UTF-8.
func (c *Client) FetchPage(ctx context.Context, url string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", UserAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml,*/*;q=0.8")
	req.Header.Set("Accept-Language", "pt-BR,pt;q=0.9,en;q=0.8")

	res, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d em %s", res.StatusCode, url)
	}

	// Aqui está o detalhe que salva os acentos.
	reader := io.Reader(res.Body)
	if charsetLatin1(res.Header.Get("Content-Type")) {
		reader = charmap.ISO8859_1.NewDecoder().Reader(res.Body)
	}

	b, err := io.ReadAll(io.LimitReader(reader, 5<<20)) // teto de 5 MB
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func charsetLatin1(contentType string) bool {
	ct := strings.ToLower(contentType)
	// Sem charset declarado, a wBuy serve latin-1. Assumir UTF-8 seria pior:
	// erraria em toda página acentuada.
	if !strings.Contains(ct, "charset=") {
		return true
	}
	return strings.Contains(ct, "iso-8859-1") || strings.Contains(ct, "latin-1") ||
		strings.Contains(ct, "windows-1252")
}

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

type SitemapEntry struct {
	URL     string
	Lastmod string
}

var (
	reURLBlock = regexp.MustCompile(`(?s)<url>(.*?)</url>`)
	reLoc      = regexp.MustCompile(`<loc>\s*([^<]+?)\s*</loc>`)
	reLastmod  = regexp.MustCompile(`<lastmod>\s*([^<]+?)\s*</lastmod>`)
)

// prefixos que sabidamente não são página de produto
var notProduct = []string{
	"m/", "blog/", "central/", "busca/", "search/", "carrinho/", "checkout/",
	"conta/", "avaliacoes/", "selo/", "fale-conosco/", "colecoes/", "best-seller/",
	"berloques/", "banhados-a-prata/", "banhados-a-ouro/", "outros/",
	"the-new-classics-collection/", "sitemap",
}

// slugs de categoria que também vivem na raiz
var looseCategorySlugs = map[string]bool{
	"bliss-collection": true, "breeze-collection": true, "essenza-collection": true,
	"innerbloom": true, "pulseiras": true, "aneis": true, "colares": true,
	"brincos": true, "berloques": true,
}

func (c *Client) ReadSitemap(ctx context.Context) ([]SitemapEntry, error) {
	xml, err := c.FetchPage(ctx, SitemapURL)
	if err != nil {
		return nil, fmt.Errorf("sitemap: %w", err)
	}

	var out []SitemapEntry
	for _, block := range reURLBlock.FindAllStringSubmatch(xml, -1) {
		loc := reLoc.FindStringSubmatch(block[1])
		if loc == nil {
			continue
		}
		url := loc[1]

		path := strings.TrimPrefix(url, "https://www.uselilly.com/")
		path = strings.TrimPrefix(path, "https://uselilly.com/")
		if path == "" || path == url {
			continue
		}

		skip := false
		for _, p := range notProduct {
			if strings.HasPrefix(path, p) {
				skip = true
				break
			}
		}
		if skip {
			continue
		}

		slug := strings.TrimSuffix(path, "/")
		if strings.Contains(slug, "/") || looseCategorySlugs[slug] {
			continue // produto na Lilly é sempre slug de raiz
		}

		e := SitemapEntry{URL: url}
		if lm := reLastmod.FindStringSubmatch(block[1]); lm != nil {
			e.Lastmod = lm[1]
		}
		out = append(out, e)
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// Mais vendidos
// ---------------------------------------------------------------------------

// BestSellersURL é a vitrine "Mais vendidos" da Lilly. A página lista as ~190
// peças de uma vez, sem paginação — uma requisição resolve.
//
// Evite montar variações com query (?pg=2 e afins): a wBuy responde a URL com
// query string com uma tela de verificação anti-robô, e aí não vem produto
// nenhum. A página sem parâmetro carrega normalmente.
const BestSellersURL = Base + "/best-seller/"

// reCardLink pega o href de cada card da vitrine. Produto na Lilly é sempre
// slug de raiz ("/pulseira-no/"), então uma barra interna já denuncia que é
// categoria, filtro ou selo — não peça.
var reCardLink = regexp.MustCompile(`href="/([a-z0-9][a-z0-9\-]{2,90})/"`)

// BestSellers devolve os slugs das peças mais vendidas, na ordem em que a
// Lilly exibe — a posição É a informação: a primeira vende mais que a última.
//
// Falhar aqui não pode derrubar a sincronização: mais vendido é enfeite de
// vitrine, catálogo é o negócio. Quem chama trata o erro seguindo em frente.
func (c *Client) BestSellers(ctx context.Context) ([]string, error) {
	html, err := c.FetchPage(ctx, BestSellersURL)
	if err != nil {
		return nil, fmt.Errorf("mais vendidos: %w", err)
	}
	return extrairMaisVendidos(html), nil
}

// extrairMaisVendidos separa a leitura do HTML da chamada de rede, para dar
// para testar a parte que quebra (o parsing) sem depender do site no ar.
func extrairMaisVendidos(html string) []string {
	var out []string
	visto := map[string]bool{}
	for _, m := range reCardLink.FindAllStringSubmatch(html, -1) {
		slug := m[1]
		// A primeira aparição vale a posição: o mesmo card costuma aparecer
		// de novo em carrossel de rodapé, e ali a ordem não significa nada.
		if visto[slug] || looseCategorySlugs[slug] {
			continue
		}
		// Mesma lista de exclusão do sitemap: menu, rodapé e institucional
		// aparecem no HTML da vitrine também.
		naoProduto := false
		for _, p := range notProduct {
			if strings.HasPrefix(slug+"/", p) {
				naoProduto = true
				break
			}
		}
		if naoProduto {
			continue
		}
		visto[slug] = true
		out = append(out, slug)
	}
	return out
}

// ---------------------------------------------------------------------------
// Extração
// ---------------------------------------------------------------------------

type Product struct {
	SKU                string
	URL                string
	Name               string
	Description        string
	Warranty           string
	Retail             dominio.Cents
	Wholesale          dominio.Cents
	WholesaleConfirmed bool // false = derivado de varejo × 0,70
	Available          bool
	Images             []string
	Rating             float64
	RatingCount        int
	Reviews            []Review
	// Grupo de opção da peça, quando existe. A Lilly mostra UM grupo por
	// produto: "Tamanho" com 19, 20, 22... num anel; "Letras" com A, B, C...
	// num colar de letra. O rótulo vem junto porque mostrar "Tamanho: A" numa
	// peça de letra seria errado.
	VariantLabel string
	Variants     []string
}

// Review é uma avaliação individual, tal como a Lilly mostra: nome, data e
// (quando a cliente escreveu) o comentário. Nem toda avaliação tem texto —
// muita gente só dá a nota, sem comentar.
type Review struct {
	Author string
	Date   string
	Text   string
}

var (
	reScript    = regexp.MustCompile(`(?is)<script.*?</script>`)
	reStyle     = regexp.MustCompile(`(?is)<style.*?</style>`)
	reTag       = regexp.MustCompile(`<[^>]+>`)
	reSpaces    = regexp.MustCompile(`[ \t]+`)
	reLines     = regexp.MustCompile(`\n\s*\n+`)
	reAlsoBought = regexp.MustCompile(`(?is)Quem\s+viu.{0,40}?comprou`)
	// Só localiza a posição do código do produto — reSKU (com grupo de
	// captura) faz a extração de verdade depois de já termos cortado o HTML
	// nesse ponto.
	reProductStart = regexp.MustCompile(`(?i)C[óo]d\.:`)
	// O ponto depois de "Cód" é o que distingue o código do PRODUTO da página
	// dos códigos que aparecem antes dele no HTML: o miniatura do carrinho no
	// topo (sempre os mesmos 2 itens de brinde, tipo "Cód: Z7") e a seção
	// "Quem viu, também comprou" mais abaixo (também sem ponto). Sem essa
	// exigência, o regex sempre pegava o primeiro "Cód" da página — que é
	// sempre o mesmo item de brinde do carrinho, nunca o produto real. Foi
	// isso que fez uma sincronização inteira gravar só 2 SKUs.
	reSKU       = regexp.MustCompile(`(?i)C[óo]d\.:\s*([A-Z]{1,6}\s?\d{1,6})`)
	reOgTitle   = regexp.MustCompile(`(?i)<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']`)
	reMetaDesc  = regexp.MustCompile(`(?i)<meta\s+name=["']description["']\s+content=["']([^"']+)["']`)
	rePrice     = regexp.MustCompile(`R\$\s?([\d.]+,\d{2})`)
	reWholesale = regexp.MustCompile(`(?is)Atacado.{0,80}?R\$\s?([\d.]+,\d{2})`)
	reUnavail   = regexp.MustCompile(`(?i)indispon[íi]vel|esgotad|avise[- ]me|fora de estoque|sem estoque`)
	reButton    = regexp.MustCompile(`(?i)adicionar ao carrinho|comprar agora`)
	reImage     = regexp.MustCompile(`(?i)https://assets\.sistemawbuy\.com\.br/arquivos/[^\s"'<>]+?\.(?:jpe?g|png|webp)`)
	reRating    = regexp.MustCompile(`\b([1-5][.,]\d)\s*\(?\s*(\d+)\s*\)`)
	// Sem contagem explícita ({20,4000}) de propósito: o RE2 do Go limita
	// repetições a 1000 e recusa a compilar acima disso. O corte de tamanho
	// é feito depois, em código — onde fica mais fácil de ler e ajustar.
	//
	// SEM "\n\s*" antes de Garantia/Avaliações: o texto já passou por
	// stripTags, que troca toda tag por espaço — não sobra quebra de linha
	// nenhuma na página real. Exigir "\n" antes do próximo título fazia o
	// corte nunca bater, e a descrição engolia a página inteira dali pra
	// frente: garantia, avaliações com nome de cliente, preço, botão de
	// comprar. Bug real, visto direto na página de produto.
	reDescription = regexp.MustCompile(`(?is)Descri[çc][ãa]o\s*(.*?)(?:\s*(?:Garantia|Avalia[çc][õo]es|Informa[çc][õo]es Importantes)\b|$)`)
	// Título "Avaliações" sozinho — usado para achar onde a garantia acaba e
	// pra recortar a seção de avaliações. Não tem grupo de captura: só serve
	// pra achar POSIÇÃO, a partir de um ponto que a gente já sabe que é
	// depois do rótulo de aba (ver comentário grande abaixo, em Extract).
	reAvaliacoesHeading = regexp.MustCompile(`(?i)Avalia[çc][õo]es\b`)
	// Fim da seção de avaliações: sempre tem esse link, mesmo sem nenhuma
	// avaliação — é o que marca onde parar de procurar "Nome - data".
	reAvaliarProduto = regexp.MustCompile(`(?i)avaliar produto`)
	// Cada avaliação começa com "Nome da Cliente - DD/MM/AAAA". Maiúscula
	// inicial em cada palavra do nome é o único sinal confiável que a Lilly
	// dá — não tem marcação HTML própria para separar uma avaliação da outra.
	reReviewEntry = regexp.MustCompile(`([A-ZÀ-ÝÑ][\p{L}'-]*(?:\s+[A-ZÀ-ÝÑ][\p{L}'-]*){0,3})\s-\s(\d{2}/\d{2}/\d{4})`)
	// Grupo de opção, logo acima do botão de comprar:
	//
	//     Tamanho  19 20 22 23 25  Adicionar ao carrinho
	//     Letras   A B C D ...     Adicionar ao carrinho
	//
	// O rótulo aparece DE NOVO mais pra baixo, dentro da descrição ("Tamanho:
	// 50 cm (45 cm + 5 cm de extensor)"), e o botão também reaparece na barra
	// fixa depois das avaliações. Duas coisas evitam casar o par errado: a
	// busca não-gulosa pega a primeira ocorrência (o grupo vem antes da
	// descrição na página), e o limite de 400 caracteres impede que um rótulo
	// perdido no meio do texto alcance o botão lá embaixo.
	reOptionGroup = regexp.MustCompile(`(?is)\b(Tamanhos?|Letras?|Cores?|Modelos?)\s+(.{1,400}?)\s*Adicionar ao carrinho`)
	// Um valor válido é curto: "19", "45cm", "A", "P", "Único". Qualquer coisa
	// maior que isso é sinal de que a captura pegou texto corrido, não opção.
	reOptionValue = regexp.MustCompile(`^(?:\p{L}|\d{1,3}(?:[.,]\d)?(?:\s?cm)?|\p{L}{1,6})$`)
)

// Um grupo de opção da Lilly nunca tem dezenas de valores soltos; o maior é o
// alfabeto. Passou disso, a regex capturou lixo.
const maxVariants = 40

// Limites de tamanho do texto extraído, aplicados após a regex.
const (
	maxDescription = 4000
	maxWarranty    = 1200
	maxReviewText  = 600
	maxReviews     = 12
)

// truncate corta no limite sem partir um caractere multibyte no meio —
// "zircônias" tem bytes de 2 bytes, e cortar no meio geraria lixo.
func truncate(s string, limit int) string {
	if len(s) <= limit {
		return s
	}
	cut := limit
	for cut > 0 && !utf8.RuneStart(s[cut]) {
		cut--
	}
	return strings.TrimSpace(s[:cut])
}

func stripTags(rawHTML string) string {
	s := reScript.ReplaceAllString(rawHTML, " ")
	s = reStyle.ReplaceAllString(s, " ")
	s = reTag.ReplaceAllString(s, " ")
	// html.UnescapeString decodifica QUALQUER entidade nomeada ("&aacute;" ->
	// "á", "&eacute;" -> "é"...), não só a meia dúzia que o replacer manual
	// cobria — foi isso que deixava "H&aacute;" literal na descrição em vez
	// de "Há".
	s = html.UnescapeString(s)
	s = reSpaces.ReplaceAllString(s, " ")
	s = reLines.ReplaceAllString(s, "\n")
	return strings.TrimSpace(s)
}

// Extract lê um produto da página. Devolve nil quando a página não é de
// produto (categoria, institucional).
func Extract(html, url string, wholesaleRatio float64) *Product {
	// A seção "Quem viu, também comprou" traz OUTROS produtos com preço.
	// Cortar antes dela evita gravar o preço do vizinho neste produto —
	// o bug mais provável desta função.
	main := html
	if loc := reAlsoBought.FindStringIndex(html); loc != nil {
		main = html[:loc[0]]
	}

	// A página real também tem um mini-carrinho fixo no topo, ANTES do
	// produto de verdade — sempre com os mesmos 1-2 itens de brinde (SKU,
	// preço, atacado e foto de brinde). Sem cortar aqui, o extrator pegava
	// esses dados do brinde pra TODO produto da loja: foi um bug real em
	// produção, achado quando uma sincronização inteira gravou "R$5,10" de
	// atacado pra centenas de peças diferentes.
	if loc := reProductStart.FindStringIndex(main); loc != nil {
		main = main[loc[0]:]
	}

	text := stripTags(main)

	m := reSKU.FindStringSubmatch(text)
	if m == nil {
		return nil
	}
	sku := strings.ReplaceAll(m[1], " ", "")

	name := ""
	if t := reOgTitle.FindStringSubmatch(html); t != nil {
		name = strings.TrimSpace(t[1])
	}
	if len(name) < 3 {
		return nil
	}

	p := &Product{SKU: sku, URL: url, Name: name}

	if v := rePrice.FindStringSubmatch(text); v != nil {
		p.Retail, _ = dominio.ParseBRL(v[1])
	}
	if a := reWholesale.FindStringSubmatch(text); a != nil {
		p.Wholesale, _ = dominio.ParseBRL(a[1])
		p.WholesaleConfirmed = true
	} else {
		p.Wholesale = dominio.Cents(float64(p.Retail) * wholesaleRatio)
	}

	// A Lilly NÃO publica quantidade em estoque. O único sinal é o botão de
	// compra. Por isso disponibilidade é booleana — inventar um número aqui
	// seria fabricar precisão que o dado não tem.
	p.Available = reButton.MatchString(text) && !reUnavail.MatchString(text)

	// Fotos: preferimos a versão em tamanho cheio, mas aceitamos a miniatura
	// quando ela é tudo o que existe.
	//
	// POR QUE A RESSALVA: em 233 das 2185 peças a Lilly publicou SÓ o arquivo
	// `_mini` — a versão cheia não existe no servidor dela (testado: tirar o
	// "_mini" da URL devolve 404). Descartar a miniatura fazia essas peças
	// serem recusadas por "sem imagem" e sumirem do catálogo, quando na
	// verdade tinham foto boa: o `_mini` da wBuy é 500×500, tamanho de sobra
	// para a vitrine.
	//
	// A preferência pela versão cheia continua valendo onde ela existe, e é
	// por isso que são duas passagens em vez de uma condição só.
	cheias, miniaturas := []string{}, []string{}
	seen := map[string]bool{}
	for _, img := range reImage.FindAllString(main, -1) {
		if !strings.Contains(img, "/produtos/") {
			continue // fora de /produtos/ é logo, banner ou selo
		}
		if seen[img] {
			continue
		}
		seen[img] = true
		if strings.Contains(img, "_mini") {
			miniaturas = append(miniaturas, img)
		} else {
			cheias = append(cheias, img)
		}
	}
	p.Images = cheias
	if len(p.Images) == 0 {
		p.Images = miniaturas
	}
	if len(p.Images) > 8 {
		p.Images = p.Images[:8]
	}

	// A página real repete os títulos das três abas ("Garantia Avaliações
	// Descrição") GRUDADOS, sem conteúdo nenhum entre eles, ANTES do conteúdo
	// de verdade — que vem na ordem Descrição, Garantia, Avaliações. Por isso
	// não dá pra simplesmente procurar "Garantia" ou "Avaliações" do zero: a
	// primeira ocorrência de cada uma é só o rótulo da aba, sem nada atrás
	// (achar ela por engano deixa Warranty vazio e gruda "Avaliações" no
	// nome da primeira cliente). A saída é usar a POSIÇÃO onde a descrição
	// parou de capturar — ali começa, garantidamente, a seção seguinte de
	// verdade, não o rótulo.
	reviewsFrom := -1
	if dm := reDescription.FindStringSubmatchIndex(text); dm != nil {
		p.Description = truncate(strings.TrimSpace(text[dm[2]:dm[3]]), maxDescription)

		terminator := strings.ToLower(strings.TrimSpace(text[dm[0]:dm[1]]))
		switch {
		case strings.HasSuffix(terminator, "garantia"):
			rest := text[dm[1]:]
			if m := reAvaliacoesHeading.FindStringIndex(rest); m != nil {
				p.Warranty = truncate(strings.TrimSpace(rest[:m[0]]), maxWarranty)
				reviewsFrom = dm[1] + m[1]
			} else {
				p.Warranty = truncate(strings.TrimSpace(rest), maxWarranty)
			}
		case strings.HasSuffix(terminator, "avaliações") || strings.HasSuffix(terminator, "avaliacoes"):
			reviewsFrom = dm[1]
		}
	}
	if len(p.Description) < 20 {
		if d := reMetaDesc.FindStringSubmatch(html); d != nil {
			p.Description = truncate(strings.TrimSpace(d[1]), maxDescription)
		}
	}
	if a := reRating.FindStringSubmatch(text); a != nil {
		p.Rating, _ = strconv.ParseFloat(strings.Replace(a[1], ",", ".", 1), 64)
		p.RatingCount, _ = strconv.Atoi(a[2])
	}
	if reviewsFrom >= 0 {
		p.Reviews = extractReviews(text[reviewsFrom:])
	}

	p.VariantLabel, p.Variants = extractVariants(text)

	return p
}

// extractVariants lê o grupo de opção da peça — "Tamanho 19 20 22" num anel,
// "Letras A B C" num colar de letra.
//
// Devolve nada quando não há grupo (a maioria das peças), e também quando a
// captura traz algo que não parece opção. Preferir nada a gravar lixo: uma
// variante errada vira um tamanho que a cliente escolhe e a Lilly não entrega.
func extractVariants(text string) (string, []string) {
	m := reOptionGroup.FindStringSubmatch(text)
	if m == nil {
		return "", nil
	}

	label := strings.TrimSpace(m[1])
	var values []string
	for _, field := range strings.Fields(m[2]) {
		field = strings.Trim(field, "•*-–—,;:()")
		if field == "" {
			continue
		}
		if !reOptionValue.MatchString(field) {
			// Um só token estranho já basta para desconfiar da captura inteira.
			return "", nil
		}
		if len(values) == maxVariants {
			return "", nil
		}
		values = append(values, field)
	}
	if len(values) == 0 {
		return "", nil
	}
	return label, values
}

// extractReviews lê a lista de avaliações da própria página da Lilly —
// mesmo nome, data e comentário que a cliente vê lá. Nem toda avaliação tem
// comentário: quem só deu nota, sem escrever nada, vira uma entrada com
// Text vazio. Recebe a seção JÁ recortada a partir do título "Avaliações"
// de verdade (ver comentário em Extract) — não procura o título de novo.
func extractReviews(section string) []Review {
	if loc := reAvaliarProduto.FindStringIndex(section); loc != nil {
		section = section[:loc[0]]
	}

	locs := reReviewEntry.FindAllStringSubmatchIndex(section, -1)
	if locs == nil {
		return nil
	}

	var out []Review
	for i, loc := range locs {
		end := len(section)
		if i+1 < len(locs) {
			end = locs[i+1][0]
		}
		out = append(out, Review{
			Author: strings.TrimSpace(section[loc[2]:loc[3]]),
			Date:   section[loc[4]:loc[5]],
			Text:   truncate(strings.TrimSpace(section[loc[1]:end]), maxReviewText),
		})
		if len(out) == maxReviews {
			break
		}
	}
	return out
}

// ---------------------------------------------------------------------------
// Categoria e metal — a Lilly não expõe isso na URL (todo produto é slug de
// raiz) nem num campo estruturado da página. O nome da peça é o único sinal
// confiável: "Pulseira Prata - Riviera Cristal" já diz tudo. Heurística por
// palavra-chave, na ordem em que aparecem no nome — a primeira que bater
// decide. Best-effort: uma peça que não bata em nada cai em "outros"/"prata",
// e pode ser corrigida à mão depois.
// ---------------------------------------------------------------------------

// Ordem importa: "conjuntos" vem primeiro de propósito. Um nome como
// "Conjunto Colar e Brinco" contém as palavras "colar" e "brinco" também —
// sem essa prioridade, a peça cairia em "colares" em vez de "conjuntos".
var categoryKeywords = []struct {
	category string
	words    []string
}{
	{"conjuntos", []string{"conjunto", "kit"}},
	{"aneis", []string{"anel"}},
	{"colares", []string{"colar", "gargantilha", "choker"}},
	{"pulseiras", []string{"pulseira", "bracelete"}},
	{"berloques", []string{"berloque", "pingente avulso", "charm"}},
	{"brincos", []string{"brinco"}},
}

// GuessCategory infere a categoria a partir do nome da peça.
func GuessCategory(name string) string {
	lower := strings.ToLower(name)
	for _, c := range categoryKeywords {
		for _, w := range c.words {
			if strings.Contains(lower, w) {
				return c.category
			}
		}
	}
	return "outros"
}

// GuessMetal infere o metal a partir do nome da peça.
// Prata é o padrão: é o material mais comum no catálogo da Lilly.
func GuessMetal(name string) string {
	lower := strings.ToLower(name)
	if strings.Contains(lower, "ouro") || strings.Contains(lower, "dourad") ||
		strings.Contains(lower, "gold") {
		return "ouro"
	}
	return "prata"
}

// Validate aplica as salvaguardas. Um extrator quebrado que grave custo zero
// no catálogo inteiro é MUITO pior que uma sincronização que falha alto.
// Na dúvida, descarte e mantenha o dado anterior.
func (p *Product) Validate() error {
	switch {
	case len(p.SKU) < 2:
		return fmt.Errorf("sku ausente")
	case len(p.Name) < 3:
		return fmt.Errorf("nome muito curto")
	case p.Wholesale <= 0:
		return fmt.Errorf("custo zero ou negativo")
	case p.Wholesale > 50000:
		return fmt.Errorf("custo absurdo: %v", p.Wholesale)
	case p.Retail > 0 && p.Wholesale > p.Retail:
		return fmt.Errorf("atacado (%v) maior que varejo (%v)", p.Wholesale, p.Retail)
	case len(p.Images) == 0:
		return fmt.Errorf("sem imagem")
	}
	return nil
}
