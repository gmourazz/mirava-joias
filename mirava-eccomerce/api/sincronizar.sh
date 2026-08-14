#!/usr/bin/env bash
#
# Sincroniza o catálogo da Lilly — num comando só, num terminal só.
#
#   cd ~/Documents/mirava/mirava-eccomerce/api
#   ./sincronizar.sh
#
# Ele cuida de tudo: sobe a API se não estiver de pé, espera ficar pronta,
# dispara a sincronização e mostra o progresso ao vivo.
#
# Ctrl+C aqui para de ACOMPANHAR o log. A sincronização continua rodando no
# servidor — para parar de verdade, use ./parar.sh

set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

VERDE=$'\033[0;32m'; VERMELHO=$'\033[0;31m'; AMARELO=$'\033[0;33m'; NEGRITO=$'\033[1m'; FIM=$'\033[0m'
LOG="/tmp/mirava-api.log"
PIDFILE="/tmp/mirava-api.pid"

if [ ! -f .env ]; then
  echo "${VERMELHO}Não achei o arquivo .env nesta pasta.${FIM}"
  exit 1
fi

# Impede o Mac de dormir enquanto este script roda. Sem isso, se a tela
# apagar ou o notebook fechar, o processo em segundo plano pausa no meio —
# foi exatamente o que aconteceu na sincronização anterior, que ficou 12h
# parada no meio do caminho. Some sozinho quando o script termina (trap).
if command -v caffeinate >/dev/null 2>&1; then
  caffeinate -i -w $$ &
  echo "${VERDE}✓${FIM} Mac não vai dormir enquanto este terminal estiver aberto rodando"
fi

CRON=$(grep '^CRON_SECRET=' .env | cut -d= -f2- | tr -d '"'"'"' ')
if [ -z "$CRON" ]; then
  echo "${VERMELHO}CRON_SECRET está vazio no .env.${FIM}"
  echo "Gere um com:  echo \"CRON_SECRET=\$(openssl rand -hex 32)\" >> .env"
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. Servidor de pé?
# ---------------------------------------------------------------------------
if curl -sf --max-time 3 http://localhost:8080/saude >/dev/null 2>&1; then
  echo "${VERDE}✓${FIM} API já está rodando"
else
  echo "${AMARELO}!${FIM} API não estava rodando — subindo em segundo plano…"
  : > "$LOG"
  # trap '' INT antes do exec: o Ctrl+C que você aperta pra parar de
  # ACOMPANHAR o log é entregue a todo o grupo de processos do terminal —
  # sem isso, ele mata o servidor junto, mesmo estando "em segundo plano".
  # Foi isso que derrubou a sincronização nas tentativas anteriores.
  ( trap '' INT; exec go run ./cmd/servidor >> "$LOG" 2>&1 ) &
  echo $! > "$PIDFILE"
  disown

  # Espera até 60s: a primeira vez compila o Go, e demora.
  pronto=0
  for _ in $(seq 1 60); do
    if curl -sf --max-time 2 http://localhost:8080/saude >/dev/null 2>&1; then
      pronto=1; break
    fi
    sleep 1
  done

  if [ "$pronto" -ne 1 ]; then
    echo "${VERMELHO}✗ a API não subiu. Últimas linhas do log:${FIM}"
    tail -20 "$LOG" | sed 's/^/    /'
    exit 1
  fi
  echo "${VERDE}✓${FIM} API no ar"
fi

# ---------------------------------------------------------------------------
# 2. Dispara
# ---------------------------------------------------------------------------
echo
resposta=$(curl -s -w '\n%{http_code}' -X POST \
  http://localhost:8080/tarefas/sincronizar \
  -H "Authorization: Bearer $CRON")

codigo=$(echo "$resposta" | tail -1)
corpo=$(echo "$resposta" | sed '$d')

case "$codigo" in
  202|200)
    echo "${VERDE}✓ sincronização iniciada${FIM}"
    ;;
  401)
    echo "${VERMELHO}✗ o servidor recusou o segredo (401).${FIM}"
    echo "  O CRON_SECRET do .env mudou depois que a API subiu? Rode ./parar.sh e tente de novo."
    exit 1
    ;;
  *)
    echo "${VERMELHO}✗ resposta inesperada ($codigo):${FIM} $corpo"
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# 3. Acompanha
# ---------------------------------------------------------------------------
cat <<TXT

${NEGRITO}Acompanhando o progresso.${FIM}
São centenas de peças, com 1,5s de pausa entre cada uma para não sobrecarregar
o site da Lilly — deve levar de 20 a 40 minutos.

Ctrl+C aqui só para de ACOMPANHAR; a sincronização continua no servidor.

TXT

if [ -f "$LOG" ]; then
  tail -f "$LOG"
else
  echo "A API foi iniciada por fora deste script, então o log está no terminal dela."
  echo "Acompanhe por lá, ou rode ./parar.sh e depois ./sincronizar.sh de novo."
fi
