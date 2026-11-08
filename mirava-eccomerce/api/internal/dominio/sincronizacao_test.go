package dominio

import (
	"os"
	"regexp"
	"strings"
	"testing"
	"time"
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

// Uma leitura barrada pela Lilly não "vê" peça nenhuma: sem esta trava, o fim
// da rodada marcaria o catálogo inteiro como sumido.
func TestSafeToMarkVanished(t *testing.T) {
	cases := []struct {
		name        string
		seen, known int
		want        bool
	}{
		{"catálogo vazio", 0, 0, true},
		{"todas vistas", 2000, 2000, true},
		{"algumas saíram de linha", 1900, 2000, true},
		{"exatamente no limite", 1600, 2000, true},
		{"logo abaixo do limite", 1599, 2000, false},
		{"leitura barrada: nada visto", 0, 2000, false},
	}
	for _, c := range cases {
		if got := SafeToMarkVanished(c.seen, c.known); got != c.want {
			t.Errorf("%s: SafeToMarkVanished(%d, %d) = %v, quero %v", c.name, c.seen, c.known, got, c.want)
		}
	}
}

func TestPlanSync(t *testing.T) {
	agora := time.Date(2026, 11, 8, 10, 0, 0, 0, time.UTC)
	recente := agora.Add(-24 * time.Hour)
	antigo := agora.Add(-10 * 24 * time.Hour)
	maisAntigo := agora.Add(-20 * 24 * time.Hour)

	entradas := []SyncEntry{
		{URL: "/nova", Lastmod: "2026-11-08"},      // nunca lida
		{URL: "/mudou", Lastmod: "2026-11-07"},     // lastmod diferente
		{URL: "/igual", Lastmod: "2026-10-01"},     // igual e lida ontem
		{URL: "/velha", Lastmod: "2026-10-01"},     // igual, mas lida há 10 dias
		{URL: "/mais-velha", Lastmod: ""},          // sem lastmod, lida há 20 dias
		{URL: "/sem-lastmod-recente", Lastmod: ""}, // sem lastmod, lida ontem
		{URL: "/semeada", Lastmod: "2026-11-01"},   // conhecida sem lastmod guardado
	}
	conhecidas := map[string]SyncKnown{
		"/mudou":               {Lastmod: "2026-10-01", CheckedAt: recente},
		"/igual":               {Lastmod: "2026-10-01", CheckedAt: recente},
		"/velha":               {Lastmod: "2026-10-01", CheckedAt: antigo},
		"/mais-velha":          {CheckedAt: maisAntigo},
		"/sem-lastmod-recente": {CheckedAt: recente},
		"/semeada":             {CheckedAt: recente},
	}

	ler := PlanSync(entradas, conhecidas, agora, 10)
	quero := []string{"/nova", "/mudou", "/mais-velha", "/velha"}
	if len(ler) != len(quero) {
		t.Fatalf("leria %v, quero %v", ler, quero)
	}
	for i := range quero {
		if ler[i] != quero[i] {
			t.Fatalf("ordem %v, quero %v (novas e mudadas antes, depois as mais antigas)", ler, quero)
		}
	}

	// Teto por rodada: as novas e mudadas têm prioridade.
	if ler := PlanSync(entradas, conhecidas, agora, 3); len(ler) != 3 || ler[2] != "/mais-velha" {
		t.Errorf("com teto 3 leu %v", ler)
	}
	if ler := PlanSync(entradas, conhecidas, agora, 1); len(ler) != 1 || ler[0] != "/nova" {
		t.Errorf("com teto 1 leu %v", ler)
	}
}
