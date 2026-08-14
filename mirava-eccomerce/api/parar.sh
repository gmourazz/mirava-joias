#!/usr/bin/env bash
#
# Para a API da Mirava, tenha ela sido iniciada por script ou à mão.
#
#   ./parar.sh

PIDFILE="/tmp/mirava-api.pid"
parou=0

if [ -f "$PIDFILE" ]; then
  pid=$(cat "$PIDFILE")
  if kill "$pid" 2>/dev/null; then
    echo "parei o processo $pid"
    parou=1
  fi
  rm -f "$PIDFILE"
fi

# Pega também o que ficou ouvindo na 8080 por outro caminho.
for pid in $(lsof -ti:8080 -sTCP:LISTEN 2>/dev/null); do
  kill "$pid" 2>/dev/null && echo "parei o processo $pid (porta 8080)" && parou=1
done

sleep 1
if curl -sf --max-time 2 http://localhost:8080/saude >/dev/null 2>&1; then
  echo "ainda tem algo respondendo na 8080 — tente: kill -9 \$(lsof -ti:8080)"
else
  [ "$parou" -eq 1 ] && echo "porta 8080 livre" || echo "nada estava rodando"
fi
