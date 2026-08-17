#!/usr/bin/env bash
#
# Um comando pra subir a Mirava inteira em desenvolvimento: banco, API e
# front. Uso:
#
#   ./rodar.sh
#
# Ctrl+C nesta janela derruba os três de uma vez — não precisa fechar
# terminal por terminal.
#
# O que ele faz, em ordem:
#   1. Sobe o Postgres (Docker), se ainda não estiver de pé.
#   2. Espera o banco aceitar conexão antes de seguir.
#   3. Sobe a API Go em segundo plano.
#   4. Sobe o front (Vite) em segundo plano.
#   5. Mistura os logs dos dois na mesma tela, prefixados por [api] / [front].

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

RAIZ="$(pwd)"
API="$RAIZ/api"
FRONT="$RAIZ/frontend"
DB="$RAIZ/db"

echo "==> Conferindo se as ferramentas necessárias estão instaladas..."
for cmd in docker go npm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Erro: '$cmd' não foi encontrado. Instale antes de rodar este script."
    exit 1
  fi
done

if [ ! -f "$API/.env" ]; then
  echo "Erro: $API/.env não existe. Copie $API/.env.exemplo para $API/.env e preencha antes de rodar."
  exit 1
fi

echo "==> Subindo o banco (Docker)..."
(cd "$DB" && docker compose up -d)

echo "==> Esperando o Postgres aceitar conexão..."
until docker exec mirava-postgres pg_isready -U mirava >/dev/null 2>&1; do
  sleep 1
done
echo "    banco pronto."

# Mata API e front juntos quando você aperta Ctrl+C ou fecha o terminal —
# sem isso, os processos filhos ficariam rodando escondidos em segundo plano.
PIDS=()
encerrar() {
  echo ""
  echo "==> Encerrando..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  exit 0
}
trap encerrar INT TERM

echo "==> Subindo a API Go (http://localhost:8080)..."
(cd "$API" && go run ./cmd/servidor 2>&1 | sed 's/^/[api]   /') &
PIDS+=($!)

echo "==> Subindo o front (http://localhost:5173)..."
(cd "$FRONT" && npm run dev 2>&1 | sed 's/^/[front] /') &
PIDS+=($!)

echo ""
echo "Tudo no ar. Site em http://localhost:5173 — Ctrl+C aqui pra parar tudo."
echo ""

wait
