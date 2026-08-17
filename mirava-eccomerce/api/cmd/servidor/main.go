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
	"github.com/mirava/api/internal/notificacao"
	"github.com/mirava/api/internal/storage"
	"github.com/mirava/api/internal/web"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)

	// Em desenvolvimento, lê o .env da pasta atual. Em produção o Cloud Run
	// injeta as variáveis e o arquivo simplesmente não existe.
	loadEnv(".env", log)

	// Sem estas, nada funciona — nem catálogo, nem login, nem tarefa agendada.
	// AUTH_SECRET assina a sessão da cliente: sem ele, ninguém consegue logar.
	required := []string{"DATABASE_URL", "AUTH_SECRET", "SITE_URL", "CRON_SECRET"}
	missing := []string{}
	for _, v := range required {
		if os.Getenv(v) == "" {
			missing = append(missing, v)
		}
	}
	if len(missing) > 0 {
		log.Error("variáveis de ambiente obrigatórias ausentes", "faltando", missing)
		os.Exit(1)
	}

	// O Mercado Pago é exigido só por quem precisa dele: as rotas de checkout
	// e webhook recusam a requisição se não estiver configurado.
	//
	// Antes isso derrubava o boot inteiro, o que impedia rodar a sincronização
	// do catálogo antes de ter conta no Mercado Pago. Continua sendo falha
	// explícita — só que no lugar certo, em vez de bloquear o serviço todo.
	paymentReady := os.Getenv("MP_ACCESS_TOKEN") != "" && os.Getenv("MP_WEBHOOK_SECRET") != ""
	if !paymentReady {
		log.Warn("Mercado Pago não configurado — checkout e webhook vão recusar. " +
			"Catálogo, sincronização e lote funcionam normalmente.")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	database, err := db.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Error("não consegui conectar no banco", "erro", err)
		os.Exit(1)
	}
	defer database.Close()

	mp := mercadopago.New(os.Getenv("MP_ACCESS_TOKEN"), os.Getenv("MP_WEBHOOK_SECRET"))
	validator := auth.New(os.Getenv("AUTH_SECRET"))

	// Fotos de produto: disco do próprio servidor (decisão 15/16 —
	// substitui o Supabase Storage). Em produção, aponte UPLOADS_DIR para um
	// disco persistente (a VPS da Hostinger não perde volume no deploy, mas
	// o Cloud Run sim — se for pra lá, isso precisa virar bucket).
	uploadsDir := os.Getenv("UPLOADS_DIR")
	if uploadsDir == "" {
		uploadsDir = "./uploads"
	}
	store, err := storage.New(uploadsDir)
	if err != nil {
		log.Error("não consegui preparar o diretório de uploads", "erro", err)
		os.Exit(1)
	}

	// Avisos por e-mail. Sem RESEND_API_KEY o canal nasce nulo e o sistema
	// funciona igual, só não notifica — é o que se quer em desenvolvimento,
	// onde ninguém quer disparar e-mail de verdade a cada teste de checkout.
	canalEmail := notificacao.NovoEmail(
		os.Getenv("RESEND_API_KEY"),
		os.Getenv("EMAIL_REMETENTE"),
	)
	if canalEmail == nil {
		log.Warn("e-mail não configurado — pedidos serão criados sem aviso à cliente. " +
			"Preencha RESEND_API_KEY e EMAIL_REMETENTE.")
	}
	notificador := notificacao.Novo(log, canalEmail)

	cfg := web.Config{
		SiteURL:                os.Getenv("SITE_URL"),
		WebhookURL:             os.Getenv("WEBHOOK_URL"),
		TestMode:               os.Getenv("MP_MODO") == "teste",
		InstallmentsNoInterest: intOr("PARCELAS_SEM_JUROS", 3),
		PackagingCents:         dominio.Cents(intOr("EMBALAGEM_CENTAVOS", 500)),
		CronSecret:             os.Getenv("CRON_SECRET"),
		WhatsApp:               os.Getenv("WHATSAPP_LOJA"),
		PaymentReady:           paymentReady,
	}

	server := &http.Server{
		Addr:              ":" + port(),
		Handler:           web.Novo(database, mp, validator, store, notificador, cfg, log).Rotas(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Info("servidor ouvindo", "porta", port(), "modo_teste", cfg.TestMode)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("servidor caiu", "erro", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	log.Info("desligando")

	// Encerramento gradual: uma requisição de checkout em andamento precisa
	// terminar, senão a cliente paga e o pedido fica sem registro.
	shutdown, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdown); err != nil {
		log.Error("desligamento forçado", "erro", err)
	}
}

// loadEnv lê um arquivo .env simples (CHAVE=valor, uma por linha).
//
// Feito à mão em vez de puxar uma biblioteca: são 25 linhas e evita mais uma
// dependência num serviço que mexe com dinheiro. Variável já definida no
// ambiente tem prioridade — assim o Cloud Run sempre ganha do arquivo.
func loadEnv(path string, log *slog.Logger) {
	data, err := os.ReadFile(path)
	if err != nil {
		return // sem .env é o normal em produção
	}

	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)

		if _, defined := os.LookupEnv(key); !defined {
			_ = os.Setenv(key, value)
		}
	}
	log.Info("variáveis carregadas do .env", "arquivo", path)
}

// Cloud Run injeta PORT.
func port() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "8080"
}

func intOr(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
