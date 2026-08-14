// Comando servidor: a API da Mirava.
//
// Todo segredo entra por variável de ambiente. Nenhum deles pode acabar no
// bundle do front-end — a regra prática é: se começa com VITE_, é público.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/mirava/api/internal/auth"
	"github.com/mirava/api/internal/db"
	"github.com/mirava/api/internal/dominio"
	"github.com/mirava/api/internal/mercadopago"
	"github.com/mirava/api/internal/web"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)

	// Em desenvolvimento, lê o .env da pasta atual. Em produção o Cloud Run
	// injeta as variáveis e o arquivo simplesmente não existe.
	carregarEnv(".env", log)

	// Sem estas, nada funciona — nem catálogo, nem login, nem tarefa agendada.
	essenciais := []string{"DATABASE_URL", "SUPABASE_URL", "SITE_URL", "CRON_SECRET"}
	faltando := []string{}
	for _, v := range essenciais {
		if os.Getenv(v) == "" {
			faltando = append(faltando, v)
		}
	}
	if len(faltando) > 0 {
		log.Error("variáveis de ambiente obrigatórias ausentes", "faltando", faltando)
		os.Exit(1)
	}

	// O Mercado Pago é exigido só por quem precisa dele: as rotas de checkout
	// e webhook recusam a requisição se não estiver configurado.
	//
	// Antes isso derrubava o boot inteiro, o que impedia rodar a sincronização
	// do catálogo antes de ter conta no Mercado Pago. Continua sendo falha
	// explícita — só que no lugar certo, em vez de bloquear o serviço todo.
	pagamentoPronto := os.Getenv("MP_ACCESS_TOKEN") != "" && os.Getenv("MP_WEBHOOK_SECRET") != ""
	if !pagamentoPronto {
		log.Warn("Mercado Pago não configurado — checkout e webhook vão recusar. " +
			"Catálogo, sincronização e lote funcionam normalmente.")
	}

	ctx, parar := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer parar()

	banco, err := db.Conectar(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Error("não consegui conectar no banco", "erro", err)
		os.Exit(1)
	}
	defer banco.Fechar()

	mp := mercadopago.Novo(os.Getenv("MP_ACCESS_TOKEN"), os.Getenv("MP_WEBHOOK_SECRET"))
	validador := auth.Novo(os.Getenv("SUPABASE_URL"))

	cfg := web.Config{
		SiteURL:           os.Getenv("SITE_URL"),
		WebhookURL:        os.Getenv("WEBHOOK_URL"),
		ModoTeste:         os.Getenv("MP_MODO") == "teste",
		ParcelasSemJuros:  inteiroOu("PARCELAS_SEM_JUROS", 3),
		EmbalagemCentavos: dominio.Centavos(inteiroOu("EMBALAGEM_CENTAVOS", 500)),
		CronSecret:        os.Getenv("CRON_SECRET"),
		PagamentoPronto:   pagamentoPronto,
	}

	servidor := &http.Server{
		Addr:              ":" + porta(),
		Handler:           web.Novo(banco, mp, validador, cfg, log).Rotas(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Info("servidor ouvindo", "porta", porta(), "modo_teste", cfg.ModoTeste)
		if err := servidor.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("servidor caiu", "erro", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	log.Info("desligando")

	// Encerramento gradual: uma requisição de checkout em andamento precisa
	// terminar, senão a cliente paga e o pedido fica sem registro.
	desligar, cancelar := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancelar()
	if err := servidor.Shutdown(desligar); err != nil {
		log.Error("desligamento forçado", "erro", err)
	}
}

// carregarEnv lê um arquivo .env simples (CHAVE=valor, uma por linha).
//
// Feito à mão em vez de puxar uma biblioteca: são 25 linhas e evita mais uma
// dependência num serviço que mexe com dinheiro. Variável já definida no
// ambiente tem prioridade — assim o Cloud Run sempre ganha do arquivo.
func carregarEnv(caminho string, log *slog.Logger) {
	dados, err := os.ReadFile(caminho)
	if err != nil {
		return // sem .env é o normal em produção
	}

	for _, linha := range strings.Split(string(dados), "\n") {
		linha = strings.TrimSpace(linha)
		if linha == "" || strings.HasPrefix(linha, "#") {
			continue
		}
		chave, valor, ok := strings.Cut(linha, "=")
		if !ok {
			continue
		}
		chave = strings.TrimSpace(chave)
		valor = strings.Trim(strings.TrimSpace(valor), `"'`)

		if _, definida := os.LookupEnv(chave); !definida {
			_ = os.Setenv(chave, valor)
		}
	}
	log.Info("variáveis carregadas do .env", "arquivo", caminho)
}

// Cloud Run injeta PORT.
func porta() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "8080"
}

func inteiroOu(chave string, padrao int) int {
	if v := os.Getenv(chave); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return padrao
}
