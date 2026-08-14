// Package db concentra o acesso ao Postgres do Supabase.
//
// Este serviço conecta com credencial de dono do banco, então RLS não se
// aplica aqui — é por isso que TODA consulta que envolve dado de cliente
// filtra por user_id explicitamente. Esquecer esse filtro é o equivalente,
// deste lado, a esquecer uma policy.
package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mirava/api/internal/dominio"
)

var ErrDuplicado = errors.New("registro já existe")

type DB struct{ pool *pgxpool.Pool }

func Conectar(ctx context.Context, url string) (*DB, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}
	// Cloud Run escala a zero e sobe várias instâncias; o pooler do Supabase
	// tem limite. Poucas conexões por instância evita esgotá-lo.
	cfg.MaxConns = 5
	cfg.MaxConnIdleTime = 2 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping falhou: %w", err)
	}
	return &DB{pool: pool}, nil
}

func (d *DB) Fechar() { d.pool.Close() }

func (d *DB) Ping(ctx context.Context) error { return d.pool.Ping(ctx) }

func ehDuplicado(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505" // unique_violation
	}
	return false
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

type Produto struct {
	ID          string
	Nome        string
	Preco       dominio.Centavos
	Custo       dominio.Centavos
	SKU         string
	Disponivel  bool
}

// ProdutosParaCheckout busca preço REAL no banco.
//
// É a função que impede alguém de comprar uma joia por um real: o preço nunca
// vem da requisição, sempre daqui.
func (d *DB) ProdutosParaCheckout(ctx context.Context, ids []string) (map[string]Produto, error) {
	linhas, err := d.pool.Query(ctx, `
		select p.id::text, p.nome, p.preco_centavos, p.custo_centavos,
		       coalesce(fp.sku, ''), coalesce(fp.disponivel, true)
		from produtos p
		left join fornecedor_produtos fp on fp.id = p.fornecedor_produto_id
		where p.id = any($1::uuid[]) and p.publicado = true`, ids)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	out := map[string]Produto{}
	for linhas.Next() {
		var p Produto
		if err := linhas.Scan(&p.ID, &p.Nome, &p.Preco, &p.Custo, &p.SKU, &p.Disponivel); err != nil {
			return nil, err
		}
		out[p.ID] = p
	}
	return out, linhas.Err()
}

func (d *DB) AjusteVariante(ctx context.Context, produtoID, tamanho string) (dominio.Centavos, bool, error) {
	var ajuste dominio.Centavos
	var disponivel bool
	err := d.pool.QueryRow(ctx, `
		select ajuste_preco_centavos, disponivel
		from produto_variantes where produto_id = $1 and tamanho = $2`,
		produtoID, tamanho).Scan(&ajuste, &disponivel)

	if errors.Is(err, pgx.ErrNoRows) {
		return 0, true, nil // produto sem variantes cadastradas
	}
	return ajuste, disponivel, err
}

// ---------------------------------------------------------------------------
// Conta
// ---------------------------------------------------------------------------

type Endereco struct {
	Destinatario, CEP, Rua, Numero, Complemento, Bairro, Cidade, UF string
}

// EnderecoDoUsuario filtra por user_id de propósito: sem isso, alguém
// mandaria o id de um endereço alheio e descobriria onde outra pessoa mora.
func (d *DB) EnderecoDoUsuario(ctx context.Context, userID, enderecoID string) (*Endereco, error) {
	var e Endereco
	err := d.pool.QueryRow(ctx, `
		select destinatario, cep, rua, numero, coalesce(complemento,''),
		       bairro, cidade, uf
		from enderecos where id = $1 and user_id = $2`,
		enderecoID, userID).Scan(&e.Destinatario, &e.CEP, &e.Rua, &e.Numero,
		&e.Complemento, &e.Bairro, &e.Cidade, &e.UF)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("endereço não encontrado")
	}
	return &e, err
}

type Perfil struct{ Nome, Telefone, CPF string }

func (d *DB) Perfil(ctx context.Context, userID string) (Perfil, error) {
	var p Perfil
	err := d.pool.QueryRow(ctx, `
		select nome, coalesce(telefone,''), coalesce(cpf,'')
		from perfis where id = $1`, userID).Scan(&p.Nome, &p.Telefone, &p.CPF)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, nil
	}
	return p, err
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

type ItemPedido struct {
	ProdutoID  string
	Nome       string
	SKU        string
	Tamanho    string
	Quantidade int
	Preco      dominio.Centavos
	Custo      dominio.Centavos
}

type NovoPedido struct {
	UserID     string
	Nome       string
	Email      string
	Telefone   string
	CPF        string
	Endereco   any
	Subtotal   dominio.Centavos
	Frete      dominio.Centavos
	Desconto   dominio.Centavos
	Total      dominio.Centavos
	Gravacao   string
	Itens      []ItemPedido
}

// CriarPedido grava pedido e itens numa transação: pedido sem item é um
// estado inválido que dá muito trabalho para limpar depois.
func (d *DB) CriarPedido(ctx context.Context, p NovoPedido) (id string, numero int, err error) {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return "", 0, err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx, `
		insert into pedidos (user_id, status, cliente_nome, cliente_email,
			cliente_tel, cliente_cpf, endereco, subtotal_centavos,
			frete_centavos, desconto_centavos, total_centavos, gravacao)
		values ($1,'aguardando_pagamento',$2,$3,
			nullif($4,''), nullif($5,''), $6, $7, $8, $9, $10, nullif($11,''))
		returning id::text, numero`,
		p.UserID, p.Nome, p.Email, p.Telefone, p.CPF, p.Endereco,
		p.Subtotal, p.Frete, p.Desconto, p.Total, p.Gravacao,
	).Scan(&id, &numero)
	if err != nil {
		return "", 0, err
	}

	for _, i := range p.Itens {
		if _, err = tx.Exec(ctx, `
			insert into pedido_itens (pedido_id, produto_id, nome_snapshot,
				sku_fornecedor, tamanho, quantidade,
				preco_unit_centavos, custo_unit_centavos)
			values ($1,$2,$3,nullif($4,''),nullif($5,''),$6,$7,$8)`,
			id, i.ProdutoID, i.Nome, i.SKU, i.Tamanho, i.Quantidade, i.Preco, i.Custo,
		); err != nil {
			return "", 0, err
		}
	}
	return id, numero, tx.Commit(ctx)
}

type PedidoResumo struct {
	ID     string
	Numero int
	Status dominio.Status
	Total  dominio.Centavos
	Email  string
}

func (d *DB) PedidoPorID(ctx context.Context, id string) (*PedidoResumo, error) {
	var p PedidoResumo
	err := d.pool.QueryRow(ctx, `
		select id::text, numero, status, total_centavos, cliente_email
		from pedidos where id = $1`, id).
		Scan(&p.ID, &p.Numero, &p.Status, &p.Total, &p.Email)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &p, err
}

type RegistroPagamento struct {
	PedidoID    string
	MPPaymentID string
	Status      string
	Metodo      string
	Parcelas    int
	Valor       dominio.Centavos
	Taxa        dominio.Centavos
	Liquido     dominio.Centavos
	Payload     []byte
}

// RegistrarPagamento devolve ErrDuplicado quando o webhook já foi processado.
// O Mercado Pago reenvia o mesmo evento várias vezes — é o comportamento
// normal dele, e o unique em mp_payment_id transforma a repetição num no-op.
func (d *DB) RegistrarPagamento(ctx context.Context, r RegistroPagamento) error {
	_, err := d.pool.Exec(ctx, `
		insert into pagamentos (pedido_id, mp_payment_id, status, metodo,
			parcelas, valor_centavos, taxa_centavos, liquido_centavos, payload)
		values ($1,$2,$3,nullif($4,''),nullif($5,0),$6,nullif($7,0),nullif($8,0),$9)`,
		r.PedidoID, r.MPPaymentID, r.Status, r.Metodo, r.Parcelas,
		r.Valor, r.Taxa, r.Liquido, r.Payload)

	if ehDuplicado(err) {
		return ErrDuplicado
	}
	return err
}

// MarcarPago só age se o pedido ainda estiver aguardando: a cláusula extra
// no where é a trava contra dois webhooks simultâneos.
func (d *DB) MarcarPago(ctx context.Context, pedidoID string) (bool, error) {
	tag, err := d.pool.Exec(ctx, `
		update pedidos set status='pago', pago_em=now()
		where id=$1 and status='aguardando_pagamento'`, pedidoID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (d *DB) AtualizarStatus(ctx context.Context, pedidoID string, novo dominio.Status) error {
	_, err := d.pool.Exec(ctx, `update pedidos set status=$2 where id=$1`, pedidoID, novo)
	return err
}

func (d *DB) RegistrarAlerta(ctx context.Context, pedidoID, detalhe string) error {
	_, err := d.pool.Exec(ctx, `
		insert into eventos_pedido (pedido_id, de_status, para_status, origem, detalhe)
		select id, status, status, 'webhook', $2 from pedidos where id = $1`,
		pedidoID, detalhe)
	return err
}

// ---------------------------------------------------------------------------
// Sincronização
// ---------------------------------------------------------------------------

type EspelhoProduto struct {
	FornecedorID      string
	SKU, URL, Nome    string
	Descricao         string
	Garantia          string
	Custo, Varejo     dominio.Centavos
	CustoConfirmado   bool
	Disponivel        bool
	Imagens           []string
	Avaliacao         float64
	QtdAvaliacoes     int
}

// UpsertEspelho grava no ESPELHO — nunca no catálogo da dona.
// Devolve true quando é produto novo.
func (d *DB) UpsertEspelho(ctx context.Context, e EspelhoProduto) (novo bool, id string, err error) {
	err = d.pool.QueryRow(ctx, `
		insert into fornecedor_produtos (fornecedor_id, sku, url, nome, descricao,
			garantia, custo_centavos, varejo_centavos, custo_confirmado,
			disponivel, imagens_origem, avaliacao, qtd_avaliacoes, visto_em, sumido_em)
		values ($1,$2,$3,$4,nullif($5,''),nullif($6,''),$7,$8,$9,$10,$11,
			nullif($12,0)::numeric, nullif($13,0), now(), null)
		on conflict (fornecedor_id, sku) do update set
			url = excluded.url, nome = excluded.nome,
			descricao = coalesce(excluded.descricao, fornecedor_produtos.descricao),
			garantia = coalesce(excluded.garantia, fornecedor_produtos.garantia),
			custo_centavos = excluded.custo_centavos,
			varejo_centavos = excluded.varejo_centavos,
			custo_confirmado = excluded.custo_confirmado,
			disponivel = excluded.disponivel,
			imagens_origem = excluded.imagens_origem,
			avaliacao = excluded.avaliacao,
			qtd_avaliacoes = excluded.qtd_avaliacoes,
			visto_em = now(), sumido_em = null
		returning id::text, (xmax = 0) as inserido`,
		e.FornecedorID, e.SKU, e.URL, e.Nome, e.Descricao, e.Garantia,
		e.Custo, e.Varejo, e.CustoConfirmado, e.Disponivel, e.Imagens,
		e.Avaliacao, e.QtdAvaliacoes,
	).Scan(&id, &novo)
	return novo, id, err
}

// AplicarCusto chama a função SQL com o disjuntor de preço.
// A regra mora no banco para valer mesmo se este serviço tiver bug.
func (d *DB) AplicarCusto(ctx context.Context, espelhoID string, custo dominio.Centavos) (string, error) {
	var resultado string
	err := d.pool.QueryRow(ctx, `
		select public.aplicar_custo_sincronizado(p.id, $2, $3)
		from produtos p where p.fornecedor_produto_id = $1`,
		espelhoID, int64(custo), dominio.LimiteVariacaoPreco).Scan(&resultado)

	if errors.Is(err, pgx.ErrNoRows) {
		return "sem produto no catálogo", nil // ainda não promovido pela dona
	}
	return resultado, err
}

// MarcarIndisponivel despublica o que sumiu do site da Lilly.
// Não apaga: pedidos antigos referenciam esses produtos.
func (d *DB) MarcarSumidos(ctx context.Context, fornecedorID string, vistos []string) (int64, error) {
	tag, err := d.pool.Exec(ctx, `
		update fornecedor_produtos
		set disponivel = false, sumido_em = coalesce(sumido_em, now())
		where fornecedor_id = $1 and not (sku = any($2::text[]))
		  and sumido_em is null`, fornecedorID, vistos)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func (d *DB) FornecedorAtivo(ctx context.Context) (id, sitemap string, razao float64, err error) {
	err = d.pool.QueryRow(ctx, `
		select id::text, coalesce(sitemap_url,''), razao_atacado::float8
		from fornecedores where ativo order by criado_em limit 1`).
		Scan(&id, &sitemap, &razao)
	return
}

func (d *DB) IniciarSync(ctx context.Context, fornecedorID string, total int) (string, error) {
	var id string
	err := d.pool.QueryRow(ctx, `
		insert into sincronizacoes (fornecedor_id, urls_no_sitemap)
		values ($1,$2) returning id::text`, fornecedorID, total).Scan(&id)
	return id, err
}

type ResultadoSync struct {
	Processados, Novos, Atualizados, Falhas, Sumidos, PrecosTravados int
	Status, Erro                                                     string
}

func (d *DB) FinalizarSync(ctx context.Context, syncID string, r ResultadoSync) error {
	_, err := d.pool.Exec(ctx, `
		update sincronizacoes set status=$2, processados=$3, novos=$4,
			atualizados=$5, falhas=$6, sumidos=$7, precos_travados=$8,
			erro=nullif($9,''), finalizado_em=now()
		where id=$1`,
		syncID, r.Status, r.Processados, r.Novos, r.Atualizados,
		r.Falhas, r.Sumidos, r.PrecosTravados, r.Erro)
	return err
}

func (d *DB) RegistrarFalhaSync(ctx context.Context, syncID, url, motivo string) {
	_, _ = d.pool.Exec(ctx, `
		insert into sincronizacao_falhas (sync_id, url, motivo) values ($1,$2,$3)`,
		syncID, url, motivo)
}

// ---------------------------------------------------------------------------
// Lote
// ---------------------------------------------------------------------------

type LoteAberto struct {
	ID              string
	Custo           dominio.Centavos
	PagoMaisAntigo  time.Time
}

func (d *DB) LoteAberto(ctx context.Context) (*LoteAberto, error) {
	var l LoteAberto
	var maisAntigo *time.Time
	err := d.pool.QueryRow(ctx, `
		select l.id::text, l.custo_total_centavos,
		       (select min(p.pago_em) from pedidos p
		         where p.lote_id = l.id
		           and p.status not in ('cancelado','estornado','falha_estoque'))
		from lotes l where l.status = 'aberto' limit 1`).
		Scan(&l.ID, &l.Custo, &maisAntigo)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if maisAntigo != nil {
		l.PagoMaisAntigo = *maisAntigo
	}
	return &l, err
}

func (d *DB) FecharLote(ctx context.Context, loteID string, frete dominio.Centavos, motivo string) error {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err = tx.Exec(ctx, `
		update lotes set status='fechado', fechado_em=now(),
			frete_pago_centavos=$2, observacoes=$3
		where id=$1 and status='aberto'`, loteID, frete, motivo); err != nil {
		return err
	}
	// Abre o próximo imediatamente: pedido pago não pode ficar sem lote.
	if _, err = tx.Exec(ctx, `insert into lotes (status) values ('aberto')`); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
