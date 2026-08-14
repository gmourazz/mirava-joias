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

// sincronizar lê o catálogo da Lilly e atualiza o espelho.
//
// Duas coisas que este handler NUNCA faz:
//   1. escrever direto em `produtos` — só no espelho, e o preço passa pelo
//      disjuntor da função SQL aplicar_custo_sincronizado
//   2. gravar dado que não passou em Validar() — extrator quebrado que grave
//      custo zero no catálogo inteiro é muito pior que sync que falha alto
func (s *Servidor) sincronizar(w http.ResponseWriter, r *http.Request) {
	// Cloud Run corta a requisição em 60s por padrão; a varredura leva mais.
	// context.WithoutCancel desliga o cancelamento pelo fim da requisição.
	ctx, cancelar := context.WithTimeout(context.WithoutCancel(r.Context()), 50*time.Minute)

	fornecedorID, sitemapURL, razao, err := s.db.FornecedorAtivo(ctx)
	if err != nil {
		cancelar()
		responder(w, http.StatusInternalServerError, mapa{"erro": "nenhuma fornecedora ativa"})
		return
	}
	if sitemapURL == "" {
		sitemapURL = lilly.SitemapURL
	}
	if razao <= 0 {
		razao = lilly.RazaoAtacadoPadrao
	}

	// Responde já: o Cloud Scheduler não deve esperar a varredura terminar.
	responder(w, http.StatusAccepted, mapa{"ok": true, "nota": "sincronização iniciada"})

	go func() {
		defer cancelar()
		s.rodarSync(ctx, fornecedorID, sitemapURL, razao)
	}()
}

func (s *Servidor) rodarSync(ctx context.Context, fornecedorID, sitemapURL string, razao float64) {
	entradas, err := s.li.LerSitemap(ctx)
	if err != nil {
		s.log.Error("sitemap ilegível", "erro", err)
		return
	}

	syncID, err := s.db.IniciarSync(ctx, fornecedorID, len(entradas))
	if err != nil {
		s.log.Error("não consegui registrar a sincronização", "erro", err)
		return
	}
	s.log.Info("sincronização iniciada", "urls", len(entradas))

	var res db.ResultadoSync
	vistos := make([]string, 0, len(entradas))
	falhasSeguidas := 0

	for _, e := range entradas {
		select {
		case <-ctx.Done():
			res.Status = "parcial"
			res.Erro = "tempo esgotado"
			_ = s.db.FinalizarSync(ctx, syncID, res)
			return
		default:
		}

		// Pausa entre páginas: o robots.txt dela libera, mas varrer centenas
		// de URLs sem intervalo parece ataque e derruba a boa relação.
		time.Sleep(lilly.PausaEntrePag)
		res.Processados++

		// Prazo próprio por item, mais curto que o da sincronização inteira.
		// Motivo: se o Mac suspender no meio (sono, tampa fechada), uma
		// conexão TCP com o Supabase pode ficar "zumbi" — parece aberta mas
		// nunca mais responde, e nem o timeout do http.Client nem o contexto
		// geral (50min) percebem isso de forma confiável, porque os
		// temporizadores também pausam durante a suspensão do sistema. Foi
		// isso que travou a sincronização por 8h numa madrugada. Um prazo
		// curto reaplicado a CADA item, criado depois da pausa, garante que
		// o pior caso é "este item falha", nunca "trava para sempre".
		ctxItem, cancelarItem := context.WithTimeout(ctx, 20*time.Second)

		html, err := s.li.BuscarPagina(ctxItem, e.URL)
		if err != nil {
			res.Falhas++
			falhasSeguidas++
			s.db.RegistrarFalhaSync(ctxItem, syncID, e.URL, "busca: "+err.Error())
			cancelarItem()

			// 5 falhas seguidas = provável bloqueio temporário do WAF da
			// Lilly. Recuar 20s em vez de insistir no mesmo ritmo evita
			// prolongar o bloqueio e dá tempo dele passar sozinho.
			if falhasSeguidas >= 5 {
				s.log.Warn("falhas seguidas — recuando 20s", "seguidas", falhasSeguidas, "url", e.URL)
				time.Sleep(20 * time.Second)
			}
			continue
		}
		falhasSeguidas = 0

		p := lilly.Extrair(html, e.URL, razao)
		if p == nil {
			cancelarItem()
			continue // página de categoria ou institucional, não é falha
		}
		if err := p.Validar(); err != nil {
			res.Falhas++
			s.db.RegistrarFalhaSync(ctxItem, syncID, e.URL, "validação: "+err.Error())
			cancelarItem()
			continue // mantém o dado anterior
		}

		novo, espelhoID, err := s.db.UpsertEspelho(ctxItem, db.EspelhoProduto{
			FornecedorID: fornecedorID, SKU: p.SKU, URL: p.URL, Nome: p.Nome,
			Descricao: p.Descricao, Garantia: p.Garantia,
			Custo: p.Atacado, Varejo: p.Varejo, CustoConfirmado: p.AtacadoConfirmado,
			Disponivel: p.Disponivel, Imagens: p.Imagens,
			Avaliacao: p.Avaliacao, QtdAvaliacoes: p.QtdAvaliacoes,
		})
		if err != nil {
			res.Falhas++
			s.db.RegistrarFalhaSync(ctxItem, syncID, e.URL, "gravação: "+err.Error())
			cancelarItem()
			continue
		}

		if novo {
			res.Novos++
		} else {
			res.Atualizados++
		}

		// Preço automático, com disjuntor no banco.
		resultado, err := s.db.AplicarCusto(ctxItem, espelhoID, p.Atacado)
		cancelarItem()
		if err != nil {
			s.log.Error("falha ao aplicar custo", "sku", p.SKU, "erro", err)
		} else if resultado == "travado pelo disjuntor" {
			res.PrecosTravados++
			s.log.Warn("preço travado para revisão", "sku", p.SKU, "novo_custo", p.Atacado.String())
		}

		vistos = append(vistos, p.SKU)

		if res.Processados%50 == 0 {
			s.log.Info("sincronização em andamento",
				"processados", res.Processados, "de", len(entradas),
				"novos", res.Novos, "atualizados", res.Atualizados, "falhas", res.Falhas)
		}
	}

	if sumidos, err := s.db.MarcarSumidos(ctx, fornecedorID, vistos); err == nil {
		res.Sumidos = int(sumidos)
	}

	// Taxa de sucesso baixa = o layout da Lilly mudou. Você quer saber por
	// aqui, não pela cliente reclamando que o site está com preço errado.
	res.Status = "sucesso"
	if res.Processados > 0 && float64(res.Falhas)/float64(res.Processados) > 0.10 {
		res.Status = "parcial"
		res.Erro = "mais de 10% das páginas falharam — o layout da Lilly pode ter mudado"
		s.log.Error("sincronização degradada", "falhas", res.Falhas, "total", res.Processados)
	}

	_ = s.db.FinalizarSync(ctx, syncID, res)
	s.log.Info("sincronização concluída",
		"novos", res.Novos, "atualizados", res.Atualizados,
		"falhas", res.Falhas, "travados", res.PrecosTravados, "sumidos", res.Sumidos)
}

// avaliarLote decide se o lote aberto deve fechar hoje.
func (s *Servidor) avaliarLote(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	lote, err := s.db.LoteAberto(ctx)
	if err != nil {
		responder(w, http.StatusInternalServerError, mapa{"erro": err.Error()})
		return
	}
	if lote == nil {
		responder(w, http.StatusOK, mapa{"ok": true, "nota": "nenhum lote aberto"})
		return
	}

	av := dominio.AvaliarLote(lote.Custo, lote.PagoMaisAntigo, time.Now())

	resposta := mapa{
		"lote_id":           lote.ID,
		"custo_acumulado":   lote.Custo.String(),
		"falta_para_meta":   av.FaltaParaMeta.String(),
		"dias_mais_antigo":  av.DiasMaisAntigo,
		"motivo":            string(av.Motivo),
		"fechou":            false,
	}

	if av.Deve {
		if err := s.db.FecharLote(ctx, lote.ID, av.FreteEstimado, string(av.Motivo)); err != nil {
			responder(w, http.StatusInternalServerError, mapa{"erro": err.Error()})
			return
		}
		resposta["fechou"] = true
		resposta["frete_estimado"] = av.FreteEstimado.String()
		s.log.Info("lote fechado", "lote", lote.ID, "motivo", av.Motivo,
			"custo", lote.Custo.String(), "dias", av.DiasMaisAntigo)
	}

	responder(w, http.StatusOK, resposta)
}
