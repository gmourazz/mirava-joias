# Arquitetura — Mirava Joias

**Data:** 11 de agosto de 2026
**Contexto:** revenda sob encomenda da Lilly Store, despacho semanal em lote, conta obrigatória
**Estilo:** camadas pragmáticas — rigor onde paga, sem cerimônia onde não paga

Este documento decide **como o sistema é construído**. O `PLANO.md` decide **o que construir e em que ordem**.

---

## 1. Princípios

Cinco regras que resolvem 90% das dúvidas de "onde eu ponho esse código?".

**1. O domínio não sabe que existe HTTP nem banco.**
As regras de preço, lote e pedido vivem em `api/internal/dominio/`, em Go puro. Esse pacote não importa `net/http`, não importa `pgx`, não importa nada. Isso não é purismo: é o que te deixa rodar `go test ./internal/dominio` em milissegundos, sem subir Postgres nem servidor.

**2. Dependência aponta pra dentro.**
`web` → `db`/`mercadopago`/`lilly` → `dominio`. Nunca o contrário. O domínio é o centro e não conhece ninguém.

**3. Dinheiro é inteiro, em centavos. Sempre.**
`0.1 + 0.2` dá `0.30000000000000004` tanto em Go quanto em JavaScript. Numa loja isso vira centavo faltando no fechamento do mês. R$57,50 é `5750` — no Go como `dominio.Centavos`, no Postgres como `integer`, e só vira string formatada na hora de mostrar na tela.

**4. O servidor decide, o cliente exibe.**
Preço, total, desconto e status de pagamento são calculados no servidor. O front-end nunca manda um preço — só manda quais produtos.

**5. Toda decisão que você vai querer reverter vira configuração, não código espalhado.**
Conta obrigatória, markup padrão, teto de dias do lote, valor do frete grátis: tudo em um lugar só. Você já mudou de ideia sobre conta obrigatória uma vez; vai mudar de novo.

---

## 2. Visão geral

```
┌─────────────────────────────────────────────────────────┐
│  CLOUDFLARE PAGES  ·  React + Vite (público)            │
│                                                          │
│  /                      vitrine                          │
│  /produto/:slug         página de produto                │
│  /categoria/...         listagem                         │
│  /carrinho /checkout    compra                           │
│  /conta  /conta/pedidos /conta/favoritos                 │
│  /admin/*               painel (protegido)               │
└─────┬─────────────────────────────────┬──────────────────┘
      │ supabase-js · chave anon        │ fetch + JWT
      │ leitura, sempre via RLS         │ escrita de dinheiro
      ▼                                 ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│  SUPABASE                │  │  CLOUD RUN · API em Go       │
│                          │  │  mirava-eccomerce/api/       │
│  Auth   e-mail + Google  │◄─┤                              │
│  Postgres                │  │  POST /checkout              │
│  Storage  imagens        │  │    recalcula preço no servidor│
│  RLS   a fronteira real  │  │  POST /webhook/mercadopago   │
│                          │  │    confirma pagamento        │
└──────────────────────────┘  │  POST /tarefas/sincronizar   │
           ▲                  │  POST /tarefas/avaliar-lote  │
           │ pgx (dono do     └──────────┬───────────────────┘
           │ banco, sem RLS)             │
           └─────────────────────────────┤
                                         ▼
                          Mercado Pago      uselilly.com
                                              ▲
                                   Cloud Scheduler (6h / diário)
```

**A fronteira que importa:** o site público só **lê**, e só o que o RLS deixa passar. Tudo que envolve dinheiro — preço, pedido, pagamento, lote — passa pela API em Go, que conecta como dono do banco.

> **Consequência do Go conectar como dono:** o RLS **não se aplica** a ele. Toda consulta que toca dado de cliente precisa filtrar por `user_id` explicitamente. Esquecer esse filtro no Go é o equivalente, deste lado, a esquecer uma policy no banco. Os comentários em `internal/db/db.go` marcam onde isso importa.

---

## 3. As camadas, na prática

Clean architecture costuma ser explicada com quatro círculos concêntricos e nenhum exemplo. Aqui é o que cada camada significa neste projeto:

As camadas não estão todas num projeto só: elas se dividem entre `api/` (Go) e `frontend/` (React).

| Camada | Onde | O que mora aqui | Pode importar |
|---|---|---|---|
| `dominio` | `api/internal/dominio/` | Regras que seriam verdade mesmo sem computador. "Margem é lucro sobre preço." "Um lote fecha em R$300 ou 5 dias." | **nada** |
| Adapters | `api/internal/{db,mercadopago,lilly,auth}/` | O mundo concreto: Postgres, Mercado Pago, páginas da Lilly, JWT | `dominio` |
| Handlers | `api/internal/web/` | Orquestram: validam entrada, chamam o domínio, respondem HTTP | tudo do `api/` |
| Apresentação | `frontend/src/` | React. Telas, componentes, hooks, carrinho no navegador | Supabase e a API por HTTP |

**O front não tem camada de domínio** — e isso é de propósito. Ele não calcula preço, não decide status, não avalia lote. Ele exibe `preco_centavos` que veio do banco e manda `{produto_id, tamanho, quantidade}` para a API. Toda regra de negócio mora no Go.

Isso resolve de graça o problema que mais atrapalha arquitetura compartilhada: não existe risco de a regra de preço do front divergir da do back, porque o front não tem regra de preço.

### Onde eu aplico rigor e onde eu não aplico

**Com rigor** (domínio puro, testado): precificação, máquina de estados do pedido, regra do lote, validação de assinatura. É onde erro custa dinheiro e onde teste automatizado paga o investimento no primeiro dia.

**Sem cerimônia** (componente React lê direto do Supabase): listar produtos da vitrine, buscar, favoritar. São leituras simples, sem regra de negócio, já protegidas por RLS. Criar interface, adapter e mock para renderizar um card seria burocracia sem retorno.

Se você está em dúvida: **tem regra de negócio ou mexe com dinheiro? vai para o Go, com teste. É só ler e mostrar? o front lê direto do Supabase.**

---

## 4. Estrutura de pastas

```
mirava-eccomerce/
│
├── api/                              BACKEND · Go · Cloud Run
│   ├── cmd/servidor/main.go          wiring, .env, encerramento gradual
│   ├── internal/
│   │   ├── dominio/                  ← ZERO dependências. Testável em milissegundos.
│   │   │   ├── dinheiro.go           Centavos (int64), ParseBRL, formatação
│   │   │   ├── precificacao.go       markup, desconto, margem, disjuntor
│   │   │   ├── pedido.go             máquina de estados + rótulos da cliente
│   │   │   └── lote.go               regra do R$300, teto de dias, dias úteis
│   │   ├── lilly/                    leitura do catálogo (ISO-8859-1) + salvaguardas
│   │   ├── mercadopago/              preferência, consulta, assinatura HMAC
│   │   ├── auth/                     valida o JWT do Supabase (não implementa login)
│   │   ├── db/                       Postgres com pgx
│   │   └── web/                      handlers: checkout, webhook, tarefas
│   ├── Dockerfile                    build em 2 etapas, imagem distroless
│   └── .env.exemplo
│
├── supabase/                         BANCO · migrations versionadas
│   ├── migrations/                   01 a 08 — é seu histórico do banco
│   └── verificar.sql                 testa constraints, triggers, disjuntor
│
└── frontend/                         FRONTEND · React + Vite · Cloudflare Pages
    └── src/
        ├── features/                 uma pasta por funcionalidade
        │   ├── catalogo/             vitrine, categoria, página de produto
        │   ├── carrinho/             estado no navegador + drawer
        │   ├── checkout/             chama POST /checkout da API
        │   ├── conta/                login, cadastro, pedidos, favoritos
        │   └── admin/                dashboard, pedidos, lotes, preços
        ├── shared/
        │   ├── ui/                   os componentes visuais atuais vêm pra cá
        │   └── api.ts                cliente HTTP da API Go
        ├── lib/supabase.ts           cliente de leitura + auth
        ├── config/loja.ts            decisões reversíveis, num lugar só
        └── app/                      router, providers
```

**Repare no que o front NÃO tem:** nenhuma pasta `domain`, `application` ou `portas`. Ele não precisa — quem tem regra de negócio é o Go.

### O arquivo de configuração

Fica no front porque são decisões de apresentação e comportamento de loja. As que o servidor precisa conhecer (markup, teto de lote) vivem no Go e no banco.

```ts
// frontend/src/config/loja.ts
export const LOJA = {
  contaObrigatoriaParaComprar: true,   // ← a decisão de hoje, num lugar só
  markupPadraoPct: 200,
  descontoPixPct: 5,
  parcelasSemJuros: 3,
  lote: {
    metaFreteGratisCentavos: 30000,    // R$300 — Sudeste
    tetoDiasUteis: 5,
    diaDeDespacho: 6,                  // sábado (agência abre de manhã)
  },
  prazo: { minDiasUteis: 10, maxDiasUteis: 20 },
} as const;
```

Quando você mudar de ideia sobre conta obrigatória, muda `true` para `false` e o checkout já sabe lidar — porque o caso de uso foi escrito consultando essa flag, não assumindo login.

---

## 5. Dinheiro: a decisão mais importante do projeto

```ts
// src/domain/shared/Dinheiro.ts
export type Centavos = number & { readonly __brand: 'Centavos' };

export const centavos = (n: number): Centavos => Math.round(n) as Centavos;
export const deReais = (r: number): Centavos => centavos(r * 100);

export const somar = (a: Centavos, b: Centavos) => centavos(a + b);
export const multiplicar = (v: Centavos, f: number) => centavos(v * f);
export const percentual = (v: Centavos, pct: number) => centavos(v * pct / 100);

export const formatar = (v: Centavos) =>
  (v / 100).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
  });
```

O `__brand` é um truque de TypeScript: `Centavos` e `number` viram tipos diferentes, então o compilador te impede de somar centavos com reais por engano. Custa uma linha e evita a classe de bug mais chata de rastrear.

**No Postgres:** use `integer` para centavos, ou `numeric(12,2)` — **nunca `float`/`real`**. `numeric` é exato; `float` não é.

---

## 6. O domínio de precificação

Esta é a regra que você mais vai mexer, então ela fica isolada e testada:

```ts
// src/domain/catalogo/precificacao.ts
import { Centavos, centavos, percentual } from '../shared/Dinheiro';

export interface EntradaPreco {
  custoAtacado: Centavos;
  embalagem: Centavos;
  markupPct: number;
  descontoPct: number;
  taxaGatewayPct: number;
}

export interface Precificacao {
  precoBase: Centavos;
  precoFinal: Centavos;
  taxaGateway: Centavos;
  lucro: Centavos;
  margemPct: number;
}

export function precificar(e: EntradaPreco): Precificacao {
  const precoBase = centavos(e.custoAtacado * (1 + e.markupPct / 100));
  const precoFinal = centavos(precoBase * (1 - e.descontoPct / 100));
  const taxaGateway = percentual(precoFinal, e.taxaGatewayPct);
  const lucro = centavos(precoFinal - e.custoAtacado - e.embalagem - taxaGateway);
  const margemPct = precoFinal > 0 ? (lucro / precoFinal) * 100 : 0;
  return { precoBase, precoFinal, taxaGateway, lucro, margemPct };
}

export const margemPerigosa = (p: Precificacao) => p.margemPct < 20;
```

Repare: nenhum import de React, de Supabase, de nada. Dá pra testar assim:

```ts
test('markup de 200% sobre R$23 com taxa de 4,98% dá R$37,56 de lucro', () => {
  const r = precificar({
    custoAtacado: deReais(23), embalagem: deReais(5),
    markupPct: 200, descontoPct: 0, taxaGatewayPct: 4.98,
  });
  expect(r.precoFinal).toBe(6900);
  expect(r.lucro).toBe(3756);
});
```

---

## 7. A máquina de estados do pedido

Status solto em `text` é convite pra pedido "enviado" que nunca foi pago. Modele as transições legais:

```ts
// src/domain/pedido/maquinaDeEstados.ts
export type StatusPedido =
  | 'aguardando_pagamento'
  | 'pago'
  | 'no_lote'
  | 'comprado_fornecedor'
  | 'recebido_por_mim'
  | 'enviado'
  | 'entregue'
  | 'cancelado'
  | 'estornado'
  | 'falha_estoque';

const TRANSICOES: Record<StatusPedido, StatusPedido[]> = {
  aguardando_pagamento: ['pago', 'cancelado'],
  pago:                 ['no_lote', 'estornado', 'falha_estoque'],
  no_lote:              ['comprado_fornecedor', 'falha_estoque'],
  comprado_fornecedor:  ['recebido_por_mim', 'falha_estoque'],
  recebido_por_mim:     ['enviado'],
  enviado:              ['entregue'],
  entregue:             [],
  cancelado:            [],
  estornado:            [],
  falha_estoque:        ['estornado', 'no_lote'],
};

export const podeIr = (de: StatusPedido, para: StatusPedido) =>
  TRANSICOES[de].includes(para);
```

Chame `podeIr` antes de qualquer mudança de status, no caso de uso **e** numa constraint do banco. Duas camadas de proteção para o dado que mais importa.

---

## 8. Contas e autenticação

Você escolheu **conta obrigatória** com **e-mail/senha + Google**.

> Vale registrar, sem insistir: exigir cadastro antes de pagar costuma custar conversão de forma relevante, e o custo cai justamente na primeira compra, que é a mais difícil de conseguir. Por isso `contaObrigatoriaParaComprar` é uma flag e `pedidos.user_id` foi modelado como anulável — o dia em que você quiser testar checkout de visitante, é uma linha de config e zero migração.

### Tabelas

```sql
-- Supabase já gerencia auth.users. Perfil é o SEU complemento.
create table perfis (
  id           uuid primary key references auth.users(id) on delete cascade,
  nome         text not null,
  telefone     text,
  cpf          text,
  aceita_email boolean default true,
  criado_em    timestamptz default now()
);

create table enderecos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  apelido    text,                      -- "casa", "trabalho"
  cep        text not null,
  rua        text not null,
  numero     text not null,
  complemento text,
  bairro     text not null,
  cidade     text not null,
  uf         char(2) not null,
  principal  boolean default false
);

create table favoritos (
  user_id    uuid not null references auth.users(id) on delete cascade,
  produto_id uuid not null references produtos(id) on delete cascade,
  criado_em  timestamptz default now(),
  primary key (user_id, produto_id)
);

-- pedidos.user_id: anulável de propósito (ver nota acima)
alter table pedidos add column user_id uuid references auth.users(id);
```

### Criação automática do perfil

Não crie o perfil no front-end — se a chamada falhar, você fica com usuário sem perfil. Deixe o banco fazer:

```sql
create function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end; $$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();
```

O `full_name` vem preenchido quando o login é pelo Google. No cadastro por e-mail, vem vazio e você pede na tela seguinte.

### ⚠️ Papel de admin: `app_metadata`, nunca `user_metadata`

Esta é a pegadinha de segurança mais séria do Supabase Auth:

- **`user_metadata` o próprio usuário consegue editar.** Se você guardar `{ role: 'admin' }` ali, qualquer cliente cadastrada vira admin com uma chamada de API.
- **`app_metadata` só o `service_role` altera.** É onde papel mora.

```sql
create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create function public.eh_admin()
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
```

Uma tabela é ainda mais simples de auditar que metadata, e você adiciona a si mesma com um `insert` manual pelo painel.

### Rotas protegidas

```tsx
// src/features/conta/RotaPrivada.tsx
export function RotaPrivada({ children, exigeAdmin = false }) {
  const { sessao, carregando, ehAdmin } = useAuth();
  if (carregando) return <Carregando />;
  if (!sessao) return <Navigate to="/entrar" state={{ de: location.pathname }} replace />;
  if (exigeAdmin && !ehAdmin) return <Navigate to="/" replace />;
  return children;
}
```

**Isso é usabilidade, não segurança.** Esconder a rota no React não protege nada — quem chamar a API direto passa por cima. A segurança de verdade é o RLS da próxima seção. O componente só evita que a pessoa veja uma tela quebrada.

---

## 9. RLS: a fronteira de segurança real

A chave anon está dentro do JavaScript que você entrega no navegador. Qualquer pessoa lê. **A única coisa que impede alguém de baixar sua tabela de pedidos é o RLS.**

```sql
alter table produtos   enable row level security;
alter table perfis     enable row level security;
alter table enderecos  enable row level security;
alter table favoritos  enable row level security;
alter table pedidos    enable row level security;
alter table pedido_itens enable row level security;
alter table pagamentos enable row level security;
alter table lotes      enable row level security;
alter table fornecedor_produtos enable row level security;

-- Vitrine: qualquer um vê produto publicado
create policy "vitrine" on produtos
  for select using (publicado = true);

-- Perfil: só o dono
create policy "perfil proprio" on perfis
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "enderecos proprios" on enderecos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "favoritos proprios" on favoritos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Pedidos: a cliente LÊ os seus. Não cria, não edita.
-- Quem cria pedido é a API Go, que conecta como dona do banco.
create policy "meus pedidos" on pedidos
  for select using (auth.uid() = user_id);

create policy "meus itens" on pedido_itens
  for select using (
    exists (select 1 from pedidos p
            where p.id = pedido_itens.pedido_id and p.user_id = auth.uid())
  );

-- Admin vê tudo
create policy "admin le pedidos" on pedidos
  for select using (public.eh_admin());

-- lotes, pagamentos, fornecedor_produtos: NENHUMA policy pública.
-- Sem policy = ninguém do lado anon passa. Só service_role e admin.
create policy "admin lotes" on lotes for all using (public.eh_admin());
```

**O padrão mental:** crie a tabela com RLS ligado e **zero** policies. Aí libere só o que precisa, uma policy por vez. É muito mais seguro do que criar aberto e tentar fechar depois.

**Teste que vale ouro** — coloque no checklist de lançamento:

```ts
// deve FALHAR ou voltar vazio
const anon = createClient(URL, ANON_KEY);
const { data } = await anon.from('pedidos').select('*');
expect(data).toHaveLength(0);   // se voltar dado, você tem vazamento de LGPD
```

---

## 10. Fluxo de checkout

```
1. Cliente logada monta carrinho (localStorage + estado React)
        ↓
2. Escolhe endereço salvo, confirma
        ↓
3. POST criar-pagamento  { itens: [{produto_id, tamanho, qtd}], endereco_id }
   ⚠️ NENHUM preço vai nessa requisição
        ↓
4. API Go (conecta como dona do banco):
   • valida o JWT → descobre user_id
   • busca preço REAL de cada produto no banco
   • confere disponibilidade
   • calcula total com o domínio compartilhado
   • grava pedido `aguardando_pagamento` + itens com preço e custo congelados
   • cria preferência no Mercado Pago com external_reference = pedido.id
   • devolve init_point
        ↓
5. Redirect pro Mercado Pago
        ↓
6. Webhook chega  ← A FONTE DA VERDADE
   • valida x-signature (HMAC-SHA256)
   • GET /v1/payments/{id} na API do MP — não confia no corpo recebido
   • se approved: insert em pagamentos (unique em mp_payment_id = idempotência)
   • pedido → `pago`, entra no lote aberto
   • e-mail pra cliente, alerta pra você
        ↓
7. Segunda-feira: você abre /admin/lotes, copia os códigos, compra na Lilly
```

**As quatro linhas de defesa do dinheiro:**

1. Preço recalculado no servidor — ninguém compra por R$1
2. `x-signature` validada — ninguém finge pagamento
3. Status reconsultado na API do MP — corpo do webhook pode mentir
4. `unique (mp_payment_id)` — webhook repetido não duplica faturamento

---

## 11. O problema do domínio compartilhado

O front-end é TypeScript. O backend é Go. Eles nunca vão compartilhar código. Como manter a mesma regra de preço nos dois?

**A resposta mais simples é a melhor: quase não precisa compartilhar.**

O front-end **não calcula preço** — ele exibe `produtos.preco_centavos`, que já está gravado no banco. Quem calcula é o Go. Então o que precisa existir dos dois lados é muito pouco.

| Código | Onde vive | Duplicado? |
|---|---|---|
| `Precificar()` | `api/internal/dominio/precificacao.go` | não |
| Formatação de moeda | front (exibição) e Go (logs) | trivial, sem risco |
| Máquina de estados | Go **e** função SQL `transicao_valida` | **sim, de propósito** |
| Disjuntor de preço | Go **e** função SQL `aplicar_custo_sincronizado` | **sim, de propósito** |
| Tipos das tabelas | gerados no front: `supabase gen types typescript` | não |

### As duas duplicações intencionais

A máquina de estados e o disjuntor existem em Go **e** em SQL. Isso parece erro, mas é defesa em profundidade: o banco precisa se proteger sozinho caso a API tenha bug, e a API precisa recusar cedo para dar mensagem decente à cliente.

O risco é divergirem em silêncio. Duas travas contra isso:

- `TestTodoStatusTemEntradaNaTabela` em `pedido_test.go` falha se alguém adicionar status só de um lado
- Comentários cruzados nos dois arquivos apontando um para o outro

Cinquenta linhas duplicadas com teste é bem mais simples de manter, para uma dev sozinha, do que gerar código a partir de um schema comum.

> Se um dia isso incomodar, o caminho é gerar as duas cópias de uma definição única (um `.yaml` ou `go:generate`). Não agora — seria complexidade paga adiantado por um problema que você ainda não tem.

---

## 12. Sincronização com a Lilly — e o encoding

Sem credencial de API, o caminho é: `sitemap.xml` → páginas de produto. O `robots.txt` da Lilly libera `Allow: /`.

### Regras de convivência

- **Uma leitura a cada 6 horas**, nunca em loop
- **Pausa de 1 a 2 segundos entre páginas** — o catálogo dela tem centenas de itens; varrer tudo de uma vez parece ataque
- **`User-Agent` identificando você**, com e-mail de contato
- **Só o que mudou:** guarde o `lastmod` do sitemap e releia apenas páginas alteradas

### O encoding — a parte que você pediu

As páginas dela vêm em **ISO-8859-1** (`Content-Type: text/html; charset=ISO-8859-1`). Se você ler como UTF-8, todo acento vira `�`:

```
lendo errado:  zirc�nias � Cole��es � An�is � Pre�o � vista
lendo certo:   zircônias · Coleções · Anéis · Preço à vista
```

O erro clássico em Go é `io.ReadAll(res.Body)` direto, que trata os bytes como UTF-8. O certo é passar o corpo por um decodificador que saiba o charset:

```go
// api/internal/lilly/lilly.go

func (c *Cliente) BuscarPagina(ctx context.Context, url string) (string, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	req.Header.Set("User-Agent", UserAgent)

	res, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	// Aqui está o detalhe que salva os acentos.
	leitor := io.Reader(res.Body)
	if charsetLatin1(res.Header.Get("Content-Type")) {
		leitor = charmap.ISO8859_1.NewDecoder().Reader(res.Body)
	}

	b, err := io.ReadAll(io.LimitReader(leitor, 5<<20))
	return string(b), err
}

func charsetLatin1(contentType string) bool {
	ct := strings.ToLower(contentType)
	// Sem charset declarado, a wBuy serve latin-1. Assumir UTF-8 seria pior:
	// erraria em toda página acentuada.
	if !strings.Contains(ct, "charset=") {
		return true
	}
	return strings.Contains(ct, "iso-8859-1") ||
		strings.Contains(ct, "latin-1") ||
		strings.Contains(ct, "windows-1252")
}
```

`TextDecoder` é nativo no Deno e no Node moderno — não precisa instalar `iconv-lite`. Testado e confirmado: os 128 caracteres da amostra voltam idênticos ao original.

### Extração

```ts
export interface ProdutoLilly {
  sku: string;            // "PL289"
  nome: string;
  precoVarejo: number;    // centavos
  precoAtacado: number;   // centavos — cai pra varejo × 0,70 se não aparecer
  descricao: string;
  imagens: string[];
  url: string;
}

const paraCentavos = (s: string) =>
  Math.round(parseFloat(s.replace(/\./g, '').replace(',', '.')) * 100);

export function extrair(html: string, url: string): ProdutoLilly | null {
  const sku = html.match(/C[óo]d\.?:\s*<?[^>]*>?\s*([A-Z]+\d+)/i)?.[1];
  const nome = html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1];
  if (!sku || !nome) return null;

  const varejo = html.match(/R\$\s?([\d.]+,\d{2})/)?.[1];
  const atacado = html.match(/Atacado[\s\S]{0,120}?R\$\s?([\d.]+,\d{2})/i)?.[1];

  const precoVarejo = varejo ? paraCentavos(varejo) : 0;
  const precoAtacado = atacado
    ? paraCentavos(atacado)
    : Math.round(precoVarejo * 0.70);   // razão confirmada em 3 amostras

  const imagens = [...html.matchAll(
    /https:\/\/assets\.sistemawbuy\.com\.br\/[^\s"']+?\.jpg/g
  )].map(m => m[0]).filter(u => !u.includes('_mini'));

  return {
    sku, nome: nome.trim(), precoVarejo, precoAtacado,
    descricao: html.match(/<meta name="description" content="([^"]+)"/i)?.[1] ?? '',
    imagens: [...new Set(imagens)], url,
  };
}
```

### Duas salvaguardas obrigatórias

**1. Nunca sobrescreva com lixo.** Se a extração devolver preço zero ou nome vazio, **descarte e registre erro** — não grave. Um seletor quebrado que grava `preco = 0` no catálogo inteiro é bem pior do que uma sincronização que falha ruidosamente.

```ts
if (p.precoAtacado <= 0 || p.nome.length < 3) {
  await registrarFalha(url, 'extração suspeita');
  continue;   // mantém o dado anterior
}
```

**2. Alerta quando a taxa de sucesso cair.** Se menos de 90% das páginas extraírem direito, o layout dela mudou. Você quer saber por e-mail, não pela cliente reclamando.

### O que a sincronização faz — e o que ela não faz

Ela escreve **só** em `fornecedor_produtos` (o espelho). Nunca em `produtos` (seu catálogo). Produto novo aparece no admin como "encontrado, aguardando revisão" — você define preço, reescreve a descrição na voz da Mirava e publica.

> Copiar a descrição da Lilly literal te faz competir com ela pelo mesmo texto no Google e o site perde a voz da marca. O briefing pede "delicado, próximo, feminino" — reescreva.

---

## 13. Testes

Sem test runner hoje. Adicione **Vitest** (integra com Vite sem configuração).

| Camada | Testa? | Como |
|---|---|---|
| `domain` | **sempre** | unitário puro, rápido. Meta: 100% |
| `application` | sim | com portas falsas (mocks das interfaces) |
| Handlers HTTP | os de dinheiro | `go test` com `httptest` |
| `features` | os fluxos críticos | Testing Library: login, carrinho, checkout |
| RLS | **sempre** | script que tenta ler com anon e espera vazio |

Os testes que mais te protegem, em ordem: precificação, máquina de estados, RLS, idempotência do webhook. Se só der pra escrever quatro, escreva esses.

---

## 14. Ambientes

| | Dev | Produção |
|---|---|---|
| Supabase | projeto `mirava-dev` | projeto `mirava-prod` |
| Mercado Pago | credenciais de teste | credenciais de produção |
| Deploy | branch de preview | branch `main` |

São 2 projetos Supabase — exatamente o limite do plano grátis. Migrations em `supabase/migrations/`, versionadas no git, aplicadas com `supabase db push`. **Nunca altere o schema de produção clicando no painel** — sem migration versionada, você não consegue recriar o banco nem saber o que mudou quando algo quebrar.

---

## 15. O que muda quando crescer

Registrado para você não se preocupar agora:

| Sinal | O que fazer |
|---|---|
| Storage passa de 1 GB | Supabase Pro (US$25) ou mover imagens pro Cloudflare R2 |
| Catálogo passa de ~2 mil peças | Busca full-text do Postgres, depois paginação por cursor |
| Sincronização fica lenta | Fila com `pg_cron` + tabela de jobs, em vez de um loop só |
| Segunda fornecedora | Já cabe: `fornecedores` + `fornecedor_id` no espelho |
| Volume de pedidos incomoda | Índices em `pedidos(status, criado_em)` e `pedidos(user_id)` |
| Quiser checkout no próprio site | Trocar o adapter de `GatewayPagamento` — o domínio nem fica sabendo |

Esta última linha é o retorno concreto de ter feito as camadas: trocar Mercado Pago por outro gateway mexe em **um arquivo** de infraestrutura.

---

## 16. Decisões registradas

| # | Decisão | Por quê | Quando revisitar |
|---|---|---|---|
| 1 | Cloudflare Pages, não Vercel | Hobby da Vercel proíbe uso comercial | — |
| 2 | Supabase | Banco, auth, storage e functions num lugar só | Se precisar de multi-região |
| 3 | Checkout Pro, não Transparente | Sem dado de cartão no seu front | Quando estiver vendendo com estabilidade |
| 4 | Camadas pragmáticas | Rigor onde mexe com dinheiro | Se entrar mais gente no time |
| 5 | Conta obrigatória | Escolha da dona | Meça a conversão nos 2 primeiros meses |
| 6 | Domínio duplicado em Go e SQL | Defesa em profundidade: o banco se protege sozinho | Se a duplicação passar de ~100 linhas |
| 10 | **Backend em Go, não Edge Functions** | Escolha da dona (11/08/2026) | — |
| 11 | **Cloud Run para a API** | Free tier cobre a operação, escala a zero, roda container | Se a partida a frio incomodar |
| 12 | **Auth continua no Supabase** | Não reimplementar hash, sessão e OAuth | — |
| 13 | **Sem credencial de API da Lilly** | Escolha da dona: sync lê sitemap + páginas públicas | Se a Lilly oferecer a credencial |
| 14 | **Preço sincroniza sozinho, com disjuntor** | A Lilly muda preço direto; variação > 30% vira sugestão | Ajuste o limite se travar demais |
| 7 | Centavos inteiros | Float perde centavo | — |
| 8 | Sync escreve só no espelho | Site da Lilly não pode mexer no seu catálogo | — |
| 9 | Admin por tabela, não metadata | `user_metadata` é editável pelo usuário | — |
| 15 | **Sai do Supabase — banco, auth e storage próprios** | Escolha da dona (13/08/2026): Postgres local agora, depois VPS da Hostinger | Isso reverte as decisões 2 e 12 acima |
| 16 | **Identificadores de código em inglês** | Escolha da dona (13/08/2026): tabela, coluna, função e tipo em inglês; comentários e conteúdo (category/metal) continuam em português | Ver seção "Idioma e convenção de nomes" no CLAUDE.md |
| 17 | **Mais vendidos com dois sinais e sucessão automática** | Escolha da dona (16/08/2026): a vitrine precisa funcionar no dia 1, quando não existe venda própria, sem ficar refém da Lilly para sempre. `products.supplier_rank` guarda a posição na vitrine da fornecedora (emprestada, reescrita a cada sync) e `products.units_sold` guarda a venda da Mirava em pedidos pagos (dado nosso, permanente). A ordenação usa `units_sold` primeiro e só cai no `supplier_rank` no desempate: conforme a loja vende, a lista vira dela sozinha, sem trocar código | Quando houver venda própria em volume, avaliar cortar o `supplier_rank` da ordenação |

### Detalhe da decisão 15 — o que mudou de verdade

Sair do Supabase não foi só trocar a string de conexão do banco. Três peças que ele entregava precisaram de substituto — **status: banco e auth já feitos, storage ainda não**:

1. **Banco** ✅ — Postgres próprio, hoje local via Docker (`mirava-eccomerce/db/`, ver `schema.sql` e `docker-compose.yml`), depois na VPS da Hostinger. Sem `auth.users` nem `auth.uid()`: a tabela `users` é nossa, e a API Go filtra por `user_id` explicitamente em vez de depender de RLS.
2. **Auth** ✅ — implementado em `internal/auth/`: bcrypt para senha, JWT (HS256) emitido e validado por nós. Rotas `POST /auth/entrar`, `POST /auth/cadastrar`, `GET /auth/eu`. Google OAuth fica pra depois, se for feito de novo.
3. **Storage** ⏳ — ainda é o caminho salvo no banco sem servidor por trás (ver TODO em `frontend/src/catalogo/consultas.ts`, função `imageUrl`). Quando o catálogo for sincronizado de novo, as imagens de produto precisam ir para disco na própria VPS (servidas por Nginx ou pela API Go) ou um bucket S3-compatível — ainda não decidido.

Nota sobre nomes: esta seção e as próximas (RLS do Supabase, `auth.users`, `preco_centavos` etc.) descrevem o desenho **original**, anterior à decisão 15. O código de verdade hoje usa Postgres próprio sem RLS e identificadores em inglês (`users`, `orders`, `price_cents`...) — ver decisão 16. Os trechos de SQL/TS abaixo são história de como se chegou aqui, não o schema atual; a fonte da verdade do schema é sempre `mirava-eccomerce/db/schema.sql`.

**Consequência importante para o front:** hoje o `frontend/src/lib/supabase.ts` fala direto com o Postgres via `supabase-js`, protegido por RLS. Sem Supabase, não existe mais essa porta — não dá para um navegador falar direto com um Postgres puro com segurança. **Todo acesso a dado, incluindo leitura da vitrine, passa a ir pela API Go.** Isso na prática *simplifica* a arquitetura: a API Go vira o único ponto de acesso a dado, e RLS deixa de ser a fronteira de segurança (vira defesa em profundidade opcional) — quem protege é o filtro por `user_id` no Go, que já era a regra para tudo que mexe em dinheiro.

---

## 17. Ordem de construção

Cada etapa termina em algo que funciona:

1. **Fundação** — `git init`, Vitest, `src/domain/shared/Dinheiro.ts` com testes, `config/loja.ts`
2. **Banco** — migrations de todas as tabelas, RLS ligado, teste de vazamento passando
3. **Catálogo** — repositório + vitrine lendo do Supabase (adeus `data/products.ts`)
4. **Contas** — cadastro, login e-mail/senha, Google, perfil, endereços, rotas privadas
5. **Produto e carrinho** — PDP, `Carrinho.ts` testado, drawer de verdade
6. **Checkout** — `criarPedido` + `webhook-mp`, com as quatro linhas de defesa
7. **Admin** — dashboard, pedidos, **lotes**, regras de preço
8. **Sincronização** — encoding, extração, salvaguardas, cron
9. **Conta da cliente** — meus pedidos, rastreio, favoritos
10. **Acabamento** — SEO, analytics, e-mails, frete real

Etapas 1 a 6 são a loja vendendo. As outras são o que a torna sustentável.
