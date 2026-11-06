package web

import "testing"

// Decisão 27: o papel de despacho só abre pedidos e lote.
func TestDespachoSoAbrePedidosELote(t *testing.T) {
	libera := []string{"/admin/eu", "/admin/pedidos", "/admin/pedidos/abc/despachar", "/admin/lotes/x/comprar"}
	barra := []string{"/admin/financeiro", "/admin/produtos", "/admin/loja", "/admin/clientes/1/cupom", "/admin/pedidosx", "/admin/equipe"}
	for _, p := range libera {
		if !dispatchAllowed(p) {
			t.Errorf("%s deveria abrir para o despacho", p)
		}
	}
	for _, p := range barra {
		if dispatchAllowed(p) {
			t.Errorf("%s não pode abrir para o despacho", p)
		}
	}
}

// Painel só aceita foto servida pela própria API e link da loja/Instagram.
func TestImagemELinkDoPainel(t *testing.T) {
	ok, ruim := "/images/uploads/banners/a.jpg", "https://evil.example/x.jpg"
	if !imagemPropria(&ok) || imagemPropria(&ruim) {
		t.Error("imagem própria")
	}
	for _, u := range []string{"/categoria/aneis/todos", "https://www.instagram.com/miravajoias"} {
		if !linkInterno(u) {
			t.Errorf("%s deveria valer", u)
		}
	}
	for _, u := range []string{"//evil.example", "https://evil.example", "javascript:alert(1)"} {
		if linkInterno(u) {
			t.Errorf("%s não pode valer", u)
		}
	}
}

// O endereço da coleção sai do nome: sem acento, minúsculo, hífen no lugar de
// espaço e símbolo (é a URL pública, /colecoes/<slug>).
func TestSlugDaColecao(t *testing.T) {
	cases := map[string]string{
		"It Girl Era":        "it-girl-era",
		"  Luz Própria  ":    "luz-propria",
		"Coração & Brilho!":  "coracao-brilho",
		"Verão 2026 — Praia": "verao-2026-praia",
	}
	for in, want := range cases {
		if got := slugFrom(in); got != want {
			t.Errorf("slugFrom(%q) = %q, esperado %q", in, got, want)
		}
		if !collectionSlugRe.MatchString(want) {
			t.Errorf("%q não é um endereço válido", want)
		}
	}
	if slugFrom("!!!") != "" {
		t.Error("nome sem letra não pode virar endereço")
	}
}
