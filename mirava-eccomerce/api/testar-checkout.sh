#!/usr/bin/env bash
# Testa o checkout de ponta a ponta com o produto de teste de R$1.
#
#   1. Edite a linha SENHA abaixo com a senha da sua conta gmouraz@icloud.com
#   2. Rode: bash testar-checkout.sh

set -euo pipefail

SENHA="TROQUE_AQUI"

SUPABASE_URL="https://sxqkweorwrjihsmhijun.supabase.co"
ANON_KEY="sb_publishable_6pUpHACe_YCBylmphrgH-w_vIP4ItHQ"
PRODUTO_ID="f86452d3-7a29-4230-8d23-f1bb8e20110e"
ENDERECO_ID="04bd080a-15ef-4ab2-a201-ad3b122a6138"

echo "Fazendo login..."
TOKEN=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"gmouraz@icloud.com\",\"password\":\"$SENHA\"}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token',''))")

if [ -z "$TOKEN" ]; then
  echo "Login falhou — confira a senha."
  exit 1
fi
echo "Login OK."

echo "Criando pagamento de teste..."
curl -s -X POST http://localhost:8080/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"itens\":[{\"produto_id\":\"$PRODUTO_ID\",\"quantidade\":1}],\"endereco_id\":\"$ENDERECO_ID\"}" \
  | python3 -m json.tool
