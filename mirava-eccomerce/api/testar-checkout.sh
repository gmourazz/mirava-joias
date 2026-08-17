#!/usr/bin/env bash
# Testa o checkout de ponta a ponta.
#
#   1. Garanta que existe um produto de teste publicado no banco novo e um
#      endereço salvo na sua conta (ver db/README.md — a conta antiga do
#      Supabase não existe mais neste banco).
#   2. Preencha SENHA, PRODUCT_ID e ADDRESS_ID abaixo.
#   3. Rode: bash testar-checkout.sh

set -euo pipefail

EMAIL="gmouraz@icloud.com"
SENHA="TROQUE_AQUI"
PRODUCT_ID="TROQUE_AQUI"
ADDRESS_ID="TROQUE_AQUI"

echo "Fazendo login..."
TOKEN=$(curl -s -X POST "http://localhost:8080/auth/entrar" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$SENHA\"}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))")

if [ -z "$TOKEN" ]; then
  echo "Login falhou — confira a senha."
  exit 1
fi
echo "Login OK."

echo "Criando pagamento de teste..."
curl -s -X POST http://localhost:8080/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"product_id\":\"$PRODUCT_ID\",\"quantity\":1}],\"address_id\":\"$ADDRESS_ID\"}" \
  | python3 -m json.tool
