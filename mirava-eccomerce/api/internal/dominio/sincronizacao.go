package dominio

import (
	"sort"
	"time"
)

// Resultado de uma leitura do catálogo da fornecedora.

// SyncStatus são os valores do CHECK de public.syncs.status (db/schema.sql).
// TestStatusDaSincronizacaoBateComOSchema confere que continuam batendo.
type SyncStatus string

const (
	SyncRunning SyncStatus = "running"
	SyncSuccess SyncStatus = "success"
	SyncPartial SyncStatus = "partial"
	SyncError   SyncStatus = "error"
)

// MaxSyncFailureRate: acima disto, a leitura é "parcial" — quase sempre o
// layout do site da Lilly mudou e o extrator precisa de ajuste.
const MaxSyncFailureRate = 0.10

// MaxBlockedInARow é quantas páginas de proteção seguidas encerram a leitura.
// Insistir não adianta (a tela vale para todas as páginas) e só prolonga o
// bloqueio.
const MaxBlockedInARow = 10

// MinSeenForVanish é a fração do espelho que a leitura precisa ter visto para
// poder concluir que o resto saiu de linha.
const MinSeenForVanish = 0.8

// SafeToMarkVanished diz se a leitura viu peças suficientes para marcar as
// demais como sumidas. Abaixo disso o problema é a leitura, não o catálogo da
// fornecedora: marcar sumidas tiraria quase tudo de disponível de uma vez.
func SafeToMarkVanished(seen, known int) bool {
	return float64(seen) >= float64(known)*MinSeenForVanish
}

// SyncOutcome decide o status final de uma leitura e a mensagem para a dona.
func SyncOutcome(processed, failed int, timedOut bool) (SyncStatus, string) {
	if timedOut {
		return SyncPartial, "tempo esgotado antes de ler todas as páginas"
	}
	if processed > 0 && float64(failed)/float64(processed) > MaxSyncFailureRate {
		return SyncPartial, "mais de 10% das páginas falharam: o layout da Lilly pode ter mudado"
	}
	return SyncSuccess, ""
}

// Leitura incremental (Etapa 2 do plano): em vez de reler as 2 mil páginas da
// Lilly a cada rodada, lê só o que é novo ou mudou no sitemap e, com o que
// sobrar do teto, renova as páginas lidas há mais tempo. Menos acesso ao site
// dela é menos chance de bloqueio.

// MaxPagesPerSync é o teto de páginas lidas numa rodada.
const MaxPagesPerSync = 300

// SyncRefreshAfter: página sem mudança no sitemap volta a ser lida depois
// deste tempo, para pegar preço ou estoque que mudou sem mexer no lastmod.
const SyncRefreshAfter = 7 * 24 * time.Hour

// SyncEntry é uma URL do sitemap; SyncKnown, o que já se sabe dela.
type SyncEntry struct {
	URL     string
	Lastmod string
}

type SyncKnown struct {
	Lastmod   string
	CheckedAt time.Time
}

// PlanSync escolhe as URLs desta rodada, em ordem: primeiro as nunca lidas e
// as que mudaram (lastmod diferente do guardado), na ordem do sitemap; depois
// as lidas há mais de SyncRefreshAfter, da mais antiga para a mais nova. Sem
// lastmod guardado (página lida antes desta regra), só a idade conta.
func PlanSync(entries []SyncEntry, known map[string]SyncKnown, now time.Time, max int) []string {
	var mudaram []string
	type velha struct {
		url string
		em  time.Time
	}
	var velhas []velha
	for _, e := range entries {
		k, ok := known[e.URL]
		switch {
		case !ok:
			mudaram = append(mudaram, e.URL)
		case e.Lastmod != "" && k.Lastmod != "" && e.Lastmod != k.Lastmod:
			mudaram = append(mudaram, e.URL)
		case now.Sub(k.CheckedAt) > SyncRefreshAfter:
			velhas = append(velhas, velha{e.URL, k.CheckedAt})
		}
	}
	sort.SliceStable(velhas, func(i, j int) bool { return velhas[i].em.Before(velhas[j].em) })

	out := make([]string, 0, max)
	for _, u := range mudaram {
		if len(out) == max {
			return out
		}
		out = append(out, u)
	}
	for _, v := range velhas {
		if len(out) == max {
			break
		}
		out = append(out, v.url)
	}
	return out
}
