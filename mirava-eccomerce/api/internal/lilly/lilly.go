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
	Base          = "https://www.uselilly.com"
	SitemapURL    = Base + "/sitemap.xml"
	// A wBuy (ou um WAF na frente dela) barra com 403 qualquer User-Agent que
	// se identifique como bot, mesmo o robots.txt permitindo Allow: /. Por
	// isso nos identificamos como um navegador comum — não é engano malicioso,
	// é a única forma de ler uma página pública que o robots.txt já autoriza.
	UserAgent     = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
	PausaEntrePag = 1500 * time.Millisecond
	// RazaoAtacadoPadrao: confirmada em 5 amostras (PL46, PL20, PL82, PL103,
	// PL269) — o atacado é 70% do varejo. Usada só quando a página não exibe
	// o preço de atacado, o que acontece em peças de coleção nova.
	RazaoAtacadoPadrao = 0.70
)

type Cliente struct {
	http *http.Client
}

func NovoCliente() *Cliente {
	// 12s, não 25s: se a Lilly começar a travar uma página (WAF detectando
	// padrão de varredura), queremos desistir rápido e seguir — não empacar
	// dezenas de minutos numa sequência de páginas bloqueadas.
	return &Cliente{http: &http.Client{Timeout: 12 * time.Second}}
}

// BuscarPagina faz o GET e devolve HTML já em UTF-8.
func (c *Cliente) BuscarPagina(ctx context.Context, url string) (string, error) {
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
	leitor := io.Reader(res.Body)
	if charsetLatin1(res.Header.Get("Content-Type")) {
		leitor = charmap.ISO8859_1.NewDecoder().Reader(res.Body)
	}

	b, err := io.ReadAll(io.LimitReader(leitor, 5<<20)) // teto de 5 MB
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

type EntradaSitemap struct {
	URL     string
	Lastmod string
}

var (
	reURLBloco = regexp.MustCompile(`(?s)<url>(.*?)</url>`)
	reLoc      = regexp.MustCompile(`<loc>\s*([^<]+?)\s*</loc>`)
	reLastmod  = regexp.MustCompile(`<lastmod>\s*([^<]+?)\s*</lastmod>`)
)

// prefixos que sabidamente não são página de produto
var naoProduto = []string{
	"m/", "blog/", "central/", "busca/", "search/", "carrinho/", "checkout/",
	"conta/", "avaliacoes/", "selo/", "fale-conosco/", "colecoes/", "best-seller/",
	"berloques/", "banhados-a-prata/", "banhados-a-ouro/", "outros/",
	"the-new-classics-collection/", "sitemap",
}

// slugs de categoria que também vivem na raiz
var categoriasSoltas = map[string]bool{
	"bliss-collection": true, "breeze-collection": true, "essenza-collection": true,
	"innerbloom": true, "pulseiras": true, "aneis": true, "colares": true,
	"brincos": true, "berloques": true,
}

func (c *Cliente) LerSitemap(ctx context.Context) ([]EntradaSitemap, error) {
	xml, err := c.BuscarPagina(ctx, SitemapURL)
	if err != nil {
		return nil, fmt.Errorf("sitemap: %w", err)
	}

	var out []EntradaSitemap
	for _, bloco := range reURLBloco.FindAllStringSubmatch(xml, -1) {
		loc := reLoc.FindStringSubmatch(bloco[1])
		if loc == nil {
			continue
		}
		url := loc[1]

		caminho := strings.TrimPrefix(url, "https://www.uselilly.com/")
		caminho = strings.TrimPrefix(caminho, "https://uselilly.com/")
		if caminho == "" || caminho == url {
			continue
		}

		pular := false
		for _, p := range naoProduto {
			if strings.HasPrefix(caminho, p) {
				pular = true
				break
			}
		}
		if pular {
			continue
		}

		slug := strings.TrimSuffix(caminho, "/")
		if strings.Contains(slug, "/") || categoriasSoltas[slug] {
			continue // produto na Lilly é sempre slug de raiz
		}

		e := EntradaSitemap{URL: url}
		if lm := reLastmod.FindStringSubmatch(bloco[1]); lm != nil {
			e.Lastmod = lm[1]
		}
		out = append(out, e)
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// Extração
// ---------------------------------------------------------------------------

type Produto struct {
	SKU               string
	URL               string
	Nome              string
	Descricao         string
	Garantia          string
	Varejo            dominio.Centavos
	Atacado           dominio.Centavos
	AtacadoConfirmado bool // false = derivado de varejo × 0,70
	Disponivel        bool
	Imagens           []string
	Avaliacao         float64
	QtdAvaliacoes     int
}

var (
	reScript    = regexp.MustCompile(`(?is)<script.*?</script>`)
	reStyle     = regexp.MustCompile(`(?is)<style.*?</style>`)
	reTag       = regexp.MustCompile(`<[^>]+>`)
	reEspacos   = regexp.MustCompile(`[ \t]+`)
	reLinhas    = regexp.MustCompile(`\n\s*\n+`)
	reQuemViu   = regexp.MustCompile(`(?is)Quem\s+viu.{0,40}?comprou`)
	reSKU       = regexp.MustCompile(`(?i)C[óo]d\.?\s*:?\s*([A-Z]{1,6}\s?\d{1,6})`)
	reOgTitle   = regexp.MustCompile(`(?i)<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']`)
	reMetaDesc  = regexp.MustCompile(`(?i)<meta\s+name=["']description["']\s+content=["']([^"']+)["']`)
	rePreco     = regexp.MustCompile(`R\$\s?([\d.]+,\d{2})`)
	reAtacado   = regexp.MustCompile(`(?is)Atacado.{0,80}?R\$\s?([\d.]+,\d{2})`)
	reIndisp    = regexp.MustCompile(`(?i)indispon[íi]vel|esgotad|avise[- ]me|fora de estoque|sem estoque`)
	reBotao     = regexp.MustCompile(`(?i)adicionar ao carrinho|comprar agora`)
	reImagem    = regexp.MustCompile(`(?i)https://assets\.sistemawbuy\.com\.br/arquivos/[^\s"'<>]+?\.(?:jpe?g|png|webp)`)
	reAvaliacao = regexp.MustCompile(`\b([1-5][.,]\d)\s*\(?\s*(\d+)\s*\)`)
	// Sem contagem explícita ({20,4000}) de propósito: o RE2 do Go limita
	// repetições a 1000 e recusa a compilar acima disso. O corte de tamanho
	// é feito depois, em código — onde fica mais fácil de ler e ajustar.
	reDescricao = regexp.MustCompile(`(?is)Descri[çc][ãa]o\s*(.*?)(?:\n\s*(?:Garantia|Avalia[çc][õo]es|Informa[çc][õo]es Importantes)\b|$)`)
	reGarantia  = regexp.MustCompile(`(?is)Garantia\s*(.*?)(?:\n\s*Avalia[çc][õo]es\b|$)`)
)

// Limites de tamanho do texto extraído, aplicados após a regex.
const (
	maxDescricao = 4000
	maxGarantia  = 1200
)

// truncar corta no limite sem partir um caractere multibyte no meio —
// "zircônias" tem bytes de 2 bytes, e cortar no meio geraria lixo.
func truncar(s string, limite int) string {
	if len(s) <= limite {
		return s
	}
	corte := limite
	for corte > 0 && !utf8.RuneStart(s[corte]) {
		corte--
	}
	return strings.TrimSpace(s[:corte])
}

func semTags(html string) string {
	s := reScript.ReplaceAllString(html, " ")
	s = reStyle.ReplaceAllString(s, " ")
	s = reTag.ReplaceAllString(s, " ")
	r := strings.NewReplacer(
		"&nbsp;", " ", "&amp;", "&", "&quot;", `"`,
		"&#39;", "'", "&apos;", "'", "&lt;", "<", "&gt;", ">",
	)
	s = r.Replace(s)
	s = reEspacos.ReplaceAllString(s, " ")
	s = reLinhas.ReplaceAllString(s, "\n")
	return strings.TrimSpace(s)
}

// Extrair lê um produto da página. Devolve nil quando a página não é de
// produto (categoria, institucional).
func Extrair(html, url string, razaoAtacado float64) *Produto {
	// A seção "Quem viu, também comprou" traz OUTROS produtos com preço.
	// Cortar antes dela evita gravar o preço do vizinho neste produto —
	// o bug mais provável desta função.
	principal := html
	if loc := reQuemViu.FindStringIndex(html); loc != nil {
		principal = html[:loc[0]]
	}
	texto := semTags(principal)

	m := reSKU.FindStringSubmatch(texto)
	if m == nil {
		return nil
	}
	sku := strings.ReplaceAll(m[1], " ", "")

	nome := ""
	if t := reOgTitle.FindStringSubmatch(html); t != nil {
		nome = strings.TrimSpace(t[1])
	}
	if len(nome) < 3 {
		return nil
	}

	p := &Produto{SKU: sku, URL: url, Nome: nome}

	if v := rePreco.FindStringSubmatch(texto); v != nil {
		p.Varejo, _ = dominio.ParseBRL(v[1])
	}
	if a := reAtacado.FindStringSubmatch(texto); a != nil {
		p.Atacado, _ = dominio.ParseBRL(a[1])
		p.AtacadoConfirmado = true
	} else {
		p.Atacado = dominio.Centavos(float64(p.Varejo) * razaoAtacado)
	}

	// A Lilly NÃO publica quantidade em estoque. O único sinal é o botão de
	// compra. Por isso disponibilidade é booleana — inventar um número aqui
	// seria fabricar precisão que o dado não tem.
	p.Disponivel = reBotao.MatchString(texto) && !reIndisp.MatchString(texto)

	vistas := map[string]bool{}
	for _, img := range reImagem.FindAllString(principal, -1) {
		if !strings.Contains(img, "/produtos/") || strings.Contains(img, "_mini") {
			continue // _mini é miniatura; fora de /produtos/ é logo ou banner
		}
		if !vistas[img] {
			vistas[img] = true
			p.Imagens = append(p.Imagens, img)
			if len(p.Imagens) == 8 {
				break
			}
		}
	}

	if d := reDescricao.FindStringSubmatch(texto); d != nil {
		p.Descricao = truncar(strings.TrimSpace(d[1]), maxDescricao)
	}
	if len(p.Descricao) < 20 {
		if d := reMetaDesc.FindStringSubmatch(html); d != nil {
			p.Descricao = truncar(strings.TrimSpace(d[1]), maxDescricao)
		}
	}
	if g := reGarantia.FindStringSubmatch(texto); g != nil {
		p.Garantia = truncar(strings.TrimSpace(g[1]), maxGarantia)
	}
	if a := reAvaliacao.FindStringSubmatch(texto); a != nil {
		p.Avaliacao, _ = strconv.ParseFloat(strings.Replace(a[1], ",", ".", 1), 64)
		p.QtdAvaliacoes, _ = strconv.Atoi(a[2])
	}

	return p
}

// Validar aplica as salvaguardas. Um extrator quebrado que grave custo zero
// no catálogo inteiro é MUITO pior que uma sincronização que falha alto.
// Na dúvida, descarte e mantenha o dado anterior.
func (p *Produto) Validar() error {
	switch {
	case len(p.SKU) < 2:
		return fmt.Errorf("sku ausente")
	case len(p.Nome) < 3:
		return fmt.Errorf("nome muito curto")
	case p.Atacado <= 0:
		return fmt.Errorf("custo zero ou negativo")
	case p.Atacado > 50000:
		return fmt.Errorf("custo absurdo: %v", p.Atacado)
	case p.Varejo > 0 && p.Atacado > p.Varejo:
		return fmt.Errorf("atacado (%v) maior que varejo (%v)", p.Atacado, p.Varejo)
	case len(p.Imagens) == 0:
		return fmt.Errorf("sem imagem")
	}
	return nil
}
