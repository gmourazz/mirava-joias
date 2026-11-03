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
