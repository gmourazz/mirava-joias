#!/usr/bin/env bash
#
# Verificação completa do banco da Mirava.
#
# Roda o verificar.sql (constraints, triggers, máquina de estados, disjuntor)
# e o teste de vazamento por RLS, que é o mais importante de todos.
#
# Uso:
#   cd ~/Documents/mirava/mirava-eccomerce
#   ./supabase/verificar.sh
#
# Ele pergunta o que precisa. Para não digitar toda vez, crie um arquivo
# supabase/.env.verificar com:
#   DB_URL="postgresql://postgres.SEUREF:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
#   PROJECT_REF="seuref"
#   ANON_KEY="sua-chave-anon"

set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERDE=$'\033[0;32m'; VERMELHO=$'\033[0;31m'; AMARELO=$'\033[0;33m'; NEGRITO=$'\033[1m'; FIM=$'\033[0m'

falhas=0
ok()    { echo "  ${VERDE}✓${FIM} $1"; }
falha() { echo "  ${VERMELHO}✗${FIM} $1"; falhas=$((falhas+1)); }
aviso() { echo "  ${AMARELO}!${FIM} $1"; }
titulo(){ echo; echo "${NEGRITO}$1${FIM}"; }

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------
if [ -f "$AQUI/.env.verificar" ]; then
  # shellcheck disable=SC1090
  source "$AQUI/.env.verificar"
fi

if [ -z "${DB_URL:-}" ]; then
  echo "Cole a connection string do Session pooler"
  echo "(painel → Connect → Direct → Session pooler, com a senha no lugar de [YOUR-PASSWORD]):"
  read -r DB_URL
fi

if [ -z "${PROJECT_REF:-}" ]; then
  # tenta descobrir a partir da própria URL
  PROJECT_REF=$(echo "$DB_URL" | sed -n 's|.*postgres\.\([a-z0-9]*\):.*|\1|p')
  if [ -z "$PROJECT_REF" ]; then
    echo "Qual o Project Ref? (Settings → General → Reference ID):"
    read -r PROJECT_REF
  fi
fi

if [ -z "${ANON_KEY:-}" ]; then
  echo "Cole a chave anon (painel → Settings → API → anon public):"
  read -r ANON_KEY
fi

# ---------------------------------------------------------------------------
# psql
# ---------------------------------------------------------------------------
if ! command -v psql >/dev/null 2>&1; then
  for p in /opt/homebrew/opt/libpq/bin /usr/local/opt/libpq/bin; do
    [ -x "$p/psql" ] && export PATH="$p:$PATH" && break
  done
fi

if ! command -v psql >/dev/null 2>&1; then
  titulo "Instalando o psql (cliente do Postgres)"
  echo "  Não vem no macOS. Instalando via Homebrew — leva ~1 minuto."
  brew install libpq >/dev/null 2>&1
  export PATH="/opt/homebrew/opt/libpq/bin:/usr/local/opt/libpq/bin:$PATH"
  if ! command -v psql >/dev/null 2>&1; then
    echo "${VERMELHO}Não consegui instalar o psql.${FIM}"
    echo "Rode manualmente:  brew install libpq"
    exit 1
  fi
  ok "psql instalado"
fi

# ---------------------------------------------------------------------------
titulo "1. Conexão"
# ---------------------------------------------------------------------------
if psql "$DB_URL" -tAc "select 1" >/dev/null 2>&1; then
  versao=$(psql "$DB_URL" -tAc "select current_setting('server_version')" 2>/dev/null)
  ok "conectado — Postgres $versao"
else
  falha "não consegui conectar"
  echo
  echo "  Verifique a senha e se está usando o ${NEGRITO}Session pooler${FIM} (porta 5432),"
  echo "  não a conexão direta (que só tem IPv6)."
  exit 1
fi

# ---------------------------------------------------------------------------
titulo "2. Estrutura"
# ---------------------------------------------------------------------------
esperadas="produtos pedidos pedido_itens pagamentos lotes perfis enderecos favoritos admins fornecedor_produtos fornecedores regras_preco sincronizacoes sincronizacao_falhas eventos_pedido produto_variantes"
faltando=""
for t in $esperadas; do
  existe=$(psql "$DB_URL" -tAc "select 1 from information_schema.tables where table_schema='public' and table_name='$t'" 2>/dev/null)
  [ "$existe" != "1" ] && faltando="$faltando $t"
done
if [ -z "$faltando" ]; then
  ok "as 16 tabelas existem"
else
  falha "faltam tabelas:$faltando"
fi

migs=$(psql "$DB_URL" -tAc "select count(*) from supabase_migrations.schema_migrations" 2>/dev/null || echo 0)
[ "$migs" -ge 9 ] && ok "$migs migrations registradas" || aviso "só $migs migrations registradas (esperado 9)"

# ---------------------------------------------------------------------------
titulo "3. RLS ligado"
# ---------------------------------------------------------------------------
sem_rls=$(psql "$DB_URL" -tAc "
  select coalesce(string_agg(tablename, ', '), '')
  from pg_tables
  where schemaname='public' and not rowsecurity
    and tablename in ('produtos','pedidos','pedido_itens','pagamentos','lotes',
                      'perfis','enderecos','favoritos','admins','fornecedor_produtos')" 2>/dev/null)
if [ -z "$sem_rls" ]; then
  ok "RLS ativo em todas as tabelas sensíveis"
else
  falha "RLS DESLIGADO em: $sem_rls"
fi

# ---------------------------------------------------------------------------
titulo "4. Regras de negócio (verificar.sql)"
# ---------------------------------------------------------------------------
saida=$(psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$AQUI/verificar.sql" 2>&1)
if echo "$saida" | grep -q "TUDO OK"; then
  ok "máquina de estados recusa despachar pedido não pago"
  ok "lote aberto é único"
  ok "total do pedido tem que fechar a conta"
  ok "webhook repetido não duplica pagamento"
  ok "disjuntor barra variação absurda de preço"
else
  falha "verificar.sql falhou"
  echo "$saida" | grep -E "ERROR|FALHOU|exception" | head -5 | sed 's/^/      /'
fi

# ---------------------------------------------------------------------------
titulo "5. Vazamento por RLS  ← o teste mais importante"
# ---------------------------------------------------------------------------
echo "  Usando a chave anon, a mesma que fica pública no site."
echo
API="https://$PROJECT_REF.supabase.co/rest/v1"

for tabela in pedidos perfis enderecos pagamentos lotes fornecedor_produtos; do
  resposta=$(curl -s --max-time 15 "$API/$tabela?select=*&limit=1" -H "apikey: $ANON_KEY" 2>/dev/null)
  if [ "$resposta" = "[]" ]; then
    ok "$tabela — bloqueada"
  elif echo "$resposta" | grep -q '"code"'; then
    ok "$tabela — bloqueada (sem permissão)"
  elif [ -z "$resposta" ]; then
    aviso "$tabela — sem resposta, verifique a conexão"
  else
    falha "$tabela — ${NEGRITO}VAZANDO DADO${FIM}"
    echo "      $(echo "$resposta" | head -c 120)..."
  fi
done

echo
vitrine=$(curl -s --max-time 15 "$API/produtos?select=nome&limit=1" -H "apikey: $ANON_KEY" 2>/dev/null)
if echo "$vitrine" | grep -q '"code"'; then
  falha "produtos — a vitrine NÃO consegue ler (faltou o grant da migration 09)"
else
  ok "produtos — vitrine consegue ler (hoje devolve vazio: nada publicado ainda)"
fi

# ---------------------------------------------------------------------------
titulo "6. Dados iniciais"
# ---------------------------------------------------------------------------
forn=$(psql "$DB_URL" -tAc "select nome from fornecedores limit 1" 2>/dev/null)
[ -n "$forn" ] && ok "fornecedora cadastrada: $forn" || falha "fornecedora não foi semeada"

lote=$(psql "$DB_URL" -tAc "select count(*) from lotes where status='aberto'" 2>/dev/null)
[ "$lote" = "1" ] && ok "1 lote aberto, pronto para receber pedidos" || falha "lotes abertos: $lote (esperado 1)"

admins=$(psql "$DB_URL" -tAc "select count(*) from admins" 2>/dev/null)
if [ "$admins" -ge 1 ]; then
  ok "$admins admin(s) cadastrado(s)"
else
  aviso "nenhum admin ainda — passo 7 do COMO-SUBIR.md"
fi

# ---------------------------------------------------------------------------
echo
if [ "$falhas" -eq 0 ]; then
  echo "${VERDE}${NEGRITO}═══ BANCO OK ═══${FIM}"
  echo
  echo "Próximo passo: criar seu usuário admin e preencher o .env da API."
  echo "Está no passo 7 de supabase/COMO-SUBIR.md"
else
  echo "${VERMELHO}${NEGRITO}═══ $falhas PROBLEMA(S) ═══${FIM}"
  echo "Cole esta saída no chat que eu corrijo."
fi
echo
exit $falhas
