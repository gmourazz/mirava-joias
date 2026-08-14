# CLAUDE.md

Orientação para o Claude Code trabalhar neste repositório.

---

## Estrutura

```
mirava/
├── docs/                       documentos do projeto (valem para tudo)
│   ├── ARQUITETURA.md          COMO construir — camadas, banco, RLS, auth, fluxos
│   ├── PLANO.md                O QUE construir e em que ordem — fases, custos, riscos
│   └── simulador-precos.html   ferramenta: markup, desconto, margem, lote
│
└── mirava-eccomerce/
    ├── api/                    BACKEND · Go · deploy no Cloud Run
    ├── supabase/               BANCO · migrations, RLS, verificar.sql
    └── frontend/               FRONTEND · React + Vite · deploy no Cloudflare Pages
```

**Três projetos independentes, três deploys separados.** O front nunca importa
código do back; conversa com ele por HTTP e com o Supabase por `supabase-js`.

@docs/ARQUITETURA.md
@docs/PLANO.md

Quando uma decisão nova for tomada em conversa, **atualize o documento
correspondente** — não deixe a decisão só no código. A tabela "Decisões
registradas" (seção 16 da arquitetura) é o lugar de registrar mudanças de rumo.

---

## Contexto de negócio (invariantes que o código precisa respeitar)

A Mirava é **revenda sob encomenda**, não estoquista. A cliente paga primeiro,
a peça é comprada na fornecedora depois, chega até a dona, que reembala e envia.

- **Dinheiro é sempre centavos inteiros.** Nunca float. `integer` no Postgres,
  `dominio.Centavos` no Go. `0.1 + 0.2` não dá `0.3`.
- **Preço é calculado no servidor.** O front-end nunca envia preço — só
  `produto_id`, tamanho e quantidade. Aceitar preço do cliente significa vender
  joia por um real.
- **O webhook do Mercado Pago é a fonte da verdade** do pagamento, nunca o
  redirect de retorno. Sempre validar `x-signature` (HMAC-SHA256) e reconsultar
  a API do MP pelo ID.
- **RLS ligado em toda tabela, negando por padrão.** A chave anon está no bundle
  público — RLS é a única fronteira de segurança real do lado do front.
- **A API Go conecta como dona do banco, então RLS não a protege.** Toda
  consulta que toca dado de cliente precisa filtrar por `user_id`
  explicitamente. Esquecer esse filtro no Go equivale a esquecer uma policy.
- **Papel de admin mora em tabela própria** (`admins`), nunca em `user_metadata`
  — o próprio usuário edita esse campo.
- **Fornecedora:** Lilly Store (`uselilly.com`), plataforma wBuy. A dona optou
  por **não** pedir credencial de API — a sincronização lê `sitemap.xml` +
  páginas públicas. As páginas vêm em **ISO-8859-1**: no Go, use
  `charmap.ISO8859_1.NewDecoder()` sobre o corpo, nunca `io.ReadAll` direto.
- **Preço de atacado** ≈ 70% do varejo da Lilly (confirmado em 5 amostras).
  Markup alvo: **200%**.
- **A sincronização atualiza preço sozinha, mas com disjuntor:** variação acima
  de 30% não é gravada — vira `preco_sugerido_centavos` e alerta. Um extrator
  quebrado que leia R$2 no lugar de R$23 destruiria o catálogo inteiro.
- **A sincronização escreve só em `fornecedor_produtos`** (espelho), nunca em
  `produtos` (catálogo da dona). Produto novo entra despublicado.
- **Compra em lote:** pedidos pagos acumulam até R$300 (frete grátis atacado,
  Sudeste) ou até o pedido mais antigo fazer 5 dias úteis — o que vier primeiro.
  Despacho semanal, às segundas. Prazo prometido: 10 a 20 dias úteis.
- **Conta obrigatória** para comprar (e-mail/senha + Google). Mas
  `pedidos.user_id` é anulável e a regra vive em configuração — é uma decisão
  reversível, não espalhe a suposição de login pelo código.

---

## `mirava-eccomerce/api/` — backend Go

```bash
cd mirava-eccomerce/api
go mod tidy
go test ./...            # domínio roda em milissegundos, sem banco
go run ./cmd/servidor    # precisa de .env preenchido
```

Camadas, com a dependência sempre apontando para dentro:

- `internal/dominio/` — regras puras. **Não importa banco, HTTP nem nada.**
  É onde moram preço, máquina de estados do pedido e regra do lote.
- `internal/lilly/` — leitura do catálogo da fornecedora + salvaguardas
- `internal/mercadopago/` — preferência, consulta, validação de assinatura
- `internal/auth/` — valida o JWT do Supabase (não implementa login)
- `internal/db/` — acesso ao Postgres com pgx
- `internal/web/` — handlers HTTP
- `cmd/servidor/` — wiring e encerramento gradual

**Ao mexer em preço, pedido ou lote, escreva o teste primeiro.** É código que
mexe com dinheiro e roda sem dependência nenhuma — não há desculpa.

**Duplicações intencionais:** a máquina de estados e o disjuntor de preço
existem em Go **e** em SQL. É defesa em profundidade, não descuido. Mudou num
lado, mude no outro — `TestTodoStatusTemEntradaNaTabela` existe para lembrar.

---

## `mirava-eccomerce/supabase/` — banco

```bash
cd mirava-eccomerce/supabase
supabase db push                    # aplica as migrations
# depois, cole verificar.sql no SQL Editor do painel
```

Migrations numeradas de 01 a 08: base → catálogo → contas → pedidos →
preços/sync → funções → RLS → seed.

**Nunca altere o schema de produção clicando no painel.** Sem migration
versionada você não consegue recriar o banco nem saber o que mudou quando
algo quebrar.

`verificar.sql` testa constraints, triggers, máquina de estados, idempotência
de pagamento e o disjuntor de preço. Rode depois de qualquer migration nova.

---

## `mirava-eccomerce/frontend/` — frontend

```bash
cd mirava-eccomerce/frontend
npm run dev
npm run build     # tsc -b && vite build — é o único type check do projeto
npm run lint      # oxlint
```

React 19 + TypeScript + Vite + Tailwind v4 + lucide-react + react-router-dom.

- **Rotas** em `src/App.tsx`. Hoje: `/` e `/categoria/:menuKey/:filter`.
- **Dados** ainda em `src/data/products.ts` e `src/data/content.ts` — conteúdo
  fictício que **precisa sair** quando o catálogo vier do banco. Os depoimentos
  e as notas de avaliação são inventados; depoimento falso é publicidade
  enganosa, tire antes de lançar.
- **Imagens** via `src/lib/images.ts`, que mapeia seeds para arquivos em
  `src/assets/images/`. Para adicionar, ponha o arquivo lá, importe e registre
  no `POOL` — não inline base64 em componente.
- **Carrinho**: `src/context/CartContext.tsx` hoje só abre e fecha o drawer.
  Não existe item, quantidade nem total. É o próximo trabalho grande do front.
- **Estilo**: Tailwind v4 sem `tailwind.config.js` — os tokens estão em
  `src/index.css` sob `@theme`. Prefira os nomes do tema (`bg-wine`,
  `font-serif`) a hex cru. Os valores arbitrários (`text-[13.5px]`,
  `px-[30px]`) são fidelidade proposital ao design original, não sujeira.
- **Scroll-reveal**: use o componente `Reveal.tsx`, não animação CSS solta.
- **Ícones**: lucide-react. A biblioteca não tem ícones de marca — `AtSign` é
  o substituto do Instagram. Não reintroduza SVG customizado para isso.

**Paleta e tipografia** seguem a identidade da marca: rosa véu `#FFE5F0`,
rosa forte `#D46A9F` (CTA), vinho `#8E3B6B` (texto). Fontes Marcellus,
Italiana e Montserrat.

---

## Idioma

A dona do projeto fala português. Documentos, comentários de código e mensagens
de commit em **português**. Nomes de código no domínio também em português —
`precificar`, `pedidos`, `lotes`, `Centavos` — para o código ler igual à
conversa.
