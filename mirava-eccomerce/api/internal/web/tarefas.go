package web

import (
	"context"
	"net/http"
	"time"

	"github.com/mirava/api/internal/db"
	"github.com/mirava/api/internal/dominio"
	"github.com/mirava/api/internal/lilly"
)

// Tarefas agendadas: sincronização do catálogo e avaliação do lote.

// imageHTTPClient baixa as fotos dos produtos durante a sincronização.
// Prazo próprio, mais folgado que o de leitura de HTML — foto pesa mais.
var imageHTTPClient = &http.Client{Timeout: 15 * time.Second}

// toDBReviews converte o tipo do extrator (lilly.Review) pro tipo de
// armazenamento (db.Review) — são iguais em conteúdo, mas cada pacote tem o
// seu por não depender um do outro.
func toDBReviews(rs []lilly.Review) []db.Review {
	out := make([]db.Review, len(rs))
	for i, r := range rs {
		out[i] = db.Review{Author: r.Author, Date: r.Date, Text: r.Text}
	}
	return out
}

// sincronizar lê o catálogo da Lilly e atualiza o espelho.
//
// Duas coisas que este handler NUNCA faz:
//   1. escrever direto em `products` — só no espelho, e o preço passa pelo
//      disjuntor da função SQL apply_synced_cost
//   2. gravar dado que não passou em Validate() — extrator quebrado que grave
//      custo zero no catálogo inteiro é muito pior que sync que falha alto
func (s *Servidor) syncCatalog(w http.ResponseWriter, r *http.Request) {
	// Cloud Run corta a requisição em 60s por padrão; a varredura leva mais.
	// context.WithoutCancel desliga o cancelamento pelo fim da requisição.
	//
	// 6h de teto: o catálogo inteiro (~2200 URLs) com download de foto
	// incluído passa de 2h tranquilamente. 50min (valor antigo, de quando a
	// sincronização só lia HTML) matava a sincronização no meio do caminho,
	// em silêncio — foi isso que pareceu "travado" numa madrugada.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 6*time.Hour)

	supplierID, sitemapURL, ratio, err := s.db.ActiveSupplier(ctx)
	if err != nil {
		cancel()
		responder(w, http.StatusInternalServerError, mapa{"error": "nenhuma fornecedora ativa"})
		return
	}
	if sitemapURL == "" {
		sitemapURL = lilly.SitemapURL
	}
	if ratio <= 0 {
		ratio = lilly.DefaultWholesaleRatio
	}

	// Responde já: o Cloud Scheduler não deve esperar a varredura terminar.
	responder(w, http.StatusAccepted, mapa{"ok": true, "nota": "sincronização iniciada"})

	go func() {
		defer cancel()
		s.runSync(ctx, supplierID, sitemapURL, ratio)
	}()
}

func (s *Servidor) runSync(ctx context.Context, supplierID, sitemapURL string, ratio float64) {
	entries, err := s.li.ReadSitemap(ctx)
	if err != nil {
		s.log.Error("sitemap ilegível", "erro", err)
		return
	}

	syncID, err := s.db.StartSync(ctx, supplierID, len(entries))
	if err != nil {
		s.log.Error("não consegui registrar a sincronização", "erro", err)
		return
	}
	s.log.Info("sincronização iniciada", "urls", len(entries))

	var res db.SyncResult
	seen := make([]string, 0, len(entries))
	consecutiveFailures := 0

	for _, e := range entries {
		select {
		case <-ctx.Done():
			// ctx já morreu — não dá pra usar ele de novo pra gravar o
			// resultado (a query seria cancelada na hora, e o registro de
			// sincronização ficaria com status errado pra sempre). Por isso
			// um contexto novo, curto, só pra esse último UPDATE.
			res.Status = "parcial"
			res.Error = "tempo esgotado"
			s.log.Warn("sincronização interrompida — bateu o prazo total",
				"processados", res.Processed, "de", len(entries))
			finishCtx, cancelFinish := context.WithTimeout(context.Background(), 10*time.Second)
			_ = s.db.FinishSync(finishCtx, syncID, res)
			cancelFinish()
			return
		default:
		}

		// Pausa entre páginas: o robots.txt dela libera, mas varrer centenas
		// de URLs sem intervalo parece ataque e derruba a boa relação.
		time.Sleep(lilly.PageDelay)
		res.Processed++

		// Prazo próprio por item, mais curto que o da sincronização inteira.
		// Motivo: se o Mac suspender no meio (sono, tampa fechada), uma
		// conexão TCP com o banco pode ficar "zumbi" — parece aberta mas
		// nunca mais responde, e nem o timeout do http.Client nem o contexto
		// geral (50min) percebem isso de forma confiável, porque os
		// temporizadores também pausam durante a suspensão do sistema. Foi
		// isso que travou a sincronização por 8h numa madrugada. Um prazo
		// curto reaplicado a CADA item, criado depois da pausa, garante que
		// o pior caso é "este item falha", nunca "trava para sempre".
		//
		// 40s em vez de 20s: agora o item também baixa as fotos (até
		// poucos MB cada), não só a página HTML.
		itemCtx, cancelItem := context.WithTimeout(ctx, 40*time.Second)

		html, err := s.li.FetchPage(itemCtx, e.URL)
		if err != nil {
			res.Failed++
			consecutiveFailures++
			s.db.RecordSyncFailure(itemCtx, syncID, e.URL, "busca: "+err.Error())
			cancelItem()

			// 5 falhas seguidas = provável bloqueio temporário do WAF da
			// Lilly. Recuar 20s em vez de insistir no mesmo ritmo evita
			// prolongar o bloqueio e dá tempo dele passar sozinho.
			if consecutiveFailures >= 5 {
				s.log.Warn("falhas seguidas — recuando 20s", "seguidas", consecutiveFailures, "url", e.URL)
				time.Sleep(20 * time.Second)
			}
			continue
		}
		consecutiveFailures = 0

		p := lilly.Extract(html, e.URL, ratio)
		if p == nil {
			cancelItem()
			continue // página de categoria ou institucional, não é falha
		}
		if err := p.Validate(); err != nil {
			res.Failed++
			s.db.RecordSyncFailure(itemCtx, syncID, e.URL, "validação: "+err.Error())
			cancelItem()
			continue // mantém o dado anterior
		}

		created, mirrorID, err := s.db.UpsertMirror(itemCtx, db.MirrorProduct{
			SupplierID: supplierID, SKU: p.SKU, URL: p.URL, Name: p.Name,
			Description: p.Description, Warranty: p.Warranty,
			Cost: p.Wholesale, Retail: p.Retail, CostConfirmed: p.WholesaleConfirmed,
			Available: p.Available, Images: p.Images,
			Rating: p.Rating, RatingCount: p.RatingCount, Reviews: toDBReviews(p.Reviews),
		})
		if err != nil {
			res.Failed++
			s.db.RecordSyncFailure(itemCtx, syncID, e.URL, "gravação: "+err.Error())
			cancelItem()
			continue
		}

		if created {
			res.Created++
		} else {
			res.Updated++
		}

		// Preço automático, com disjuntor no banco.
		result, err := s.db.ApplyCost(itemCtx, mirrorID, p.Wholesale)
		if err != nil {
			s.log.Error("falha ao aplicar custo", "sku", p.SKU, "erro", err)
		} else if result == "travado pelo disjuntor" {
			res.LockedPrices++
			s.log.Warn("preço travado para revisão", "sku", p.SKU, "novo_custo", p.Wholesale.String())
		}

		// Publica (ou atualiza) a peça na vitrine — mesma foto, descrição e
		// tamanho da Lilly, decisão da dona é não revisar antes de ir ao ar.
		// O preço, de novo, NÃO é decidido aqui — só o cost_cents inicial,
		// que o próprio ApplyCost/disjuntor acabou de validar acima.
		localImages := make([]string, 0, len(p.Images))
		for i, srcURL := range p.Images {
			path, err := s.storage.SaveFromURL(itemCtx, imageHTTPClient, srcURL, p.SKU, i+1)
			if err != nil {
				s.log.Warn("falha ao baixar foto", "sku", p.SKU, "url", srcURL, "erro", err)
				continue
			}
			localImages = append(localImages, path)
		}
		if len(localImages) > 0 {
			_, _, err := s.db.EnsureProduct(itemCtx, mirrorID, db.EnsureProductInput{
				SKU: p.SKU, Name: p.Name, Description: p.Description,
				Cost:        p.Wholesale,
				Category:    lilly.GuessCategory(p.Name),
				Metal:       lilly.GuessMetal(p.Name),
				Images:      localImages,
				Rating:       p.Rating,
				RatingCount:  p.RatingCount,
				Reviews:      toDBReviews(p.Reviews),
				VariantLabel: p.VariantLabel,
				Variants:     p.Variants,
			})
			if err != nil {
				s.log.Error("falha ao publicar produto", "sku", p.SKU, "erro", err)
			}
		} else {
			s.log.Warn("produto sem foto baixada — não publicado", "sku", p.SKU)
		}
		cancelItem()

		seen = append(seen, p.SKU)

		if res.Processed%50 == 0 {
			s.log.Info("sincronização em andamento",
				"processados", res.Processed, "de", len(entries),
				"novos", res.Created, "atualizados", res.Updated, "falhas", res.Failed)
		}
	}

	if vanished, err := s.db.MarkVanished(ctx, supplierID, seen); err == nil {
		res.Vanished = int(vanished)
	}

	// Mais vendidos, no fim e sem poder derrubar nada: é enfeite de vitrine,
	// não catálogo. Se a página da fornecedora estiver fora do ar, o site
	// continua mostrando a lista da rodada anterior — que já está no banco.
	s.atualizarMaisVendidos(ctx)

	// Taxa de sucesso baixa = o layout da Lilly mudou. Você quer saber por
	// aqui, não pela cliente reclamando que o site está com preço errado.
	res.Status = "sucesso"
	if res.Processed > 0 && float64(res.Failed)/float64(res.Processed) > 0.10 {
		res.Status = "parcial"
		res.Error = "mais de 10% das páginas falharam — o layout da Lilly pode ter mudado"
		s.log.Error("sincronização degradada", "falhas", res.Failed, "total", res.Processed)
	}

	_ = s.db.FinishSync(ctx, syncID, res)
	s.log.Info("sincronização concluída",
		"novos", res.Created, "atualizados", res.Updated,
		"falhas", res.Failed, "travados", res.LockedPrices, "sumidos", res.Vanished)
}

// refreshBestSellers recalcula só a vitrine de mais vendidos, sem varrer o
// catálogo inteiro de novo — útil pra corrigir a lista (ex.: filtro de
// categoria mudou) sem esperar a sincronização completa, que leva horas.
func (s *Servidor) refreshBestSellers(w http.ResponseWriter, r *http.Request) {
	s.atualizarMaisVendidos(r.Context())
	responder(w, http.StatusOK, mapa{"ok": true})
}

// atualizarMaisVendidos guarda os dois sinais da vitrine de mais vendidos.
//
// A posição da fornecedora é empréstimo: vale enquanto a Mirava não tem venda
// própria suficiente. `units_sold` é o dado nosso, e é ele que manda na
// ordenação — quanto mais a loja vende, menos a vitrine depende da Lilly.
// Por isso o recálculo da venda própria roda mesmo quando a leitura da
// fornecedora falha.
func (s *Servidor) atualizarMaisVendidos(ctx context.Context) {
	if slugs, err := s.li.BestSellers(ctx); err != nil {
		s.log.Warn("não consegui ler os mais vendidos da fornecedora", "erro", err)
	} else if n, err := s.db.SetSupplierRanks(ctx, slugs); err != nil {
		s.log.Error("falha ao gravar posição de mais vendidos", "erro", err)
	} else {
		s.log.Info("mais vendidos da fornecedora atualizados",
			"lidos", len(slugs), "casados_no_catalogo", n)
	}

	if n, err := s.db.RefreshUnitsSold(ctx); err != nil {
		s.log.Error("falha ao recalcular venda própria", "erro", err)
	} else if n > 0 {
		s.log.Info("venda própria recalculada", "produtos_alterados", n)
	}
}

// avaliarLote decide se o lote aberto deve fechar hoje.
func (s *Servidor) evaluateBatch(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	batch, err := s.db.GetOpenBatch(ctx)
	if err != nil {
		responder(w, http.StatusInternalServerError, mapa{"error": err.Error()})
		return
	}
	if batch == nil {
		responder(w, http.StatusOK, mapa{"ok": true, "nota": "nenhum lote aberto"})
		return
	}

	ev := dominio.EvaluateBatch(batch.Cost, batch.OldestPaidAt, time.Now())

	resposta := mapa{
		"lote_id":          batch.ID,
		"custo_acumulado":  batch.Cost.String(),
		"falta_para_meta":  ev.MissingForGoal.String(),
		"dias_mais_antigo": ev.OldestDays,
		"motivo":           string(ev.Reason),
		"fechou":           false,
	}

	if ev.ShouldClose {
		if err := s.db.CloseBatch(ctx, batch.ID, ev.EstimatedShipping, string(ev.Reason)); err != nil {
			responder(w, http.StatusInternalServerError, mapa{"error": err.Error()})
			return
		}
		resposta["fechou"] = true
		resposta["frete_estimado"] = ev.EstimatedShipping.String()
		s.log.Info("lote fechado", "lote", batch.ID, "motivo", ev.Reason,
			"custo", batch.Cost.String(), "dias", ev.OldestDays)
	}

	responder(w, http.StatusOK, resposta)
}
