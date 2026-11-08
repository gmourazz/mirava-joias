package dominio

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
