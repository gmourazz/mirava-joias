# CLAUDE.md

Orientação para o Claude Code trabalhar neste repositório.

---

## Estrutura

```
mirava/
├── docs/                       documentos do projeto (valem para tudo)
│   ├── ARQUITETURA.md          COMO construir — camadas, banco, auth, fluxos
│   ├── PLANO.md                O QUE construir e em que ordem — fases, custos, riscos
│   └── simulador-precos.html   ferramenta: markup, desconto, margem, lote
│
└── mirava-eccomerce/
    ├── api/                    BACKEND · Go · deploy no Cloud Run (ou VPS Hostinger)
    ├── db/                     BANCO · Postgres próprio, schema.sql, docker-compose.yml
    ├── supabase/                (histórico — projeto migrou do Supabase, ver decisão 15
    │                             em ARQUITETURA.md; mantido só como referência)
    └── frontend/                FRONTEND · React + Vite · deploy no Cloudflare Pages
```

**Três projetos independentes, três deploys separados.** O front nunca importa
código do back nem fala com o Postgres direto — conversa com a API Go por
HTTP, e é a API Go quem fala com o banco.

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
  `dominio.Cents` no Go. `0.1 + 0.2` não dá `0.3`.
- **Preço é calculado no servidor.** O front-end nunca envia preço — só
  `product_id`, tamanho e quantidade. Aceitar preço do cliente significa vender
  joia por um real.
- **O webhook do Mercado Pago é a fonte da verdade** do pagamento, nunca o
  redirect de retorno. Sempre validar `x-signature` (HMAC-SHA256) e reconsultar
  a API do MP pelo ID.
- **A API Go é a fronteira de segurança do banco.** Não existe mais RLS
  (Postgres próprio, sem papéis `anon`/`authenticated`) — o front nunca conecta
  direto no banco, só fala com a API. Toda consulta que toca dado de cliente
  precisa filtrar por `user_id` explicitamente no Go: esquecer esse filtro
  equivale a esquecer uma policy.
- **Papel de admin mora em tabela própria** (`admins`), nunca num campo que o
  próprio usuário edita.
- **Fornecedora:** Lilly Store (`uselilly.com`), plataforma wBuy. A dona optou
  por **não** pedir credencial de API — a sincronização lê `sitemap.xml` +
  páginas públicas. As páginas vêm em **ISO-8859-1**: no Go, use
  `charmap.ISO8859_1.NewDecoder()` sobre o corpo, nunca `io.ReadAll` direto.
- **Preço de atacado** ≈ 70% do varejo da Lilly (confirmado em 5 amostras).
  Markup alvo: **200%**.
- **A sincronização atualiza preço sozinha, mas com disjuntor:** variação acima
  de 30% não é gravada — vira `suggested_price_cents` e alerta. Um extrator
  quebrado que leia R$2 no lugar de R$23 destruiria o catálogo inteiro.
- **A sincronização escreve só em `supplier_products`** (espelho), nunca em
  `products` (catálogo da dona). Produto novo entra despublicado.
- **Compra em lote:** pedidos pagos acumulam até R$300 (frete grátis atacado,
  Sudeste) ou até o pedido mais antigo fazer 5 dias úteis — o que vier primeiro.
  Despacho semanal, aos **sábados de manhã** (agência dos Correios).
  Prazo prometido: 10 a 20 dias úteis.
- **Conta obrigatória** para comprar (e-mail/senha, login próprio — ver seção
  auth abaixo). Mas `orders.user_id` é anulável e a regra vive em configuração
  (`frontend/src/config/loja.ts`) — é uma decisão reversível, não espalhe a
  suposição de login pelo código.

---

## Idioma e convenção de nomes

A dona do projeto fala português. Documentos, comentários de código e
mensagens de commit em **português**.

**Identificadores de código sempre em inglês** — tabela, coluna, função,
variável, tipo, campo JSON: `users`, `password_hash`, `orders`, `Cents`,
`CreateOrder`. É a convenção padrão da indústria e facilita usar bibliotecas,
exemplos e ferramentas em inglês.

**Exceção deliberada — valores de conteúdo continuam em português.** Os
valores dos enums `category` e `metal` (`aneis`, `colares`, `prata`, `ouro`
etc.) são dado, não identificador: eles viram slug de URL (`/categoria/prata`)
e chave de imagem em `frontend/src/lib/images.ts` (`cat-aneis.webp`). Traduzir
esses valores quebraria rotas e imagens sem ganho nenhum — só mexa nisso se
também for renomear os arquivos de imagem.

---

## `mirava-eccomerce/api/` — backend Go

```bash
cd mirava-eccomerce/api
go mod tidy
go test ./...            # domínio roda em milissegundos, sem banco
go run ./cmd/servidor    # precisa de .env preenchido (ver .env.exemplo)
```

Camadas, com a dependência sempre apontando para dentro:

- `internal/dominio/` — regras puras. **Não importa banco, HTTP nem nada.**
  É onde moram preço, máquina de estados do pedido e regra do lote.
- `internal/lilly/` — leitura do catálogo da fornecedora + salvaguardas
- `internal/mercadopago/` — preferência, consulta, validação de assinatura
- `internal/auth/` — bcrypt + JWT (HS256) emitido pela própria API. Login e
  cadastro são nossos — não depende de nenhum provedor externo.
- `internal/db/` — acesso ao Postgres com pgx
- `internal/web/` — handlers HTTP (catálogo, conta, checkout, webhook, tarefas)
- `cmd/servidor/` — wiring e encerramento gradual

**Ao mexer em preço, pedido ou lote, escreva o teste primeiro.** É código que
mexe com dinheiro e roda sem dependência nenhuma — não há desculpa.

**Duplicações intencionais:** a máquina de estados e o disjuntor de preço
existem em Go **e** em SQL. É defesa em profundidade, não descuido. Mudou num
lado, mude no outro — `TestEveryStatusHasTableEntry` existe para lembrar.

---

## `mirava-eccomerce/db/` — banco

```bash
cd mirava-eccomerce/db
docker compose up -d                                              # sobe o Postgres local
docker exec -i mirava-postgres psql -U mirava -d mirava < schema.sql
```

`schema.sql` é a fonte única do schema — não há migrations numeradas por
enquanto (o histórico de migrations do Supabase fica em `supabase/`, mantido
só como referência). Mudou o schema, edite `schema.sql` e reaplique num banco
limpo local antes de mexer em produção.

Ver `db/README.md` para os passos completos, incluindo como se tornar admin.

---

## `mirava-eccomerce/frontend/` — frontend

```bash
cd mirava-eccomerce/frontend
npm run dev
npm run build     # tsc -b && vite build — é o único type check do projeto
npm run lint      # oxlint
```

React 19 + TypeScript + Vite + Tailwind v4 + lucide-react + react-router-dom.

- **Rotas** em `src/App.tsx`. Hoje: `/`, `/categoria/:menuKey/:filter`,
  `/produto/:slug`, `/conta`.
- **API**: `src/lib/api.ts` é o único cliente HTTP — todo dado vem da API Go
  (`VITE_API_URL`), nunca de `supabase-js` (removido) nem de banco direto.
- **Catálogo**: `src/catalogo/` (consultas, hooks, tipos) fala com a API Go.
- **Conta**: `src/context/AuthContext.tsx` guarda o token da sessão
  (localStorage) e fala com `/auth/*`. Página em `src/pages/Conta.tsx`.
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
