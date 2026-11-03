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

// SyncOutcome decide o status final de uma leitura e a mensagem para a dona.
func SyncOutcome(processed, failed int, timedOut bool) (SyncStatus, string) {
	if timedOut {
		return SyncPartial, "tempo esgotado antes de ler todas as páginas"
	}
	if processed > 0 && float64(failed)/float64(processed) > MaxSyncFailureRate {
		return SyncPartial, "mais de 10% das páginas falharam — o layout da Lilly pode ter mudado"
	}
	return SyncSuccess, ""
}
