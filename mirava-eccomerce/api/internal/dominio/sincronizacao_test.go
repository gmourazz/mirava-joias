package dominio

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

// Bug real (agosto/2026): o código gravava "sucesso"/"parcial" depois que as
// tabelas foram para inglês. O CHECK de syncs.status recusava, o erro era
// ignorado e TODA leitura ficava "running" para sempre, sem contagem. Este
// teste lê o schema e garante que cada status usado no Go é aceito lá.
func TestStatusDaSincronizacaoBateComOSchema(t *testing.T) {
	schema, err := os.ReadFile("../../../db/schema.sql")
	if err != nil {
		t.Skipf("schema.sql não encontrado: %v", err)
	}
	m := regexp.MustCompile(`(?s)create table public\.syncs.*?status\s+text[^;]*?check \(status in\s*\(([^)]*)\)`).FindSubmatch(schema)
	if m == nil {
		t.Fatal("não achei o CHECK de syncs.status no schema")
	}
	aceitos := string(m[1])
	for _, s := range []SyncStatus{SyncRunning, SyncSuccess, SyncPartial, SyncError} {
		if !strings.Contains(aceitos, "'"+string(s)+"'") {
			t.Errorf("status %q não é aceito por syncs.status (%s)", s, aceitos)
		}
	}
}

func TestResultadoDaSincronizacao(t *testing.T) {
	cases := []struct {
		nome              string
		processed, failed int
		timedOut          bool
		want              SyncStatus
		comMensagem       bool
	}{
		{"tudo certo", 2000, 10, false, SyncSuccess, false},
		{"exatamente 10% ainda é sucesso", 1000, 100, false, SyncSuccess, false},
		{"mais de 10% falhou: layout mudou", 1000, 101, false, SyncPartial, true},
		{"tempo esgotado", 500, 0, true, SyncPartial, true},
		{"nada processado", 0, 0, false, SyncSuccess, false},
	}
	for _, c := range cases {
		got, msg := SyncOutcome(c.processed, c.failed, c.timedOut)
		if got != c.want {
			t.Errorf("%s: status %q, esperado %q", c.nome, got, c.want)
		}
		if (msg != "") != c.comMensagem {
			t.Errorf("%s: mensagem %q", c.nome, msg)
		}
	}
}
