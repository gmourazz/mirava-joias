package auth

import (
	"context"
	"testing"
)

// Sessão da loja e sessão do painel não se misturam (decisão 46): a cliente
// logada na loja não entra no painel, e o token do painel não vale na loja.
func TestSessoesSeparadas(t *testing.T) {
	v := New("segredo-de-teste")

	loja, err := v.IssueToken("cliente-1", "cliente@exemplo.com")
	if err != nil {
		t.Fatal(err)
	}
	painel, err := v.IssueAdminToken("admin-1")
	if err != nil {
		t.Fatal(err)
	}

	if _, err := v.ValidateAdmin(loja); err == nil {
		t.Error("token da loja abriu o painel")
	}
	if _, err := v.Validate(context.Background(), painel); err == nil {
		t.Error("token do painel valeu na loja")
	}
	id, err := v.ValidateAdmin(painel)
	if err != nil || id != "admin-1" {
		t.Errorf("token do painel recusado: %q, %v", id, err)
	}
	if u, err := v.Validate(context.Background(), loja); err != nil || u.ID != "cliente-1" {
		t.Errorf("token da loja recusado: %v", err)
	}
}
